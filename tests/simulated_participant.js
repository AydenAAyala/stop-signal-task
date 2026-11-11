// Simulated participant for automated testing, injected into the page by
// run_simulation.py. It follows the race model: a go process with normally
// distributed RTs races a stop process that finishes SSRT ms after STOP
// appears. Whichever finishes first decides the trial.
(() => {
  const SSRT = 200;
  const GO_MEAN = { pro: 450, anti: 550 };
  const GO_SD = 80;
  const CHOICE_ERROR_RATE = 0.05;
  const FREE_WITHHOLD_RATE = 0.4;

  const gauss = () => {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const left = document.getElementById("leftTarget");
  const right = document.getElementById("rightTarget");
  const stop = document.getElementById("stopSignal");
  const cue = document.getElementById("cueLabel");

  let pending = null;   // the scheduled keypress, if any
  let onset = null;

  const press = (key) => document.dispatchEvent(new KeyboardEvent("keydown", { key }));

  // When a dot appears, schedule a keypress after a sampled RT.
  new MutationObserver(() => {
    const side = left.classList.contains("visible") ? "left"
      : right.classList.contains("visible") ? "right" : null;

    if (side && onset === null) {
      onset = performance.now();
      const label = cue.textContent;
      if (label === "FREE VETO" && Math.random() < FREE_WITHHOLD_RATE) return;
      const anti = label === "ANTI";
      const rt = Math.max(180, (anti ? GO_MEAN.anti : GO_MEAN.pro) + GO_SD * gauss());
      let key = (side === "left") !== anti ? "f" : "j";
      if (Math.random() < CHOICE_ERROR_RATE) key = key === "f" ? "j" : "f";
      pending = { at: onset + rt, timer: setTimeout(() => { pending = null; press(key); }, rt) };
    }

    if (!side) {
      onset = null;
      if (pending) { clearTimeout(pending.timer); pending = null; }
    }
  }).observe(document.getElementById("targetArea"), { subtree: true, attributes: true, attributeFilter: ["class"] });

  // When STOP appears, cancel the keypress if the stop process would finish first.
  new MutationObserver(() => {
    if (stop.classList.contains("visible") && pending && performance.now() + SSRT < pending.at) {
      clearTimeout(pending.timer);
      pending = null;
    }
  }).observe(stop, { attributes: true });

  // Click through practice-complete and break screens.
  setInterval(() => {
    if (!document.getElementById("breakScreen").hidden) document.getElementById("breakBtn").click();
  }, 300);
})();
