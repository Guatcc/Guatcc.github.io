const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.FORUM_PORT || 25565);
const HOST = process.env.FORUM_HOST || "0.0.0.0";
const DATA_PATH = path.resolve(process.env.FORUM_DATA_PATH || path.join(__dirname, "forum-data.json"));
const ADMIN_TOKEN = process.env.FORUM_ADMIN_TOKEN || "guat-admin-change-me";
const MAX_BODY = 3000;
const MAX_REPLY = 2000;

let state = loadState();

function now() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
}

function loadState() {
  if (!fs.existsSync(DATA_PATH)) {
    return { version: 1, threads: [] };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    return normalizeState(parsed);
  } catch (error) {
    console.error(`Failed to load forum data: ${error.message}`);
    return { version: 1, threads: [] };
  }
}

function normalizeState(input) {
  const threads = Array.isArray(input?.threads) ? input.threads : [];
  return {
    version: 1,
    threads: threads.map((thread) => ({
      id: String(thread.id || createId("t")),
      title: clean(thread.title, 80) || "未命名帖子",
      body: clean(thread.body, MAX_BODY),
      author: clean(thread.author, 24) || "匿名同学",
      tags: normalizeTags(thread.tags),
      pinned: Boolean(thread.pinned),
      locked: Boolean(thread.locked),
      deleted: Boolean(thread.deleted),
      createdAt: thread.createdAt || now(),
      updatedAt: thread.updatedAt || thread.createdAt || now(),
      replies: Array.isArray(thread.replies) ? thread.replies.map((reply) => ({
        id: String(reply.id || createId("r")),
        body: clean(reply.body, MAX_REPLY),
        author: clean(reply.author, 24) || "匿名同学",
        deleted: Boolean(reply.deleted),
        createdAt: reply.createdAt || now(),
      })) : [],
    })),
  };
}

function saveState() {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  const tmpPath = `${DATA_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tmpPath, DATA_PATH);
}

function clean(value, maxLength) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function normalizeTags(tags) {
  const values = Array.isArray(tags) ? tags : String(tags || "").split(/[,，\s]+/);
  return [...new Set(values.map((tag) => clean(tag, 18)).filter(Boolean))].slice(0, 8);
}

function publicThread(thread, full = false) {
  const replies = thread.replies.filter((reply) => !reply.deleted);
  const base = {
    id: thread.id,
    title: thread.title,
    author: thread.author,
    tags: thread.tags,
    pinned: thread.pinned,
    locked: thread.locked,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    replyCount: replies.length,
    bodyPreview: thread.body.slice(0, 130),
  };

  if (!full) return base;
  return {
    ...base,
    body: thread.body,
    replies: replies.map((reply) => ({
      id: reply.id,
      body: reply.body,
      author: reply.author,
      createdAt: reply.createdAt,
    })),
  };
}

function listThreads(payload = {}) {
  const query = clean(payload.query, 80).toLowerCase();
  const includeDeleted = Boolean(payload.includeDeleted);
  const limit = Math.min(Number(payload.limit) || 50, 500);
  const offset = Math.max(Number(payload.offset) || 0, 0);

  const threads = state.threads
    .filter((thread) => includeDeleted || !thread.deleted)
    .filter((thread) => {
      if (!query) return true;
      return [thread.title, thread.body, thread.author, ...thread.tags].join(" ").toLowerCase().includes(query);
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(offset, offset + limit)
    .map((thread) => publicThread(thread));

  return { threads, total: threads.length };
}

function createThread(payload = {}) {
  const title = clean(payload.title, 80);
  const body = clean(payload.body, MAX_BODY);
  if (!title) throw apiError("标题不能为空");
  if (!body) throw apiError("正文不能为空");

  const timestamp = now();
  const thread = {
    id: createId("t"),
    title,
    body,
    author: clean(payload.author, 24) || "匿名同学",
    tags: normalizeTags(payload.tags),
    pinned: false,
    locked: false,
    deleted: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    replies: [],
  };
  state.threads.push(thread);
  saveState();
  broadcastChanged();
  return { thread: publicThread(thread, true) };
}

function createReply(payload = {}) {
  const thread = state.threads.find((item) => item.id === payload.threadId && !item.deleted);
  if (!thread) throw apiError("帖子不存在");
  if (thread.locked) throw apiError("帖子已锁定");
  const body = clean(payload.body, MAX_REPLY);
  if (!body) throw apiError("回复不能为空");

  const reply = {
    id: createId("r"),
    body,
    author: clean(payload.author, 24) || "匿名同学",
    deleted: false,
    createdAt: now(),
  };
  thread.replies.push(reply);
  thread.updatedAt = reply.createdAt;
  saveState();
  broadcastChanged();
  return { reply };
}

function requireAdmin(socket) {
  if (!socket.isAdmin) throw apiError("需要管理员登录", "UNAUTHORIZED");
}

function apiError(message, code = "BAD_REQUEST") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function broadcastChanged() {
  const message = JSON.stringify({ type: "event", event: "forum.changed", data: { at: now() } });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(message);
  }
}

function send(socket, message) {
  socket.send(JSON.stringify(message));
}

function handleRequest(socket, message) {
  const payload = message.payload || {};

  switch (message.type) {
    case "hello":
      return { serverTime: now(), threadCount: state.threads.filter((thread) => !thread.deleted).length, features: ["forum", "admin", "import", "export"] };
    case "forum.list":
      return listThreads(payload);
    case "forum.thread": {
      const thread = state.threads.find((item) => item.id === payload.id && !item.deleted);
      if (!thread) throw apiError("帖子不存在");
      return { thread: publicThread(thread, true) };
    }
    case "forum.create":
      return createThread(payload);
    case "forum.reply":
      return createReply(payload);
    case "admin.auth":
      if (payload.token !== ADMIN_TOKEN) throw apiError("管理员令牌不正确", "UNAUTHORIZED");
      socket.isAdmin = true;
      return { ok: true, threadCount: state.threads.length };
    case "admin.export":
      requireAdmin(socket);
      return state;
    case "admin.import": {
      requireAdmin(socket);
      const imported = normalizeState(payload.data);
      if (payload.merge) {
        const existing = new Set(state.threads.map((thread) => thread.id));
        state.threads.push(...imported.threads.filter((thread) => !existing.has(thread.id)));
      } else {
        state = imported;
      }
      saveState();
      broadcastChanged();
      return { ok: true, threadCount: state.threads.length };
    }
    case "admin.thread.update": {
      requireAdmin(socket);
      const thread = state.threads.find((item) => item.id === payload.id);
      if (!thread) throw apiError("帖子不存在");
      if (typeof payload.title === "string") thread.title = clean(payload.title, 80) || thread.title;
      if (typeof payload.body === "string") thread.body = clean(payload.body, MAX_BODY) || thread.body;
      if (Array.isArray(payload.tags) || typeof payload.tags === "string") thread.tags = normalizeTags(payload.tags);
      if (typeof payload.pinned === "boolean") thread.pinned = payload.pinned;
      if (typeof payload.locked === "boolean") thread.locked = payload.locked;
      thread.updatedAt = now();
      saveState();
      broadcastChanged();
      return { thread: publicThread(thread, true) };
    }
    case "admin.thread.delete": {
      requireAdmin(socket);
      const thread = state.threads.find((item) => item.id === payload.id);
      if (!thread) throw apiError("帖子不存在");
      thread.deleted = true;
      thread.updatedAt = now();
      saveState();
      broadcastChanged();
      return { ok: true };
    }
    case "admin.reply.delete": {
      requireAdmin(socket);
      const thread = state.threads.find((item) => item.id === payload.threadId);
      const reply = thread?.replies.find((item) => item.id === payload.replyId);
      if (!reply) throw apiError("回复不存在");
      reply.deleted = true;
      thread.updatedAt = now();
      saveState();
      broadcastChanged();
      return { ok: true };
    }
    default:
      throw apiError(`未知 API: ${message.type}`, "NOT_FOUND");
  }
}

const wss = new WebSocketServer({
  host: HOST,
  port: PORT,
  maxPayload: 1024 * 1024 * 2,
});

wss.on("connection", (socket) => {
  socket.isAdmin = false;

  socket.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw);
      if (!message || typeof message.type !== "string") throw apiError("请求格式不正确");
      const data = handleRequest(socket, message);
      send(socket, { id: message.id, type: "ok", data });
    } catch (error) {
      send(socket, {
        id: message?.id,
        type: "error",
        error: {
          code: error.code || "INTERNAL_ERROR",
          message: error.message || "服务端错误",
        },
      });
    }
  });
});

wss.on("listening", () => {
  console.log(`GUAT forum WebSocket server listening on ${HOST}:${PORT}`);
  console.log(`Forum data path: ${DATA_PATH}`);
  if (!process.env.FORUM_ADMIN_TOKEN) {
    console.warn("FORUM_ADMIN_TOKEN is not set. Default token is guat-admin-change-me; change it before public use.");
  }
});
