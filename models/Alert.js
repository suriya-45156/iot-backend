const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  message:    { type: String, required: true },
  severity:   { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
  riskScore:  { type: Number },
  sensorData: {
    temperature: Number,
    vibration:   Number,
    humidity:    Number,
    current:     Number
  },
  timestamp:  { type: Date, default: Date.now }
});

alertSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Alert', alertSchema);
