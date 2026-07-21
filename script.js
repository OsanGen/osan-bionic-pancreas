const scenes = [
  {
    hash: "problem",
    eyebrow: "The root problem",
    title: "T1D is two failures.",
    copy: "The immune system destroys the beta cells that sense glucose and release insulin. Replacing insulin treats the consequence—not the autoimmune cause.",
    evidence: "FOUNDATIONAL",
    takeaway: "A real cure must restore pancreatic function and create immune peace.",
    frameLabel: "THE PROBLEM",
    caption: "Autoimmunity → beta-cell loss → continuous external management.",
    accent: "var(--pink)"
  },
  {
    hash: "equation",
    eyebrow: "The cure equation",
    title: "Restore the cells. Protect them.",
    copy: "Replacement cells can make insulin again. Immune protection keeps them alive. A durable cure needs both.",
    evidence: "TWO REQUIREMENTS",
    takeaway: "The breakthrough is not one technology. It is the safe convergence of both.",
    frameLabel: "THE EQUATION",
    caption: "Functioning islets + immune protection = durable glucose regulation.",
    accent: "var(--blue)"
  },
  {
    hash: "landscape",
    eyebrow: "The modern research landscape",
    title: "The cure is converging.",
    copy: "Transplants prove the biology. Stem cells address supply. Gene editing and tolerance research aim to remove lifelong immunosuppression.",
    evidence: "APPROVED → EARLY HUMAN",
    takeaway: "The field is moving from isolated wins toward a scalable, protected cell system.",
    frameLabel: "THE LANDSCAPE",
    caption: "Evidence stage is not the same as broad availability—or a completed cure.",
    accent: "var(--mint)"
  },
  {
    hash: "product",
    eyebrow: "The practical bridge",
    title: "A pancreas that thinks ahead.",
    copy: "One wearable concept combines continuous sensing, safety-bounded prediction and automated delivery—without routine treatment decisions.",
    evidence: "OSAN PRODUCT CONCEPT",
    takeaway: "Replace the daily management burden now, while biological restoration matures.",
    frameLabel: "THE PRODUCT",
    caption: "Integrated sensing · safety-bounded intelligence · automated delivery.",
    accent: "var(--yellow)"
  },
  {
    hash: "roadmap",
    eyebrow: "The platform thesis",
    title: "Wearable now. Biological next.",
    copy: "The platform can evolve from autonomous delivery into a supervisor for living islet cells—and ultimately a safety layer around biological restoration.",
    evidence: "NOW → NEXT → NORTH STAR",
    takeaway: "The pod is not the endpoint. It is the bridge between engineered and biological control.",
    frameLabel: "THE ROADMAP",
    caption: "Autonomous wearable → biohybrid supervisor → biological restoration.",
    accent: "var(--blue)"
  }
];

const stageButtons = [...document.querySelectorAll(".stage-button")];
const scenePanels = [...document.querySelectorAll(".scene-art")];
const previousButton = document.getElementById("previous-scene");
const nextButton = document.getElementById("next-scene");
const progressFill = document.getElementById("progress-fill");
const title = document.getElementById("scene-title");
const eyebrow = document.getElementById("scene-eyebrow");
const copy = document.getElementById("scene-copy");
const evidence = document.getElementById("scene-evidence");
const takeaway = document.getElementById("scene-takeaway");
const frameNumber = document.getElementById("frame-number");
const frameLabel = document.getElementById("frame-label");
const sceneCount = document.getElementById("scene-count");
const visualCaption = document.getElementById("visual-caption");
const takeawayBlock = document.querySelector(".takeaway");

let activeStage = 0;

function stageFromHash() {
  const cleanHash = window.location.hash.replace("#", "");
  const index = scenes.findIndex((scene) => scene.hash === cleanHash);
  return index >= 0 ? index : 0;
}

function updateHash(hash, pushHistory) {
  const nextHash = `#${hash}`;
  if (window.location.hash === nextHash) return;

  if (pushHistory) {
    window.history.pushState({ stage: hash }, "", nextHash);
  } else {
    window.history.replaceState({ stage: hash }, "", nextHash);
  }
}

function setStage(index, options = {}) {
  const boundedIndex = Math.max(0, Math.min(index, scenes.length - 1));
  const previousIndex = activeStage;
  const scene = scenes[boundedIndex];

  stageButtons.forEach((button, buttonIndex) => {
    const selected = buttonIndex === boundedIndex;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });

  scenePanels.forEach((panel, panelIndex) => {
    panel.classList.toggle("is-active", panelIndex === boundedIndex);
    panel.classList.toggle("is-leaving", panelIndex === previousIndex && panelIndex !== boundedIndex);
    panel.setAttribute("aria-hidden", String(panelIndex !== boundedIndex));
  });

  eyebrow.textContent = scene.eyebrow;
  title.textContent = scene.title;
  copy.textContent = scene.copy;
  evidence.textContent = scene.evidence;
  takeaway.textContent = scene.takeaway;
  frameNumber.textContent = String(boundedIndex + 1).padStart(2, "0");
  frameLabel.textContent = scene.frameLabel;
  sceneCount.textContent = `${String(boundedIndex + 1).padStart(2, "0")} / ${String(scenes.length).padStart(2, "0")}`;
  visualCaption.textContent = scene.caption;
  takeawayBlock.style.borderLeftColor = scene.accent;
  progressFill.style.width = `${((boundedIndex + 1) / scenes.length) * 100}%`;

  previousButton.disabled = boundedIndex === 0;
  nextButton.disabled = boundedIndex === scenes.length - 1;
  nextButton.innerHTML = boundedIndex === scenes.length - 1
    ? "Complete"
    : `Next <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 4.5 5 5-5 5"/></svg>`;

  activeStage = boundedIndex;
  updateHash(scene.hash, Boolean(options.pushHistory));
}

stageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setStage(Number(button.dataset.stage), { pushHistory: true });
  });
});

previousButton.addEventListener("click", () => {
  setStage(activeStage - 1, { pushHistory: true });
});

nextButton.addEventListener("click", () => {
  if (activeStage < scenes.length - 1) {
    setStage(activeStage + 1, { pushHistory: true });
  }
});

window.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;

  if (event.key === "ArrowRight") {
    setStage(activeStage + 1, { pushHistory: true });
  }

  if (event.key === "ArrowLeft") {
    setStage(activeStage - 1, { pushHistory: true });
  }

  if (event.key === "Home") {
    setStage(0, { pushHistory: true });
  }

  if (event.key === "End") {
    setStage(scenes.length - 1, { pushHistory: true });
  }
});

window.addEventListener("popstate", () => {
  setStage(stageFromHash());
});

setStage(stageFromHash());
