import { SimulationEngine } from "./simulation/engine.js";
import { UIRenderer } from "./components/renderer.js";

const renderer = new UIRenderer();
const engine = new SimulationEngine((snapshot) => renderer.render(snapshot));

const modeSelect = document.getElementById("modeSelect");
const semaphoreLimit = document.getElementById("semaphoreLimit");
const speedSelect = document.getElementById("speedSelect");
const startBtn = document.getElementById("startBtn");
const stepBtn = document.getElementById("stepBtn");
const addThreadBtn = document.getElementById("addThreadBtn");
const resetBtn = document.getElementById("resetBtn");
const stepModeToggle = document.getElementById("stepModeToggle");
const deadlockToggle = document.getElementById("deadlockToggle");

modeSelect.addEventListener("change", (event) => {
  engine.setMode(event.target.value);
});

semaphoreLimit.addEventListener("input", (event) => {
  engine.setSemaphorePermits(event.target.value);
});

speedSelect.addEventListener("change", (event) => {
  engine.setSpeed(event.target.value);
});

startBtn.addEventListener("click", async () => {
  await engine.start();
});

stepBtn.addEventListener("click", async () => {
  await engine.nextStep();
});

addThreadBtn.addEventListener("click", () => {
  engine.addThread();
});

resetBtn.addEventListener("click", () => {
  engine.reset();
});

stepModeToggle.addEventListener("click", () => {
  engine.toggleStepMode();
});

deadlockToggle.addEventListener("change", (event) => {
  engine.toggleDeadlock(event.target.checked);
});

window.addEventListener("resize", () => {
  renderer.render(engine.getSnapshot());
});

renderer.render(engine.getSnapshot());
