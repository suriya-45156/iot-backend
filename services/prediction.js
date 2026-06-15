/**
 * Server-side prediction engine
 * Mirrors the risk scoring from the frontend, but runs authoritatively on the server.
 */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute risk score (0-99) from sensor values.
 * Weighted multi-sensor formula matching the frontend model.
 */
function computeRiskScore({ temperature, vibration, humidity, current }) {
  const tempRisk    = (temperature - 44) / 32;
  const vibeRisk    = (vibration - 3)    / 6;
  const humRisk     = (humidity - 50)    / 30;
  const currentRisk = (current - 12)     / 10;

  const score = clamp(
    Math.max(tempRisk, vibeRisk, humRisk, currentRisk) * 100 + 18,
    8,
    99
  );
  return Math.round(score);
}

/**
 * Map a risk score to a health mode label.
 */
function computeHealthMode(score) {
  if (score >= 75) return 'Critical';
  if (score >= 50) return 'Warning';
  return 'Nominal';
}

/**
 * Return maintenance recommendation based on risk score.
 */
function maintenanceAdvice(score) {
  if (score >= 80) return 'Schedule immediate inspection';
  if (score >= 55) return 'Plan maintenance within 24 hours';
  return 'Continue monitoring at edge';
}

/**
 * Return alert severity from risk score.
 */
function alertSeverity(score) {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'warning';
  return 'info';
}

/**
 * Return a human-readable event message.
 */
function eventMessage(score) {
  if (score >= 80) return 'Critical alert: Predictive model indicates high failure probability.';
  if (score >= 55) return 'Warning: Sensor values trending toward maintenance threshold.';
  return 'Machine operating within normal edge thresholds.';
}

module.exports = {
  computeRiskScore,
  computeHealthMode,
  maintenanceAdvice,
  alertSeverity,
  eventMessage,
};
