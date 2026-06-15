const express  = require('express');
const router   = express.Router();
const SensorReading = require('../models/SensorReading');
const Alert    = require('../models/Alert');
const {
  computeRiskScore,
  computeHealthMode,
  maintenanceAdvice,
  alertSeverity,
  eventMessage,
} = require('../services/prediction');

/**
 * POST /api/readings
 * Ingest a new sensor reading from the edge device.
 * Body: { temperature, vibration, humidity, current }
 */
router.post('/', async (req, res) => {
  try {
    const { temperature, vibration, humidity, current } = req.body;

    // Validate required fields
    if ([temperature, vibration, humidity, current].some(v => v == null || isNaN(v))) {
      return res.status(400).json({ error: 'Missing or invalid sensor fields.' });
    }

    const riskScore  = computeRiskScore({ temperature, vibration, humidity, current });
    const healthMode = computeHealthMode(riskScore);

    // Persist reading
    const reading = await SensorReading.create({
      temperature, vibration, humidity, current,
      riskScore, healthMode
    });

    // Persist alert if above info threshold
    const severity = alertSeverity(riskScore);
    let alert = null;
    if (severity !== 'info' || riskScore >= 30) {
      alert = await Alert.create({
        message: eventMessage(riskScore),
        severity,
        riskScore,
        sensorData: { temperature, vibration, humidity, current }
      });
    }

    // Broadcast to WebSocket clients
    const wsPayload = JSON.stringify({
      type: 'NEW_READING',
      reading,
      alert,
      prediction: {
        riskScore,
        healthMode,
        advice: maintenanceAdvice(riskScore),
        message: eventMessage(riskScore),
      }
    });
    req.app.locals.broadcast(wsPayload);

    res.status(201).json({
      reading,
      prediction: {
        riskScore,
        healthMode,
        advice: maintenanceAdvice(riskScore),
        message: eventMessage(riskScore),
      }
    });
  } catch (err) {
    console.error('POST /readings error:', err);
    res.status(500).json({ error: 'Server error saving reading.' });
  }
});

/**
 * GET /api/readings
 * Fetch paginated sensor history.
 * Query: ?limit=20&page=1
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip  = (Math.max(parseInt(req.query.page) || 1, 1) - 1) * limit;

    const [readings, total] = await Promise.all([
      SensorReading.find().sort({ timestamp: -1 }).skip(skip).limit(limit),
      SensorReading.countDocuments()
    ]);

    res.json({ readings, total, page: Math.floor(skip / limit) + 1, limit });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch readings.' });
  }
});

/**
 * GET /api/readings/latest
 * Returns the single most recent reading + prediction.
 */
router.get('/latest', async (req, res) => {
  try {
    const reading = await SensorReading.findOne().sort({ timestamp: -1 });
    if (!reading) return res.status(404).json({ error: 'No readings yet.' });

    res.json({
      reading,
      prediction: {
        riskScore:  reading.riskScore,
        healthMode: reading.healthMode,
        advice:     maintenanceAdvice(reading.riskScore),
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch latest reading.' });
  }
});

/**
 * GET /api/readings/stats
 * Returns aggregated stats: averages, min/max, alert counts.
 */
router.get('/stats', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [agg, alertCounts] = await Promise.all([
      SensorReading.aggregate([
        { $match: { timestamp: { $gte: since } } },
        {
          $group: {
            _id: null,
            avgTemp:     { $avg: '$temperature' },
            avgVibe:     { $avg: '$vibration' },
            avgHumidity: { $avg: '$humidity' },
            avgCurrent:  { $avg: '$current' },
            avgRisk:     { $avg: '$riskScore' },
            maxTemp:     { $max: '$temperature' },
            maxVibe:     { $max: '$vibration' },
            maxRisk:     { $max: '$riskScore' },
            count:       { $sum: 1 }
          }
        }
      ]),
      Alert.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ])
    ]);

    const stats    = agg[0] || {};
    const alerts   = Object.fromEntries(alertCounts.map(a => [a._id, a.count]));

    res.json({ period: `${hours}h`, stats, alerts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute stats.' });
  }
});

module.exports = router;
