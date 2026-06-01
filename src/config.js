export const CONFIG = {
  markerId: 3,
  markerSizeMeters: 0.1,
  detectionIntervalMs: 100,
  minStableSamples: 10,
  maxPositionDeltaMeters: 0.03,
  maxRotationDeltaDeg: 8,
  maxSampleAgeMs: 1000,
  smallDriftTranslationMeters: 0.03,
  largeDriftTranslationMeters: 0.08,
  smallDriftRotationDeg: 3,
  largeDriftRotationDeg: 8,
  enableAutoCorrection: false,
  autoCorrectionLerp: 0.02,
};

export const AppState = {
  SEARCHING_MARKER: 'SEARCHING_MARKER',
  MARKER_DETECTED: 'MARKER_DETECTED',
  MARKER_STABLE: 'MARKER_STABLE',
  TRACKING_WITH_WEBXR: 'TRACKING_WITH_WEBXR',
  RECALIBRATION_AVAILABLE: 'RECALIBRATION_AVAILABLE',
};
