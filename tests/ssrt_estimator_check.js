// Monte Carlo check that the SSRT estimator recovers a known SSRT.
// It pulls quantileType6 directly out of index.html, so it tests the exact
// code the task uses, and reimplements the staircase and integration steps.
//
// Run from the repository root:  node tests/ssrt_estimator_check.js
// Expected: mean estimate within about 10 ms of the true SSRT (200 ms).

const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const match = html.match(/function quantileType6[\s\S]*?\n  }\n/);
if (!match) throw new Error("quantileType6 not found in index.html");
const quantileType6 = eval("(" + match[0] + ")");

const TRUE_SSRT = 200;
const SESSIONS = 5000;

function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Ex-Gaussian go RTs, which have the right-skewed shape of real RT data.
const goRt = () => 380 + 50 * gauss() - 80 * Math.log(Math.random());
const stopLatency = () => TRUE_SSRT + 20 * gauss();

function simulateSession() {
  // Matches the default design: 150 go and 50 stop trials for one rule.
  const trials = [...Array(150).fill("go"), ...Array(50).fill("stop")].sort(() => Math.random() - 0.5);
  let ssd = 250;
  const go = [];
  const stop = [];

  for (const type of trials) {
    const rt = goRt();
    if (type === "go") {
      go.push(rt < 1500 ? rt : null);   // null = omission
      continue;
    }
    const responded = rt < ssd + stopLatency();
    stop.push({ ssd, responded });
    ssd = Math.min(1000, Math.max(50, ssd + (responded ? -50 : 50)));
  }

  const rts = go.filter((x) => x !== null);
  const omissions = go.length - rts.length;
  const pRespond = stop.filter((s) => s.responded).length / stop.length;
  const dist = rts.concat(Array(omissions).fill(Math.max(...rts))).sort((a, b) => a - b);
  const meanSsd = stop.reduce((a, s) => a + s.ssd, 0) / stop.length;
  return { ssrt: quantileType6(dist, pRespond) - meanSsd, pRespond };
}

const results = Array.from({ length: SESSIONS }, simulateSession);
const est = results.map((r) => r.ssrt);
const mean = est.reduce((a, b) => a + b, 0) / est.length;
const sd = Math.sqrt(est.reduce((a, b) => a + (b - mean) ** 2, 0) / est.length);
const meanP = results.reduce((a, r) => a + r.pRespond, 0) / results.length;

console.log(`True SSRT: ${TRUE_SSRT} ms`);
console.log(`Mean estimate: ${mean.toFixed(1)} ms (SD across sessions ${sd.toFixed(1)} ms)`);
console.log(`Mean P(respond | signal): ${meanP.toFixed(3)}`);

if (Math.abs(mean - TRUE_SSRT) > 10) {
  console.error("FAILED: estimate is more than 10 ms from the true SSRT");
  process.exit(1);
}
console.log("PASSED");
