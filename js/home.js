(() => {
  const root = document.body;
  const header = document.getElementById("homeHeader");
  const revealItems = [...document.querySelectorAll("[data-home-reveal]")];
  const checks = [...document.querySelectorAll("#trafficChecks li")];
  const panels = [...document.querySelectorAll(".home-panel")];
  const canAnimate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function applyDaypart() {
    const hour = new Date().getHours();
    const daypart = hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : hour < 21 ? "evening" : "night";
    root.dataset.daypart = daypart;
  }

  function updateHeader() {
    if (!header) return;
    header.classList.toggle("is-visible", window.scrollY > window.innerHeight * 0.62);
  }

  function updatePatternParallax() {
    const y = Math.round(window.scrollY * -0.08);
    const x = Math.round(Math.sin(window.scrollY / 720) * 14);
    root.style.setProperty("--pattern-y", `${y}px`);
    root.style.setProperty("--pattern-x", `${x}px`);
  }

  function updatePointerGlow(event) {
    const x = Math.round((event.clientX / window.innerWidth) * 100);
    const y = Math.round((event.clientY / window.innerHeight) * 100);
    panels.forEach((panel) => {
      panel.style.setProperty("--mx", `${x}%`);
      panel.style.setProperty("--my", `${y}%`);
    });
  }

  function updateChecks() {
    if (!checks.length) return;
    const first = checks[0].parentElement;
    const rect = first.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.72 - rect.top) / Math.max(rect.height, 1)));
    const active = Math.floor(progress * (checks.length + 0.6));
    checks.forEach((item, index) => {
      item.classList.toggle("is-checked", index < active);
    });
  }

  function updateExits() {
    revealItems.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const leavingTop = rect.bottom < window.innerHeight * 0.18;
      const leavingBottom = rect.top > window.innerHeight * 0.88;
      item.classList.toggle("is-exiting", item.classList.contains("is-visible") && (leavingTop || leavingBottom));
    });
  }

  function onScroll() {
    updateHeader();
    updatePatternParallax();
    updateChecks();
    updateExits();
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-empty-link]");
    if (!link) return;
    event.preventDefault();
    window.alert(link.dataset.emptyLink);
  });

  applyDaypart();
  window.setInterval(applyDaypart, 60 * 1000);

  if (canAnimate && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-visible", entry.isIntersecting);
      });
      updateExits();
    }, { rootMargin: "-8% 0px -8% 0px", threshold: 0.22 });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    checks.forEach((item) => item.classList.add("is-checked"));
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("mousemove", updatePointerGlow, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();
})();
