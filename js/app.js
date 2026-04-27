(() => {
  const root = document.documentElement;
  const searchInput = document.getElementById("searchInput");
  const cards = [...document.querySelectorAll("[data-card]")];
  const topicButtons = [...document.querySelectorAll("[data-topic]")];
  const resultCount = document.getElementById("resultCount");
  const emptyState = document.getElementById("emptyState");
  const themeToggle = document.getElementById("themeToggle");
  const backTop = document.getElementById("backTop");
  const highlightNodes = [...document.querySelectorAll("[data-highlight]")];
  const canAnimate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  highlightNodes.forEach((node) => {
    node.dataset.originalText = node.textContent;
  });

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function renderHighlight(node, query) {
    const original = node.dataset.originalText || "";
    node.textContent = "";

    if (!query) {
      node.textContent = original;
      return;
    }

    const lower = original.toLowerCase();
    const q = query.toLowerCase();
    let index = 0;
    let cursor = 0;
    const fragment = document.createDocumentFragment();

    while ((index = lower.indexOf(q, cursor)) !== -1) {
      if (index > cursor) fragment.append(document.createTextNode(original.slice(cursor, index)));
      const mark = document.createElement("mark");
      mark.textContent = original.slice(index, index + q.length);
      fragment.append(mark);
      cursor = index + q.length;
    }

    if (cursor < original.length) fragment.append(document.createTextNode(original.slice(cursor)));
    node.append(fragment);
  }

  function setActiveTopic(value) {
    const wanted = normalize(value);
    topicButtons.forEach((button) => {
      button.classList.toggle("is-active", normalize(button.dataset.topic) === wanted);
    });
  }

  function applyFilter() {
    const query = normalize(searchInput?.value);
    let visible = 0;

    cards.forEach((card) => {
      const match = !query || normalize(card.dataset.search).includes(query);
      card.hidden = !match;
      if (match) visible += 1;
      card.querySelectorAll("[data-highlight]").forEach((node) => renderHighlight(node, query));
    });

    if (resultCount) resultCount.textContent = String(visible);
    if (emptyState) emptyState.hidden = visible !== 0;
    setActiveTopic(query);
  }

  function revealCards() {
    if (!canAnimate || !("IntersectionObserver" in window)) {
      cards.forEach((card) => card.classList.add("is-visible"));
      return;
    }

    root.classList.add("motion-ready");

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    cards.forEach((card, index) => {
      card.style.transitionDelay = `${Math.min(index, 8) * 35}ms`;
      observer.observe(card);
    });

    window.setTimeout(() => {
      cards.forEach((card) => card.classList.add("is-visible"));
    }, 900);
  }

  topicButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!searchInput) return;
      searchInput.value = button.dataset.topic || "";
      applyFilter();
      searchInput.focus();
    });
  });

  searchInput?.addEventListener("input", applyFilter);

  function setTheme(theme) {
    root.dataset.theme = theme;
    localStorage.setItem("theme", theme);
    themeToggle?.setAttribute("aria-pressed", String(theme === "dark"));
  }

  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(savedTheme || (prefersDark ? "dark" : "light"));

  themeToggle?.addEventListener("click", () => {
    setTheme(root.dataset.theme === "dark" ? "light" : "dark");
  });

  function updateBackTop() {
    backTop?.classList.toggle("is-visible", window.scrollY > 360);
  }

  backTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  window.addEventListener("scroll", updateBackTop, { passive: true });
  updateBackTop();
  revealCards();
  applyFilter();
})();
