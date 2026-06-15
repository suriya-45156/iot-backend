const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema({
  temperature: { type: Number, required: true },
  vibration:   { type: Number, required: true },
  humidity:    { type: Number, required: true },
  current:     { type: Number, required: true },
  riskScore:   { type: Number, required: true },
  healthMode:  { type: String, enum: ['Nominal', 'Warning', 'Critical'], required: true },
  timestamp:   { type: Date, default: Date.now }
});

// Keep only latest 1000 readings (TTL-style via pre-save hook)
sensorReadingSchema.index({ timestamp: -1 });

module.exports = mongoose.model('SensorReading', sensorReadingSchema);
