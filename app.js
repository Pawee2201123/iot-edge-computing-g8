// --- Configuration ---
const DEVICE_COUNT = 5;
const UPDATE_INTERVAL_MS = 3000; // Update every 3 seconds

// Thresholds for alerts
const ACCEL_FALL_THRESHOLD = 3.5; // g (for a simulated fall event)
const TEMP_HIGH_THRESHOLD = 38.0; // °C

// Simulated Device Data Store
const deviceTelemetry = new Map(); // Stores the latest reading for each device
const chartDataHistory = []; // Stores historical data for the selected device's chart
const alertsLog = []; // Stores detected fall alerts

// Chart instance
let deviceChart;
let selectedDeviceId = 'Device-1'; // Default device to display in the chart

// --- Utility Functions ---

/**
 * Generates a random, realistic telemetry reading for a device.
 * @param {string} deviceId - The ID of the device.
 * @returns {object} The simulated telemetry data.
 */
function simulateReading(deviceId) {
    const isFallCandidate = Math.random() < 0.05; // 5% chance of a fall candidate
    const isTempHigh = Math.random() < 0.02; // 2% chance of high temp

    let accel = parseFloat((Math.random() * 0.8 + 0.8).toFixed(2)); // Base Accel: 0.8g to 1.6g (normal movement)
    let temp = parseFloat((Math.random() * 4 + 35.0).toFixed(1)); // Base Temp: 35.0°C to 39.0°C

    if (isFallCandidate) {
        // High spike in acceleration for a fall
        accel = parseFloat((Math.random() * 2 + ACCEL_FALL_THRESHOLD).toFixed(2)); // e.g., 3.5g to 5.5g
    }

    if (isTempHigh) {
        // Slightly elevated temperature
        temp = parseFloat((Math.random() * 1.0 + 38.0).toFixed(1)); // e.g., 38.0°C to 39.0°C
    }

    return {
        id: deviceId,
        accel: accel,
        temp: temp,
        timestamp: new Date(),
        isFall: accel >= ACCEL_FALL_THRESHOLD
    };
}

/**
 * Formats a Date object into a HH:MM:SS string.
 * @param {Date} date - The date to format.
 * @returns {string} The formatted time string.
 */
function formatTime(date) {
    return date.toTimeString().split(' ')[0];
}

// --- Main Update Functions ---

/**
 * 1. Simulates new data for all devices.
 * 2. Updates the deviceTelemetry map.
 * 3. Checks for alerts.
 */
function fetchDataAndProcess() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = formatTime(now);

    // Initialise devices if they don't exist
    for (let i = 1; i <= DEVICE_COUNT; i++) {
        const deviceId = `Device-${i}`;
        const newReading = simulateReading(deviceId);
        deviceTelemetry.set(deviceId, newReading);

        // Check for Fall Alert
        if (newReading.isFall) {
            const alert = {
                id: crypto.randomUUID(),
                deviceId: deviceId,
                timestamp: newReading.timestamp,
                accel: newReading.accel
            };
            alertsLog.unshift(alert); // Add to the start of the log
            // Keep only the 10 most recent alerts
            if (alertsLog.length > 10) {
                alertsLog.pop();
            }
        }
    }

    // Update chart data history for the selected device
    const selectedData = deviceTelemetry.get(selectedDeviceId);
    if (selectedData) {
        chartDataHistory.push({
            time: formatTime(selectedData.timestamp),
            accel: selectedData.accel,
            temp: selectedData.temp
        });
        // Keep chart history manageable (e.g., last 20 readings)
        if (chartDataHistory.length > 20) {
            chartDataHistory.shift();
        }
    }
}

/**
 * Updates the four statistical summary cards.
 */
function updateStatCards() {
    const readings = Array.from(deviceTelemetry.values());

    // 1. Active Devices
    document.getElementById('statDevices').textContent = readings.length;

    if (readings.length > 0) {
        // 2. Peak Accel (last 1m - simulated as all readings in the map)
        const peakAccel = Math.max(...readings.map(r => r.accel));
        document.getElementById('statPeakAccel').textContent = peakAccel.toFixed(2);

        // 3. Avg Temp (last 1m)
        const totalTemp = readings.reduce((sum, r) => sum + r.temp, 0);
        const avgTemp = totalTemp / readings.length;
        document.getElementById('statAvgTemp').textContent = avgTemp.toFixed(1);

        // 4. Fall Events (24h - simulated as total alerts in the log)
        document.getElementById('statFalls').textContent = alertsLog.length;
    }
}

/**
 * Updates the Latest Telemetry table with the deviceTelemetry map data.
 */
function updateTelemetryTable() {
    const tableBody = document.getElementById('telemetryRows');
    tableBody.innerHTML = ''; // Clear existing rows
    const readings = Array.from(deviceTelemetry.values()).sort((a, b) => a.id.localeCompare(b.id));

    readings.forEach(data => {
        const row = tableBody.insertRow();

        // 1. Device ID (make it clickable to change chart)
        const deviceCell = row.insertCell();
        deviceCell.textContent = data.id;
        deviceCell.classList.add('device-link');
        deviceCell.onclick = () => selectDeviceForChart(data.id);
        if (data.id === selectedDeviceId) {
            row.classList.add('selected-row');
        }

        // 2. Accel (g)
        const accelCell = row.insertCell();
        accelCell.textContent = data.accel.toFixed(2);
        if (data.isFall) {
            accelCell.innerHTML += ' <span class="badge crit blink">FALL!</span>';
        }

        // 3. Temp (°C)
        const tempCell = row.insertCell();
        tempCell.textContent = data.temp.toFixed(1);
        if (data.temp >= TEMP_HIGH_THRESHOLD) {
            tempCell.classList.add('warning-text');
        }

        // 4. Updated
        row.insertCell().textContent = formatTime(data.timestamp);

        // 5. Fall Status
        const statusCell = row.insertCell();
        statusCell.innerHTML = `<span class="badge ${data.isFall ? 'crit' : 'ok'}">${data.isFall ? 'CRITICAL' : 'NORMAL'}</span>`;
    });
}

/**
 * Updates the Fall Alerts panel with the alertsLog data.
 */
function updateAlertsPanel() {
    const alertsList = document.getElementById('alertsList');
    alertsList.innerHTML = ''; // Clear existing alerts

    if (alertsLog.length === 0) {
        alertsList.innerHTML = '<p class="no-alerts">No fall alerts detected recently.</p>';
        return;
    }

    alertsLog.forEach(alert => {
        const alertElement = document.createElement('div');
        alertElement.classList.add('alert', 'crit');
        alertElement.innerHTML = `
            <div class="alert-header">
                <span class="alert-icon">⚠️</span>
                <strong>FALL DETECTED!</strong> on ${alert.deviceId}
            </div>
            <div class="alert-details">
                <span class="detail-time">${formatTime(alert.timestamp)}</span>
                <span class="detail-accel">Peak Accel: ${alert.accel.toFixed(2)} g</span>
            </div>
        `;
        alertsList.appendChild(alertElement);
    });
}

/**
 * Initialises and updates the Chart.js chart.
 */
function updateChart() {
    if (!deviceChart) {
        initialiseChart();
    }

    const labels = chartDataHistory.map(d => d.time);
    const accelData = chartDataHistory.map(d => d.accel);
    const tempData = chartDataHistory.map(d => d.temp);

    deviceChart.data.labels = labels;
    deviceChart.data.datasets[0].data = accelData;
    deviceChart.data.datasets[1].data = tempData;

    // Update chart title to show selected device
    deviceChart.options.plugins.title.text = `Telemetry for ${selectedDeviceId}`;

    deviceChart.update();
}

/**
 * Main function to run all update logic.
 */
function runDashboardUpdate() {
    fetchDataAndProcess();
    updateStatCards();
    updateTelemetryTable();
    updateAlertsPanel();
    updateChart();
}


// --- Chart Initialisation ---

function initialiseChart() {
    const ctx = document.getElementById('chart').getContext('2d');
    deviceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Acceleration (g)',
                data: [],
                yAxisID: 'yAccel',
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.4,
                pointRadius: 3
            }, {
                label: 'Temperature (°C)',
                data: [],
                yAxisID: 'yTemp',
                borderColor: 'rgba(54, 162, 235, 1)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                tension: 0.4,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Telemetry for ${selectedDeviceId}`,
                    font: { size: 16 }
                },
                legend: {
                    position: 'bottom',
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Time' }
                },
                yAccel: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Accel (g)' },
                    suggestedMin: 0,
                    suggestedMax: 6,
                    grid: { drawOnChartArea: false } // Only draw grid for the primary axis
                },
                yTemp: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Temp (°C)' },
                    suggestedMin: 30,
                    suggestedMax: 40,
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

/**
 * Changes the device whose data is displayed in the chart.
 * @param {string} deviceId - The new device ID to select.
 */
function selectDeviceForChart(deviceId) {
    if (selectedDeviceId !== deviceId) {
        selectedDeviceId = deviceId;
        chartDataHistory.length = 0; // Clear old device data
        // Trigger a table update to highlight the new selection
        updateTelemetryTable();
        // The chart will update on the next runDashboardUpdate cycle
    }
}


// --- Initialisation and Start ---

/**
 * Code to run when the document is fully loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialise the chart (requires Chart.js script to be loaded)
    // NOTE: Ensure you have loaded Chart.js in your HTML:
    // <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    initialiseChart();

    // 2. Run the update loop immediately and then set the interval
    runDashboardUpdate();
    setInterval(runDashboardUpdate, UPDATE_INTERVAL_MS);

    console.log(`IoT Dashboard Initialized with ${DEVICE_COUNT} simulated devices.`);
});