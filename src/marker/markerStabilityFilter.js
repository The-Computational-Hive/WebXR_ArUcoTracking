import * as THREE from 'three';

function quaternionAngleDeg(a, b) {
  const dot = Math.min(1, Math.max(-1, Math.abs(a.dot(b))));
  return (2 * Math.acos(dot) * 180) / Math.PI;
}

export class MarkerStabilityFilter {
  constructor({
    minStableSamples,
    maxPositionDeltaMeters,
    maxRotationDeltaDeg,
    maxSampleAgeMs,
  }) {
    this.minStableSamples = minStableSamples;
    this.maxPositionDeltaMeters = maxPositionDeltaMeters;
    this.maxRotationDeltaDeg = maxRotationDeltaDeg;
    this.maxSampleAgeMs = maxSampleAgeMs;
    this.samples = [];
  }

  addSample(pose, timestamp) {
    if (this.samples.length > 0) {
      const last = this.samples[this.samples.length - 1];
      const posDelta = last.position.distanceTo(pose.position);
      const rotDelta = quaternionAngleDeg(last.quaternion, pose.quaternion);

      if (posDelta > this.maxPositionDeltaMeters || rotDelta > this.maxRotationDeltaDeg) {
        this.reset();
      }
    }

    this.samples.push({
      position: pose.position.clone(),
      quaternion: pose.quaternion.clone(),
      matrix: pose.matrix.clone(),
      timestamp,
    });

    this.samples = this.samples.filter((sample) => timestamp - sample.timestamp <= this.maxSampleAgeMs);
  }

  isStable() {
    return this.samples.length >= this.minStableSamples;
  }

  getStablePose() {
    if (!this.isStable()) {
      return null;
    }

    const avgPos = new THREE.Vector3();
    for (const sample of this.samples) {
      avgPos.add(sample.position);
    }
    avgPos.multiplyScalar(1 / this.samples.length);

    const latest = this.samples[this.samples.length - 1];
    const matrix = new THREE.Matrix4().compose(avgPos, latest.quaternion, new THREE.Vector3(1, 1, 1));

    return {
      position: avgPos,
      quaternion: latest.quaternion.clone(),
      matrix,
    };
  }

  getSampleCount() {
    return this.samples.length;
  }

  reset() {
    this.samples = [];
  }
}
