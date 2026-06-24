// ─── Backend config ──────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:3000/api';
const WS_URL   = 'ws://localhost:3000/ws';

// ─── State ───────────────────────────────────────────────────────────────────
const sensorState = {
  temperature: { value: 64 },
  vibration:   { value: 3.2 },
  humidity:    { value: 48 },
  current:     { value: 11.8 }
};

const history = {
  temperature: [],
  vibration:   [],
  humidity:    [],
  current:     []
};

let autoMode      = false;
let alertCount    = 0;
let lastPacketSec = 0;
let ws            = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await loadLatestReading();
  await loadAlertCount();
  connectWebSocket();
  drawChart();
  setInterval(simulateSensorData, 2200);
  setInterval(() => {
    if (autoMode) lastPacketSec += 2;
    document.getElementById('lastPacket').textContent = `${lastPacketSec} sec ago`;
  }, 2000);
});

// ─── WebSocket ────────────────────────────────────────────────────────────────
function connectWebSocket() {
  ws = new WebSocket(WS_URL);

  ws.onopen  = () => console.log('[WS] Connected to backend');
  ws.onclose = () => {
    console.log('[WS] Disconnected — reconnecting in 3s...');
    setTimeout(connectWebSocket, 3000);
  };
  ws.onerror = (e) => console.error('[WS] Error', e);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'NEW_READING') {
      const { reading, prediction, alert } = data;
      // Update local state from the backend's authoritative reading
      sensorState.temperature.value = reading.temperature;
      sensorState.vibration.value   = reading.vibration;
      sensorState.humidity.value    = reading.humidity;
      sensorState.current.value     = reading.current;

      enqueueHistory('temperature', reading.temperature);
      enqueueHistory('vibration',   reading.vibration);
      enqueueHistory('humidity',    reading.humidity);
      enqueueHistory('current',     reading.current);

      lastPacketSec = 0;
      updateDashboardFromPrediction(prediction);
      drawChart();

      if (alert) {
        alertCount++;
        document.getElementById('alertCount').textContent = alertCount;
        addEvent(prediction.message);
      } else {
        addEvent(prediction.message);
      }
    }

    if (data.type === 'NEW_ALERT') {
      alertCount++;
      document.getElementById('alertCount').textContent = alertCount;
      addEvent(data.alert.message);
    }
  };
}

// ─── API helpers ─────────────────────────────────────────────────────────────
async function postReading(payload) {
  try {
    const res = await fetch(`${API_BASE}/readings`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error('[API] POST /readings failed:', err);
    return null;
  }
}

async function loadLatestReading() {
  try {
    const res  = await fetch(`${API_BASE}/readings/latest`);
    if (!res.ok) return;
    const { reading, prediction } = await res.json();
    sensorState.temperature.value = reading.temperature;
    sensorState.vibration.value   = reading.vibration;
    sensorState.humidity.value    = reading.humidity;
    sensorState.current.value     = reading.current;
    updateDashboardFromPrediction(prediction);
    updateSensorCards();
  } catch (_) {}
}

async function loadAlertCount() {
  try {
    const res  = await fetch(`${API_BASE}/alerts?limit=1`);
    const data = await res.json();
    alertCount = data.total || 0;
    document.getElementById('alertCount').textContent = alertCount;
  } catch (_) {}
}

async function triggerManualAlert() {
  try {
    await fetch(`${API_BASE}/alerts`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        message:  'Sample alert generated: predictive maintenance event logged.',
        severity: 'warning',
        riskScore: 60
      })
    });
  } catch (err) {
    console.error('[API] POST /alerts failed:', err);
  }
}

// ─── Sensor simulation (sends to backend) ────────────────────────────────────
function simulateSensorData() {
  if (!autoMode) return;

  sensorState.temperature.value = clamp(sensorState.temperature.value + randomBetween(-1.8, 2.5), 28, 85);
  sensorState.vibration.value   = clamp(sensorState.vibration.value   + randomBetween(-0.7, 1.4), 0.2, 11.5);
  sensorState.humidity.value    = clamp(sensorState.humidity.value    + randomBetween(-2.5, 2.7), 18, 82);
  sensorState.current.value     = clamp(sensorState.current.value     + randomBetween(-1.1, 1.3), 4.5, 20.4);

  // POST to backend — response arrives via WebSocket broadcast
  postReading({
    temperature: sensorState.temperature.value,
    vibration:   sensorState.vibration.value,
    humidity:    sensorState.humidity.value,
    current:     sensorState.current.value
  });
}

// ─── Dashboard update ─────────────────────────────────────────────────────────
function updateSensorCards() {
  document.getElementById('temperatureValue').textContent = sensorState.temperature.value.toFixed(1);
  document.getElementById('vibrationValue').textContent   = sensorState.vibration.value.toFixed(1);
  document.getElementById('humidityValue').textContent    = sensorState.humidity.value.toFixed(1);
  document.getElementById('currentValue').textContent     = sensorState.current.value.toFixed(1);
}

function updateDashboardFromPrediction(prediction) {
  const { riskScore, healthMode, advice } = prediction;
  updateSensorCards();
  document.getElementById('failureProbability').textContent  = `${riskScore}%`;
  document.getElementById('healthStatus').textContent        = healthMode;
  document.getElementById('maintenanceAdvice').textContent   = advice;
  document.getElementById('predictionConfidence').textContent = `${100 - Math.floor((100 - riskScore) * 0.64)}%`;
  document.getElementById('lastPacket').textContent          = `0 sec ago`;
  document.getElementById('maintenanceStatus').textContent   = healthMode === 'Critical' ? 'Inspection required' : 'Stable';
  document.getElementById('alertCount').textContent          = alertCount;
}

// ─── Chart ───────────────────────────────────────────────────────────────────
function enqueueHistory(key, value) {
  history[key].push(value);
  if (history[key].length > 20) history[key].shift();
}

function drawChart() {
  const canvas = document.getElementById('trendChart');
  const ctx    = canvas.getContext('2d');
  const width  = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f4f6ff';
  ctx.fillRect(0, 0, width, height);

  const graphKeys = ['temperature', 'vibration', 'humidity', 'current'];
  const colors    = ['#ff5c78', '#2f72ff', '#37c9b6', '#f3b61b'];

  graphKeys.forEach((key, index) => {
    const values = history[key];
    if (values.length < 2) return;
    const maxVal = Math.max(...values) * 1.05;
    const minVal = Math.min(...values) * 0.95;
    const range  = maxVal - minVal || 1;

    ctx.beginPath();
    ctx.strokeStyle = colors[index];
    ctx.lineWidth   = 3;
    values.forEach((value, i) => {
      const x = (i / (values.length - 1)) * (width - 64) + 32;
      const y = height - 32 - ((value - minVal) / range) * (height - 72);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = colors[index];
    ctx.font      = '12px Inter, sans-serif';
    ctx.fillText(key.charAt(0).toUpperCase() + key.slice(1), 28, 28 + index * 18);
  });

  ctx.strokeStyle = 'rgba(54, 78, 255, 0.18)';
  ctx.lineWidth   = 1;
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(32, (height - 32) - ((height - 72) / 4) * i);
    ctx.lineTo(width - 32, (height - 32) - ((height - 72) / 4) * i);
    ctx.stroke();
  }
}

// ─── Event feed ──────────────────────────────────────────────────────────────
function addEvent(message) {
  const feed = document.getElementById('eventFeed');
  if (feed.querySelector('.event-empty')) feed.innerHTML = '';
  const li = document.createElement('li');
  li.innerHTML = `<strong>${new Date().toLocaleTimeString()}</strong> — ${message}`;
  feed.prepend(li);
  if (feed.children.length > 6) feed.removeChild(feed.lastChild);
}

// ─── Button handlers ──────────────────────────────────────────────────────────
function toggleAuto() {
  autoMode = !autoMode;
  const button = document.querySelector('.btn-primary');
  button.textContent = autoMode ? 'Pause Live Monitoring' : 'Start Live Monitoring';
  addEvent(autoMode ? 'Live monitoring activated by operator.' : 'Live monitoring paused.');
}

function generateAlertSample() {
  triggerManualAlert();
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function randomBetween(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(1));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
