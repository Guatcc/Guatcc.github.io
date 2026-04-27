(() => {
  const DEFAULT_HOST = "ws.guat.cc:31679";
  const CONNECT_TIMEOUT = 1800;

  function getCandidates() {
    const params = new URLSearchParams(location.search);
    const configured = params.get("forumWs") || document.documentElement.dataset.forumWs || DEFAULT_HOST;
    if (/^wss?:\/\//i.test(configured)) return [configured];
    if (location.protocol === "https:") return [`wss://${configured}`];
    return [`ws://${configured}`, `wss://${configured}`];
  }

  function connect(options = {}) {
    const timeout = options.timeout ?? CONNECT_TIMEOUT;
    const candidates = options.url ? [options.url] : getCandidates();
    let index = 0;

    return new Promise((resolve, reject) => {
      const errors = [];

      function tryNext() {
        const url = candidates[index++];
        if (!url) {
          reject(new Error(errors.map((error) => error.message).join("; ") || "WebSocket unavailable"));
          return;
        }

        let settled = false;
        const socket = new WebSocket(url);
        const timer = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          socket.close();
          errors.push(new Error(`connect timeout: ${url}`));
          tryNext();
        }, timeout);

        socket.addEventListener("open", () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve(new ForumSocket(socket, url));
        }, { once: true });

        socket.addEventListener("error", () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          errors.push(new Error(`connect failed: ${url}`));
          tryNext();
        }, { once: true });
      }

      tryNext();
    });
  }

  class ForumSocket {
    constructor(socket, url) {
      this.socket = socket;
      this.url = url;
      this.seq = 1;
      this.pending = new Map();
      this.handlers = new Map();

      socket.addEventListener("message", (event) => this.handleMessage(event));
      socket.addEventListener("close", () => {
        for (const { reject } of this.pending.values()) reject(new Error("WebSocket closed"));
        this.pending.clear();
        this.emit("close", {});
      });
    }

    request(type, payload = {}, timeout = 8000) {
      if (this.socket.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error("WebSocket is not open"));
      }

      const id = String(this.seq++);
      const message = { id, type, payload };
      const timer = window.setTimeout(() => {
        const pending = this.pending.get(id);
        if (!pending) return;
        this.pending.delete(id);
        pending.reject(new Error(`Request timeout: ${type}`));
      }, timeout);

      const promise = new Promise((resolve, reject) => {
        this.pending.set(id, { resolve, reject, timer });
      });

      this.socket.send(JSON.stringify(message));
      return promise;
    }

    on(event, handler) {
      const handlers = this.handlers.get(event) || new Set();
      handlers.add(handler);
      this.handlers.set(event, handlers);
      return () => handlers.delete(handler);
    }

    emit(event, data) {
      for (const handler of this.handlers.get(event) || []) handler(data);
    }

    handleMessage(event) {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        window.clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (message.type === "error") {
          pending.reject(new Error(message.error?.message || "WebSocket API error"));
        } else {
          pending.resolve(message.data);
        }
        return;
      }

      if (message.type === "event") this.emit(message.event, message.data);
    }

    close() {
      this.socket.close();
    }
  }

  window.GuatForumWs = { connect, getCandidates };
})();
