// ============================================================
// career.js — NEW, ADDITIVE MODULE ONLY.
// Handles the optional "Engineering / Doctor" path picked on the
// index page and the follow-up specialization picked on
// career-selection.html. Everything here is namespaced under its
// own sessionStorage key ("quizzy_career_v1") so it never touches
// the existing quiz, SM-2 or auth/session storage keys.
// ============================================================

const CareerPath = (() => {
  const K_CAREER = "quizzy_career_v1";

  const SPECIALIZATIONS = {
    engineering: {
      label: "Engineering",
      heading: "Choose your engineering specialization",
      sub: "Pick the branch you're preparing for. You can change this later from your profile.",
      icon: "🛠️",
      options: [
        { key: "cs", icon: "💻", title: "Computer Science", desc: "Programming, DSA & core CS subjects." },
        { key: "mechanical", icon: "⚙️", title: "Mechanical", desc: "Thermodynamics, mechanics & design." },
        { key: "electrical", icon: "🔌", title: "Electrical", desc: "Circuits, electronics & power systems." },
        { key: "civil", icon: "🏗️", title: "Civil", desc: "Structures, materials & construction." },
      ],
    },
    doctor: {
      label: "Doctor",
      heading: "Choose your medical specialization",
      sub: "Pick the track you're preparing for. You can change this later from your profile.",
      icon: "🩺",
      options: [
        { key: "mbbs", icon: "🩺", title: "MBBS (General Medicine)", desc: "Core pre-medical entrance prep." },
        { key: "dental", icon: "🦷", title: "Dental", desc: "Dental science entrance prep." },
        { key: "pharmacy", icon: "💊", title: "Pharmacy", desc: "Pharmaceutical sciences prep." },
        { key: "nursing", icon: "❤️‍🩹", title: "Nursing", desc: "Nursing entrance prep." },
      ],
    },
  };

  function getSelection() {
    try {
      const raw = sessionStorage.getItem(K_CAREER);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveCareer(career) {
    const existing = getSelection() || {};
    existing.career = career;
    sessionStorage.setItem(K_CAREER, JSON.stringify(existing));
  }

  function saveSpecialization(specialization) {
    const existing = getSelection() || {};
    existing.specialization = specialization;
    sessionStorage.setItem(K_CAREER, JSON.stringify(existing));
  }

  // ---- index.html wiring: clicking Engineering / Doctor stores the pick ----
  function initEntryPoints() {
    document.querySelectorAll(".career-option[data-career]").forEach((el) => {
      el.addEventListener("click", () => {
        saveCareer(el.getAttribute("data-career"));
      });
    });
  }

  // ---- career-selection.html wiring: render + capture the second pick ----
  function initSelectionPage() {
    const selection = getSelection();
    const career = selection && selection.career;
    const config = SPECIALIZATIONS[career] || SPECIALIZATIONS.engineering;

    const headingEl = document.querySelector('[data-dynamic="career-heading"]');
    const subEl = document.querySelector('[data-dynamic="career-sub"]');
    const gridEl = document.querySelector('[data-dynamic="career-options"]');
    const pillEl = document.querySelector('[data-dynamic="career-pill"]');

    if (pillEl) pillEl.textContent = `${config.icon} ${config.label} track`;
    if (headingEl) headingEl.textContent = config.heading;
    if (subEl) subEl.textContent = config.sub;

    if (gridEl) {
      gridEl.innerHTML = config.options.map((opt) => `
        <button type="button" class="card card-hover center specialization-option" data-key="${opt.key}">
          <div class="icon-chip" style="margin:0 auto">${opt.icon}</div>
          <h3 style="margin-top:12px">${opt.title}</h3>
          <p class="small">${opt.desc}</p>
        </button>`).join("");

      gridEl.querySelectorAll(".specialization-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          gridEl.querySelectorAll(".specialization-option").forEach((b) => b.classList.remove("selected"));
          btn.classList.add("selected");
          saveSpecialization(btn.getAttribute("data-key"));

          const continueBtn = document.querySelector('[data-dynamic="career-continue"]');
          if (continueBtn) continueBtn.removeAttribute("disabled");
        });
      });
    }

    const continueBtn = document.querySelector('[data-dynamic="career-continue"]');
    if (continueBtn) {
      continueBtn.addEventListener("click", () => {
        const current = getSelection();
        if (!current || !current.specialization) return;
        window.location.href = "./signup.html";
      });
    }
  }

  return { getSelection, saveCareer, saveSpecialization, initEntryPoints, initSelectionPage };
})();

document.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector(".career-option[data-career]")) CareerPath.initEntryPoints();
  if (document.querySelector('[data-dynamic="career-options"]')) CareerPath.initSelectionPage();
});
