# IoT Edge Machine Health Monitor — Backend

Node.js + Express + MongoDB backend for the IoT Edge Health Monitor frontend.

---

## Stack
- **Runtime**: Node.js
- **Framework**: Express
- **Database**: MongoDB (via Mongoose)
- **Real-time**: WebSocket (`ws`)

---

## Project Structure

```
iot-backend/
├── models/
│   ├── SensorReading.js   # Sensor data schema
│   └── Alert.js           # Alert schema
├── routes/
│   ├── readings.js        # POST/GET sensor readings
│   └── alerts.js          # GET/POST/DELETE alerts
├── services/
│   └── prediction.js      # Risk scoring & health logic (server-side)
├── server.js              # Entry point — Express + WebSocket
├── script.js              # Updated frontend script (replace your old one)
├── .env                   # Environment config
└── package.json
```

---

## Setup

### 1. Prerequisites
- Node.js v18+
- MongoDB running locally (`mongod`) or a MongoDB Atlas URI

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
Edit `.env`:
```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/iot_monitor
```

For MongoDB Atlas:
```env
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxx.mongodb.net/iot_monitor
```

### 4. Start the server
```bash
npm start
# or with auto-reload:
npx nodemon server.js
```

### 5. Update your frontend
Replace your old `script.js` with the new `script.js` from this folder.
Make sure `index.html` still points to `script.js` — no other HTML changes needed.

---

## API Reference

### Health Check
```
GET /health
```

### Sensor Readings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/readings` | Ingest a new sensor packet |
| `GET`  | `/api/readings` | Paginated history (`?limit=20&page=1`) |
| `GET`  | `/api/readings/latest` | Most recent reading + prediction |
| `GET`  | `/api/readings/stats` | Aggregated stats (`?hours=24`) |

**POST body:**
```json
{
  "temperature": 67.3,
  "vibration": 4.1,
  "humidity": 52.0,
  "current": 12.8
}
```

**Response:**
```json
{
  "reading": { ... },
  "prediction": {
    "riskScore": 42,
    "healthMode": "Nominal",
    "advice": "Continue monitoring at edge",
    "message": "Machine operating within normal edge thresholds."
  }
}
```

### Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/api/alerts` | List alerts (`?limit=20&severity=critical`) |
| `POST`   | `/api/alerts` | Manually create an alert |
| `DELETE` | `/api/alerts` | Clear all alerts |

---

## WebSocket

Connect to `ws://localhost:3000/ws`

**Events received from server:**
```json
{ "type": "CONNECTED",    "message": "..." }
{ "type": "NEW_READING",  "reading": {...}, "prediction": {...}, "alert": {...} }
{ "type": "NEW_ALERT",    "alert": {...} }
```

The frontend automatically reconnects if the WebSocket drops.

---

## How it works

1. Frontend simulates sensor data every ~2.2 seconds when Live Monitoring is active
2. Each reading is **POST**ed to `/api/readings`
3. Backend scores risk, saves to MongoDB, and **broadcasts** the result via WebSocket
4. Frontend updates the dashboard from the WebSocket push (not from the HTTP response)
5. All history, alerts, and stats persist in MongoDB across page refreshes
