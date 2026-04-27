const topbar = document.querySelector(".topbar");
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelectorAll(".nav a");

if (menuToggle && topbar) {
  menuToggle.addEventListener("click", () => {
    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!expanded));
    topbar.classList.toggle("nav-open", !expanded);
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    if (topbar && menuToggle) {
      topbar.classList.remove("nav-open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
});

const revealNodes = document.querySelectorAll(".reveal");
const countNodes = document.querySelectorAll("[data-count]");
const animatedCounts = new WeakSet();

const formatCount = (value, source) => {
  if (String(source).includes(".")) {
    return value.toFixed(1);
  }
  return Math.round(value).toLocaleString("zh-CN");
};

const animateCount = (node) => {
  if (animatedCounts.has(node)) {
    return;
  }

  animatedCounts.add(node);
  const target = Number(node.dataset.count);
  const start = performance.now();
  const duration = 1400;

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = target * eased;
    node.textContent = formatCount(current, node.dataset.count);

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
};

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      entry.target.classList.add("is-visible");

      if (entry.target.matches("[data-count]")) {
        animateCount(entry.target);
      }
    });
  },
  {
    threshold: 0.2,
    rootMargin: "0px 0px -10% 0px"
  }
);

revealNodes.forEach((node) => observer.observe(node));
countNodes.forEach((node) => observer.observe(node));
