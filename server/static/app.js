// =====================
// HYBRID app.js (Socket.IO Version)
// =====================

const socket = io();

// State
const devices = new Map(); // Stores latest state for each device
const alerts = [];

// DOM Elements
const elStatus = document.getElementById("systemStatus");
const elLastUpdate = document.getElementById("lastUpdate");

// --- 1. SOCKET LISTENERS ---

socket.on('connect', () => {
    setStatus("ok", "CONNECTED");
});

socket.on('disconnect', () => {
    setStatus("crit", "DISCONNECTED");
});

// Handle "HEARTBEAT" or "STATUS" messages
socket.on('status', (data) => {
    updateDeviceState(data);
    updateUI();
});

// Handle "ALERTS" (Fall or Help Button)
socket.on('alert', (msg) => {
    const data = msg.data;
    const type = msg.type; // "FALL" or "HELP"

    // 1. Play Sound
    try {
        new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play();
    } catch(e) {}

    // 2. Add to Alert List
    const alertObj = {
        type: type,
        device: data.unit_id || "Unknown",
        val: type === 'FALL' ? `${data.g_force.toFixed(2)} G` : "BUTTON PRESS",
        time: new Date()
    };
    alerts.unshift(alertObj);
    if (alerts.length > 50) alerts.pop();

    // 3. Update Device State (Mark as Critical)
    updateDeviceState({
        unit_id: data.unit_id,
        status: type === 'FALL' ? 'CRITICAL' : 'HELP NEEDED',
        battery: data.battery || '--' // Alert payloads might not have battery
    });

    renderAlerts();
});

// --- 2. LOGIC ---

function setStatus(kind, text) {
    elStatus.className = `badge ${kind}`;
    elStatus.textContent = text;
}

function updateDeviceState(data) {
    const id = data.unit_id || "Unknown";
    const now = new Date();
    elLastUpdate.textContent = now.toLocaleTimeString();

    // Merge new data with old data
    const old = devices.get(id) || {};
    devices.set(id, {
        id: id,
        type: id.includes("Belt") ? "Fall Detector" : (id.includes("Bedside") ? "Comm Unit" : "Sensor"),
        status: data.status || old.status || "Active",
        battery: data.battery || old.battery || "--",
        temp: data.temp || old.temp || "-",
        g_force: data.g_force || old.g_force || 0,
        lastSeen: now
    });
}

function updateUI() {
    // A. Update Cards
    const deviceList = Array.from(devices.values());
    document.getElementById("statDevices").textContent = deviceList.length;

    // Find latest G-Force from any device
    const maxG = Math.max(...deviceList.map(d => d.g_force || 0));
    document.getElementById("statPeakAccel").textContent = maxG > 0 ? maxG.toFixed(2) : "-";

    // Find Temp
    const tempDev = deviceList.find(d => d.temp !== "-");
    document.getElementById("statAvgTemp").textContent = tempDev ? tempDev.temp : "-";

    // B. Update Table
    const tbody = document.getElementById("telemetryRows");
    tbody.innerHTML = "";
    
    deviceList.forEach(d => {
        const tr = document.createElement("tr");
        
        let statusBadge = "ok";
        if(d.status.includes("CRITICAL") || d.status.includes("HELP")) statusBadge = "crit";
        
        tr.innerHTML = `
            <td class="deviceLink">${d.id}</td>
            <td>${d.type}</td>
            <td>${d.lastSeen.toLocaleTimeString()}</td>
            <td>${d.battery} V</td>
            <td><span class="badge ${statusBadge}">${d.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderAlerts() {
    const box = document.getElementById("alertsList");
    box.innerHTML = "";

    alerts.forEach(a => {
        const el = document.createElement("div");
        el.className = "alert"; // Uses your friend's CSS class
        el.innerHTML = `
            <div class="alertTop">
                <div class="alertTitle">⚠ ${a.type} DETECTED</div>
                <div class="alertMeta">${a.time.toLocaleTimeString()}</div>
            </div>
            <div class="alertMeta">Device: <strong>${a.device}</strong></div>
            <div class="alertMeta">Value: <strong>${a.val}</strong></div>
        `;
        box.appendChild(el);
    });
}
