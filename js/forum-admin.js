(() => {
  const status = document.getElementById("adminStatus");
  const login = document.getElementById("adminLogin");
  const actions = document.getElementById("adminActions");
  const threadsPanel = document.getElementById("adminThreads");
  const list = document.getElementById("adminThreadList");
  const importJson = document.getElementById("importJson");
  let client;
  let authed = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setStatus(state, title, text) {
    status.dataset.state = state;
    status.querySelector("strong").textContent = title;
    status.querySelector("span").textContent = text;
  }

  function formatTime(value) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  async function loadThreads() {
    const data = await client.request("forum.list", { limit: 500, includeDeleted: true });
    const threads = data.threads || [];
    list.innerHTML = threads.map((thread) => `
      <article class="admin-thread" data-thread-id="${escapeHtml(thread.id)}">
        <div>
          <h3>${thread.pinned ? "置顶 · " : ""}${escapeHtml(thread.title)}</h3>
          <p>${escapeHtml(thread.author)} · ${formatTime(thread.updatedAt)} · ${thread.replyCount} 回复${thread.locked ? " · 已锁定" : ""}</p>
        </div>
        <div class="admin-actions">
          <button class="secondary-link" type="button" data-action="pin">${thread.pinned ? "取消置顶" : "置顶"}</button>
          <button class="secondary-link" type="button" data-action="lock">${thread.locked ? "解锁" : "锁定"}</button>
          <button class="danger-link" type="button" data-action="delete">删除</button>
        </div>
      </article>
    `).join("") || `<p class="empty-state">暂无帖子。</p>`;
  }

  async function ensureConnected() {
    if (client) return client;
    client = await window.GuatForumWs.connect({ timeout: 2200 });
    client.on("forum.changed", () => {
      if (authed) loadThreads().catch(() => null);
    });
    return client;
  }

  login?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      setStatus("connecting", "正在登录", "校验管理员令牌");
      const formData = new FormData(login);
      await ensureConnected();
      const data = await client.request("admin.auth", { token: formData.get("token") });
      authed = true;
      document.querySelectorAll(".forum-entry").forEach((entry) => { entry.hidden = false; });
      actions.hidden = false;
      threadsPanel.hidden = false;
      setStatus("online", "后台已连接", `${data.threadCount || 0} 个帖子 · ${client.url}`);
      await loadThreads();
    } catch (error) {
      setStatus("offline", "后台连接失败", error.message);
    }
  });

  document.getElementById("exportForum")?.addEventListener("click", async () => {
    const data = await client.request("admin.export");
    importJson.value = JSON.stringify(data, null, 2);
  });

  document.getElementById("reloadAdmin")?.addEventListener("click", loadThreads);

  async function importData(merge) {
    const parsed = JSON.parse(importJson.value);
    await client.request("admin.import", { data: parsed, merge });
    await loadThreads();
  }

  document.getElementById("importReplace")?.addEventListener("click", () => importData(false).catch((error) => {
    setStatus("offline", "导入失败", error.message);
  }));

  document.getElementById("importMerge")?.addEventListener("click", () => importData(true).catch((error) => {
    setStatus("offline", "导入失败", error.message);
  }));

  list?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    const item = event.target.closest("[data-thread-id]");
    if (!button || !item) return;
    const id = item.dataset.threadId;
    const action = button.dataset.action;

    if (action === "delete") {
      await client.request("admin.thread.delete", { id });
    } else {
      const current = button.textContent.includes("取消") || button.textContent.includes("解锁");
      await client.request("admin.thread.update", {
        id,
        [action === "pin" ? "pinned" : "locked"]: !current,
      });
    }
    await loadThreads();
  });

  ensureConnected()
    .then((ws) => setStatus("connecting", "已连接，等待登录", ws.url))
    .catch((error) => setStatus("offline", "论坛后端不可达", error.message));
})();
