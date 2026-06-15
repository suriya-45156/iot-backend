const express = require('express');
const router  = express.Router();
const Alert   = require('../models/Alert');

/**
 * GET /api/alerts
 * Fetch recent alerts, newest first.
 * Query: ?limit=20&severity=critical
 */
router.get('/', async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit) || 20, 100);
    const filter   = {};
    if (req.query.severity) filter.severity = req.query.severity;

    const [alerts, total] = await Promise.all([
      Alert.find(filter).sort({ timestamp: -1 }).limit(limit),
      Alert.countDocuments(filter)
    ]);

    res.json({ alerts, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts.' });
  }
});

/**
 * POST /api/alerts
 * Manually trigger a sample alert (mirrors frontend generateAlertSample).
 */
router.post('/', async (req, res) => {
  try {
    const alert = await Alert.create({
      message:  req.body.message || 'Sample alert generated: predictive maintenance event logged.',
      severity: req.body.severity || 'warning',
      riskScore: req.body.riskScore || 55,
    });

    // Broadcast
    req.app.locals.broadcast(JSON.stringify({ type: 'NEW_ALERT', alert }));
    res.status(201).json({ alert });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create alert.' });
  }
});

/**
 * DELETE /api/alerts
 * Clear all alerts (useful for testing).
 */
router.delete('/', async (req, res) => {
  try {
    await Alert.deleteMany({});
    res.json({ message: 'All alerts cleared.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear alerts.' });
  }
});

module.exports = router;
