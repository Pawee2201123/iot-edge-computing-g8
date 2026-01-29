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
                type: id.includes("Belt") ? "Fall Detector" : (id.includes("Env") ? "Env Monitor" : "Comm Unit"),
                status: data.status || old.status || "Active",
                battery: data.battery || old.battery || "--",
                temp: data.temp || old.temp || "-",
                humidity: data.humidity || old.humidity || "-", // <--- NEW
                g_force: data.g_force || old.g_force || 0,
                lastSeen: now
        });
}

function updateUI() {
    // A. Update Cards (Top of Dashboard)
    const deviceList = Array.from(devices.values());
    document.getElementById("statDevices").textContent = deviceList.length;


    // Find Temp
    const tempDev = deviceList.find(d => d.temp !== "-" && d.temp !== undefined);
    document.getElementById("statAvgTemp").textContent = tempDev ? tempDev.temp : "-";

    // Find Humidity
    const humDev = deviceList.find(d => d.humidity !== "-" && d.humidity !== undefined);
    document.getElementById("statAvgHum").textContent = humDev ? humDev.humidity : "-";


    // B. Update Table (Device List)
    const tbody = document.getElementById("telemetryRows");
    tbody.innerHTML = "";

    devices.forEach(d => {
        const tr = document.createElement("tr");
        
        // 1. FORMAT BATTERY (Voltage -> Percentage Bar)
        let batDisplay = '<span style="color:#ccc; font-size:0.9em;">Waiting...</span>';
        
        if (d.battery && d.battery !== "--") {
            const voltage = parseFloat(d.battery);
            
            // Linear Approximation: 3.2V (0%) to 4.2V (100%)
            let percent = Math.round(((voltage - 3.2) / (4.2 - 3.2)) * 100);
            
            // Safety Clamp (keep it between 0-100)
            if (percent > 100) percent = 100;
            if (percent < 0) percent = 0;

            // Determine Color based on health
            let color = "#28a745"; // Green (Healthy)
            if (percent < 40) color = "#ffc107"; // Yellow (Warning)
            if (percent < 20) color = "#dc3545"; // Red (Critical)

            // Build the HTML Bar
            batDisplay = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="width:30px; height:10px; background:#eee; border-radius:2px; border:1px solid #999;">
                        <div style="width:${percent}%; height:100%; background:${color};"></div>
                    </div>
                    <span style="font-weight:bold; font-size: 0.9em; color:#333;">${percent}%</span>
                </div>
            `;
        }

        // 2. SET STATUS BADGE COLOR
        let statusBadge = "badge-success"; 
        if (d.status === "OFFLINE") statusBadge = "badge-offline"; 
        else if (d.status === "CRITICAL" || d.status === "HELP NEEDED") statusBadge = "badge-danger"; 

        // 3. BUILD THE TABLE ROW
        tr.innerHTML = `
            <td class="deviceLink">${d.id}</td>
            <td>${d.type}</td>
            <td>${batDisplay}</td>
            <td>${d.lastSeen.toLocaleTimeString()}</td>
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
// --- 3. SEND MESSAGES ---

function sendMsg(color) {
        const input = document.getElementById("msgInput");
        const text = input.value;

        if (!text) {
                alert("Please type a message first!");
                return;
        }

        // Emit event to Python Server
        socket.emit('send_message', {
                msg: text,
                color: color
        });

        // Clear input
        input.value = "";

        // Show "Sent!" feedback briefly
        const status = document.getElementById("msgStatus");
        status.style.opacity = "1";
        setTimeout(() => { status.style.opacity = "0"; }, 2000);
}
// --- 4. WATCHDOG (The Zombie Fix) ---
// Run this check every 1 second
setInterval(() => {
    const now = new Date();
    let needsUpdate = false;

    devices.forEach((data, id) => {
        // Calculate seconds since last message
        const diffSeconds = (now - data.lastSeen) / 1000;

        // If silent for > 40 seconds (Heartbeat is 30s), mark OFFLINE
        if (diffSeconds > 40 && data.status !== "OFFLINE") {
            data.status = "OFFLINE";
            data.battery = "--"; // Clear battery if unknown
            needsUpdate = true;
        }
    });

    // Only redraw the screen if something changed
    if (needsUpdate) {
        updateUI();
    }
}, 1000);

// =====================
// 5. HISTORICAL DATA & ANALYTICS
// =====================

let envChart = null;
let currentChartData = [];

// Initialize Chart.js on page load
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    refreshStats();
    updateCharts();
    updateHistory();

    // Auto-refresh charts every 30 seconds
    setInterval(() => {
        updateCharts();
        checkThresholds();
    }, 30000);

    // Auto-refresh history every 60 seconds
    setInterval(updateHistory, 60000);

    // Monitor threshold changes
    document.getElementById('tempThreshold').addEventListener('input', checkThresholds);
    document.getElementById('humThreshold').addEventListener('input', checkThresholds);
});

function initChart() {
    const ctx = document.getElementById('envChart');
    if (!ctx) return;

    envChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: [],
                    borderColor: '#ff6384',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    yAxisID: 'y',
                    tension: 0.4
                },
                {
                    label: 'Humidity (%)',
                    data: [],
                    borderColor: '#36a2eb',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    yAxisID: 'y1',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            // Format timestamp
                            return new Date(context[0].label).toLocaleString();
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time'
                    },
                    ticks: {
                        callback: function(value, index) {
                            const date = new Date(this.getLabelForValue(value));
                            return date.toLocaleTimeString();
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Humidity (%)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

async function updateCharts() {
    const hours = document.getElementById('chartTimeRange').value;

    try {
        const response = await fetch(`/api/heat/history?hours=${hours}&limit=100`);
        const result = await response.json();

        if (!result.success || !result.data || result.data.length === 0) {
            console.log('No chart data available yet');
            return;
        }

        // Sort by time (oldest first for proper chart display)
        const data = result.data.reverse();
        currentChartData = data;

        const labels = data.map(d => d.time);
        const temps = data.map(d => d.temp);
        const hums = data.map(d => d.humidity);

        envChart.data.labels = labels;
        envChart.data.datasets[0].data = temps;
        envChart.data.datasets[1].data = hums;
        envChart.update();

    } catch (error) {
        console.error('Error fetching chart data:', error);
    }
}

async function refreshStats() {
    try {
        const response = await fetch('/api/stats');
        const result = await response.json();

        if (!result.success) {
            console.error('Failed to fetch stats');
            return;
        }

        const stats = result.data;

        // Update statistics display
        document.getElementById('stat-avg-temp').textContent =
            stats.temp.avg ? `${stats.temp.avg}°C` : '--';
        document.getElementById('stat-min-temp').textContent =
            stats.temp.min ? `${stats.temp.min}°C` : '--';
        document.getElementById('stat-max-temp').textContent =
            stats.temp.max ? `${stats.temp.max}°C` : '--';
        document.getElementById('stat-avg-hum').textContent =
            stats.humidity.avg ? `${stats.humidity.avg}%` : '--';
        document.getElementById('stat-readings').textContent = stats.temp.readings;
        document.getElementById('stat-emergencies').textContent = stats.events.emergencies;
        document.getElementById('stat-messages').textContent = stats.events.messages;

    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

async function updateHistory() {
    const hours = document.getElementById('historyTimeRange').value;
    const filter = document.getElementById('eventFilter').value;
    const emergOnly = filter === 'emerg' ? 'true' : 'false';

    try {
        const response = await fetch(`/api/commu/history?hours=${hours}&emerg_only=${emergOnly}&limit=100`);
        const result = await response.json();

        const tbody = document.getElementById('historyRows');

        if (!result.success) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#d64541;">Error loading history</td></tr>';
            return;
        }

        if (result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px;">No events found in this time range</td></tr>';
            return;
        }

        tbody.innerHTML = '';

        result.data.forEach(event => {
            const tr = document.createElement('tr');
            if (event.emerg) {
                tr.className = 'emergency';
            }

            const time = new Date(event.time).toLocaleString();
            const badgeClass = event.emerg ? 'emergency' : 'message';
            const badgeText = event.emerg ? '🚨 EMERGENCY' : '💬 Message';

            tr.innerHTML = `
                <td>${time}</td>
                <td><span class="event-badge ${badgeClass}">${badgeText}</span></td>
                <td>${event.msg || 'N/A'}</td>
            `;

            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error fetching history:', error);
        document.getElementById('historyRows').innerHTML =
            '<tr><td colspan="3" style="text-align:center; color:#d64541;">Failed to load history</td></tr>';
    }
}

function checkThresholds() {
    if (currentChartData.length === 0) return;

    const tempThreshold = parseFloat(document.getElementById('tempThreshold').value);
    const humThreshold = parseFloat(document.getElementById('humThreshold').value);

    // Get latest reading
    const latest = currentChartData[currentChartData.length - 1];
    if (!latest) return;

    const alertDiv = document.getElementById('thresholdAlert');
    const alerts = [];

    if (latest.temp > tempThreshold) {
        alerts.push(`⚠️ High temperature: ${latest.temp}°C (threshold: ${tempThreshold}°C)`);
    }

    if (latest.humidity > humThreshold) {
        alerts.push(`⚠️ High humidity: ${latest.humidity}% (threshold: ${humThreshold}%)`);
    }

    if (alerts.length > 0) {
        alertDiv.className = 'threshold-status alert';
        alertDiv.textContent = alerts.join(' | ');
    } else {
        alertDiv.className = 'threshold-status';
        alertDiv.textContent = '✓ All readings within normal range';
        alertDiv.style.background = 'var(--ok-bg)';
        alertDiv.style.color = 'var(--ok)';
        alertDiv.style.border = '1px solid var(--ok-b)';
    }
}
