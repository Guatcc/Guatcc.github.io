(() => {
  const status = document.getElementById("forumStatus");
  const offline = document.getElementById("forumOffline");
  const app = document.getElementById("forumApp");
  const list = document.getElementById("threadList");
  const detail = document.getElementById("threadDetail");
  const form = document.getElementById("threadForm");
  const search = document.getElementById("forumSearch");
  const refresh = document.getElementById("refreshForum");
  let client;
  let threads = [];
  let activeThreadId = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setStatus(state, title, text) {
    if (!status) return;
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

  function renderThreadList() {
    const query = String(search?.value || "").trim().toLowerCase();
    const visible = threads.filter((thread) => {
      const haystack = [thread.title, thread.bodyPreview, thread.author, ...(thread.tags || [])].join(" ").toLowerCase();
      return !query || haystack.includes(query);
    });

    list.innerHTML = visible.map((thread) => `
      <button class="thread-row${thread.id === activeThreadId ? " is-active" : ""}" type="button" data-thread-id="${escapeHtml(thread.id)}">
        <span class="thread-title">${thread.pinned ? "置顶 · " : ""}${escapeHtml(thread.title)}</span>
        <span class="thread-meta">${escapeHtml(thread.author)} · ${formatTime(thread.updatedAt)} · ${thread.replyCount} 回复${thread.locked ? " · 已锁定" : ""}</span>
        <span class="thread-preview">${escapeHtml(thread.bodyPreview || "")}</span>
        ${(thread.tags || []).length ? `<span class="thread-tags">${thread.tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</span>` : ""}
      </button>
    `).join("") || `<p class="empty-state">还没有匹配的帖子。</p>`;
  }

  async function loadThreads() {
    const data = await client.request("forum.list", { limit: 100 });
    threads = data.threads || [];
    renderThreadList();
    if (!activeThreadId && threads[0]) loadThread(threads[0].id);
  }

  async function loadThread(id) {
    activeThreadId = id;
    renderThreadList();
    const data = await client.request("forum.thread", { id });
    const thread = data.thread;
    if (!thread) return;

    detail.hidden = false;
    detail.innerHTML = `
      <header class="detail-head">
        <div>
          <p class="thread-meta">${escapeHtml(thread.author)} · ${formatTime(thread.createdAt)}${thread.locked ? " · 已锁定" : ""}</p>
          <h2>${escapeHtml(thread.title)}</h2>
        </div>
        ${(thread.tags || []).length ? `<div class="thread-tags">${thread.tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      </header>
      <div class="thread-body">${escapeHtml(thread.body).replace(/\n/g, "<br>")}</div>
      <section class="reply-list">
        <h3>${thread.replies.length} 条回复</h3>
        ${thread.replies.map((reply) => `
          <article class="reply-item">
            <strong>${escapeHtml(reply.author)}</strong>
            <span>${formatTime(reply.createdAt)}</span>
            <p>${escapeHtml(reply.body).replace(/\n/g, "<br>")}</p>
          </article>
        `).join("")}
      </section>
      ${thread.locked ? `<p class="empty-state">这个帖子已锁定，暂时不能继续回复。</p>` : `
        <form class="reply-form" id="replyForm">
          <label>昵称<input name="author" maxlength="24" placeholder="匿名同学"></label>
          <label>回复<textarea name="body" maxlength="2000" required placeholder="写下你的回复"></textarea></label>
          <button class="primary-link" type="submit">发送回复</button>
        </form>
      `}
    `;

    const replyForm = document.getElementById("replyForm");
    replyForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(replyForm);
      await client.request("forum.reply", {
        threadId: thread.id,
        author: formData.get("author") || "匿名同学",
        body: formData.get("body"),
      });
      replyForm.reset();
      await loadThread(thread.id);
      await loadThreads();
    });
  }

  async function boot() {
    try {
      setStatus("connecting", "正在连接论坛后端", "尝试 WebSocket 握手");
      client = await window.GuatForumWs.connect({ timeout: 2200 });
      const hello = await client.request("hello");
      document.querySelectorAll(".forum-entry").forEach((entry) => { entry.hidden = false; });
      offline.hidden = true;
      app.hidden = false;
      setStatus("online", "论坛已连接", `${hello.threadCount || 0} 个帖子 · ${client.url}`);
      client.on("forum.changed", loadThreads);
      await loadThreads();
    } catch (error) {
      app.hidden = true;
      offline.hidden = false;
      setStatus("offline", "论坛后端不可达", error.message);
    }
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const tags = String(formData.get("tags") || "")
      .split(/[,，\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 6);

    const data = await client.request("forum.create", {
      author: formData.get("author") || "匿名同学",
      title: formData.get("title"),
      body: formData.get("body"),
      tags,
    });
    form.reset();
    await loadThreads();
    await loadThread(data.thread.id);
  });

  list?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-thread-id]");
    if (row) loadThread(row.dataset.threadId);
  });

  search?.addEventListener("input", renderThreadList);
  refresh?.addEventListener("click", loadThreads);
  boot();
})();
