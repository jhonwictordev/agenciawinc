const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const addMotionSequence = (selector) => {
  document.querySelectorAll(selector).forEach((group) => {
    const items = Array.from(group.children).filter((element) => {
      return !element.matches("script") && !element.classList.contains("motion-skip");
    });

    items.forEach((element, index) => {
      element.classList.add("motion-sequence-item");
      element.style.setProperty("--motion-delay", `${Math.min(index * 90, 420)}ms`);
    });
  });
};

const addMotionReveal = (selector) => {
  document.querySelectorAll(selector).forEach((element) => {
    element.classList.add("motion-reveal");
  });
};

const addMotionDrop = (selector) => {
  document.querySelectorAll(selector).forEach((element) => {
    element.classList.add("motion-reveal", "motion-drop");
  });
};

const revealImmediately = (elements) => {
  elements.forEach((element) => {
    element.classList.add("motion-visible");
  });
};

const initTextMotion = () => {
  if (prefersReducedMotion.matches) {
    return;
  }

  document.documentElement.classList.add("motion-ready");

  [
    ".site-nav",
    ".hero-copy",
    ".hero-actions",
    ".impact-copy",
    ".impact-detail",
    ".section-heading",
    ".process-copy",
    ".cta-box",
    ".portfolio-copy",
    ".portfolio-note-box > div",
    ".briefing-copy",
    ".briefing-section-head",
    ".hero-points",
    ".solution-list",
    ".proof-grid",
    ".brands-grid",
    ".service-grid",
    ".solutions-grid",
    ".process-steps",
    ".showcase-grid",
    ".faq-list",
    ".portfolio-grid",
    ".portfolio-project-grid",
    ".briefing-card-grid"
  ].forEach(addMotionSequence);

  addMotionDrop(".proof-card");

  [
    ".service-card",
    ".solution-card",
    ".process-step",
    ".showcase-card",
    ".faq-item",
    ".portfolio-summary-card",
    ".portfolio-card",
    ".portfolio-project",
    ".briefing-section",
    ".briefing-actions"
  ].forEach(addMotionReveal);

  const immediateTargets = Array.from(
    document.querySelectorAll(
      ".hero-copy .motion-sequence-item, .impact-copy .motion-sequence-item, .impact-detail .motion-sequence-item, .portfolio-copy .motion-sequence-item, .portfolio-note-box > div .motion-sequence-item, .briefing-copy .motion-sequence-item"
    )
  );

  const observerTargets = Array.from(document.querySelectorAll(".motion-reveal, .motion-sequence-item")).filter(
    (element) => !immediateTargets.includes(element)
  );

  revealImmediately(immediateTargets);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("motion-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.2,
      rootMargin: "0px 0px -12% 0px"
    }
  );

  observerTargets.forEach((element) => observer.observe(element));
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTextMotion, { once: true });
} else {
  initTextMotion();
}
