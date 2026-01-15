// =====================
// FINAL app.js (API version)
// =====================

// ====== CONFIG ======
const API_URL = "http://YOUR_NODE_RED_HOST:1880/api/telemetry/latest"; // <-- change this
const POLL_MS = 2000;

const MAX_POINTS = 60;            // chart window length per device
const ALERT_KEEP = 10;            // keep last 10 fall alerts
const ACCEL_FALL_THRESHOLD = 3.5; // used if API doesn't provide fall flag/index

// ====== STATE ======
const latestByDevice = new Map();   // deviceId -> { deviceId, t, a, temp, isFall }
const historyByDevice = new Map();  // deviceId -> array of { t, a, temp, isFall }
const alerts = [];                  // array of { deviceId, t, a }
let selectedDeviceId = "Device-1";
let chart;

// ====== HELPERS ======
function fmtTime(d) {
  return new Date(d).toTimeString().split(" ")[0];
}

function setStatus(kind, text) {
  const el = document.getElementById("systemStatus");
  el.className = `badge ${kind}`;
  el.textContent = text;
}

function normalizePayload(payload) {
  return Array.isArray(payload) ? payload : [payload];
}

// ====== ADAPTER (Friend API -> Your dashboard raw format) ======
// Your dashboard wants: { deviceId, t, a, temp, fall }
function adaptFriendReading(x) {
  // 1) device id
  const deviceId = x.deviceId ?? x.id ?? x.device ?? x.dev ?? "Device-1";

  // 2) time
  const tRaw = x.t ?? x.time ?? x.timestamp ?? x.ts ?? x.datetime ?? Date.now();
  const t = new Date(tRaw);

  // 3) acceleration (choose one)
  // If API provides magnitude:
  const aDirect =
    x.a ?? x.accel ?? x.acceleration ?? x.g ?? x.accel_g ?? x.accelG ?? x.magnitude;

  let a;
  if (aDirect !== undefined) {
    a = Number(aDirect);
  } else if (x.ax !== undefined && x.ay !== undefined && x.az !== undefined) {
    // If API provides ax/ay/az, compute magnitude
    const ax = Number(x.ax), ay = Number(x.ay), az = Number(x.az);
    a = Math.sqrt(ax * ax + ay * ay + az * az);
  } else {
    a = NaN; // if missing
  }

  // 4) temperature
  const tempRaw = x.temp ?? x.temperature ?? x.tempC ?? x.temperatureC ?? x.tC;
  const temp = Number(tempRaw);

  // 5) fall flag/index
  // supports: fall, isFall, accidentIndex, fallIndex, status
  const fallRaw =
    x.fall ?? x.isFall ?? x.accidentIndex ?? x.fallIndex ?? x.fall_score ?? 0;

  // Convert fallRaw into boolean:
  // - if it's boolean, keep
  // - if number, >0 is fall
  // - if string "FALL"/"CRITICAL", treat as fall
  let fall;
  if (typeof fallRaw === "boolean") fall = fallRaw;
  else if (typeof fallRaw === "number") fall = fallRaw > 0;
  else if (typeof fallRaw === "string") fall = /fall|crit|critical|true|1/i.test(fallRaw);
  else fall = false;

  return { deviceId, t, a, temp, fall };
}

// ====== INGEST ======
function ingestReading(raw) {
  const deviceId = raw.deviceId;
  const t = raw.t;
  const a = Number(raw.a);
  const temp = Number(raw.temp);

  // Determine isFall:
  // Prefer API fall flag; fallback to accel threshold if accel is valid
  const isFall = raw.fall === true || (Number.isFinite(a) && a >= ACCEL_FALL_THRESHOLD);

  // latest snapshot for table
  latestByDevice.set(deviceId, { deviceId, t, a, temp, isFall });

  // history for chart
  if (!historyByDevice.has(deviceId)) historyByDevice.set(deviceId, []);
  const h = historyByDevice.get(deviceId);
  h.push({ t, a, temp, isFall });
  if (h.length > MAX_POINTS) h.shift();

  // alerts list
  if (isFall) {
    alerts.unshift({ deviceId, t, a });
    if (alerts.length > ALERT_KEEP) alerts.pop();
  }

  // Ensure selectedDevice exists
  if (!selectedDeviceId || !latestByDevice.has(selectedDeviceId)) {
    selectedDeviceId = deviceId;
  }
}

// ====== STATS ======
function computeStats() {
  const devices = latestByDevice.size;

  // compute in the "window" of selected device
  const h = historyByDevice.get(selectedDeviceId) || [];
  if (h.length === 0) return { devices, peakAccel: NaN, avgTemp: NaN, falls: 0 };

  const peakAccel = Math.max(...h.map(p => p.a).filter(Number.isFinite));
  const avgTemp = h
    .map(p => p.temp)
    .filter(Number.isFinite)
    .reduce((s, v, _, arr) => s + v / arr.length, 0);

  const falls = h.filter(p => p.isFall).length;

  return { devices, peakAccel, avgTemp, falls };
}

// ====== RENDER ======
function renderStats() {
  const s = computeStats();
  document.getElementById("statDevices").textContent = s.devices;
  document.getElementById("statPeakAccel").textContent =
    Number.isFinite(s.peakAccel) ? s.peakAccel.toFixed(2) : "-";
  document.getElementById("statAvgTemp").textContent =
    Number.isFinite(s.avgTemp) ? s.avgTemp.toFixed(1) : "-";
  document.getElementById("statFalls").textContent = s.falls;
}

function renderTable() {
  const tbody = document.getElementById("telemetryRows");
  tbody.innerHTML = "";

  const rows = Array.from(latestByDevice.values())
    .sort((a, b) => a.deviceId.localeCompare(b.deviceId));

  rows.forEach(d => {
    const tr = document.createElement("tr");
    if (d.deviceId === selectedDeviceId) tr.classList.add("selected");

    const tdDev = document.createElement("td");
    tdDev.textContent = d.deviceId;
    tdDev.className = "deviceLink";
    tdDev.onclick = () => {
      selectedDeviceId = d.deviceId;
      document.getElementById("selectedDevice").textContent = selectedDeviceId;
      renderTable();
      renderStats();
      renderChart();
    };

    const tdA = document.createElement("td");
    tdA.innerHTML =
      Number.isFinite(d.a)
        ? `${d.a.toFixed(2)}${d.isFall ? ' <span class="badge crit">FALL</span>' : ""}`
        : `-`;

    const tdT = document.createElement("td");
    tdT.textContent = Number.isFinite(d.temp) ? d.temp.toFixed(1) : "-";

    const tdTime = document.createElement("td");
    tdTime.textContent = fmtTime(d.t);

    const tdFall = document.createElement("td");
    tdFall.innerHTML = `<span class="badge ${d.isFall ? "crit" : "ok"}">${d.isFall ? "CRITICAL" : "NORMAL"}</span>`;

    tr.append(tdDev, tdA, tdT, tdTime, tdFall);
    tbody.appendChild(tr);
  });

  document.getElementById("selectedDevice").textContent = selectedDeviceId;
}

function renderAlerts() {
  const box = document.getElementById("alertsList");
  box.innerHTML = "";

  if (alerts.length === 0) {
    box.innerHTML = `<div class="small">No fall alerts recently.</div>`;
    return;
  }

  alerts.forEach(a => {
    const el = document.createElement("div");
    el.className = "alert";
    el.innerHTML = `
      <div class="alertTop">
        <div class="alertTitle">⚠ FALL DETECTED</div>
        <div class="alertMeta">${fmtTime(a.t)}</div>
      </div>
      <div class="alertMeta">Device: <strong>${a.deviceId}</strong></div>
      <div class="alertMeta">Peak accel: <strong>${Number.isFinite(a.a) ? a.a.toFixed(2) : "-"} g</strong></div>
    `;
    box.appendChild(el);
  });
}

function ensureChart() {
  if (chart) return;

  const ctx = document.getElementById("chart").getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "Acceleration (g)", data: [], yAxisID: "yA", tension: 0.35, pointRadius: 2 },
        { label: "Temperature (°C)", data: [], yAxisID: "yT", tension: 0.35, pointRadius: 2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        title: { display: true, text: "Telemetry" }
      },
      scales: {
        x: { title: { display: true, text: "Time" } },
        yA: { type: "linear", position: "left", title: { display: true, text: "Accel (g)" }, suggestedMin: 0, suggestedMax: 6 },
        yT: { type: "linear", position: "right", title: { display: true, text: "Temp (°C)" }, suggestedMin: 30, suggestedMax: 40, grid: { drawOnChartArea: false } }
      }
    }
  });
}

function renderChart() {
  ensureChart();
  const h = historyByDevice.get(selectedDeviceId) || [];

  chart.data.labels = h.map(p => fmtTime(p.t));
  chart.data.datasets[0].data = h.map(p => p.a);
  chart.data.datasets[1].data = h.map(p => p.temp);
  chart.options.plugins.title.text = `Telemetry for ${selectedDeviceId}`;
  chart.update();
}

// ====== POLL API ======
async function pollOnce() {
  const now = new Date();
  document.getElementById("lastUpdate").textContent = fmtTime(now);

  try {
    const res = await fetch(API_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();

    setStatus("ok", "OK");

    const items = normalizePayload(payload);
    items.forEach(item => {
      const raw = adaptFriendReading(item);
      ingestReading(raw);
    });

    renderStats();
    renderTable();
    renderAlerts();
    renderChart();

  } catch (e) {
    console.error("API fetch failed:", e);
    setStatus("crit", "API ERROR");
  }
}

// ====== START ======
document.addEventListener("DOMContentLoaded", () => {
  setStatus("ok", "OK");
  document.getElementById("selectedDevice").textContent = selectedDeviceId;

  pollOnce();
  setInterval(pollOnce, POLL_MS);
});
