import * as THREE from 'three';

const POSE_CORRECTIONS = {
  none: new THREE.Matrix4().identity(),
  'rotate-x-minus-90': new THREE.Matrix4().makeRotationX(-Math.PI / 2),
  'rotate-x-plus-90': new THREE.Matrix4().makeRotationX(Math.PI / 2),
  'swap-yz': new THREE.Matrix4().set(
    1,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    1
  ),
};

export class ImageTrackingProbe {
  constructor({ targetIndex = 0, poseCorrection = 'none' } = {}) {
    this.targetIndex = targetIndex;
    this.poseCorrection = POSE_CORRECTIONS[poseCorrection] ?? POSE_CORRECTIONS.none;
    this.status = 'waiting for XR frame';
  }

  reset() {
    this.status = 'waiting for XR frame';
  }

  update({ frame, renderer, targetObject }) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    if (!frame || !referenceSpace) {
      this.status = 'no XR frame';
      return { status: this.status, result: null, matrix: null };
    }

    if (typeof frame.getImageTrackingResults !== 'function') {
      this.status = 'getImageTrackingResults unavailable';
      return { status: this.status, result: null, matrix: null };
    }

    const results = frame.getImageTrackingResults();
    const result = results.find((candidate) => candidate.index === this.targetIndex);

    if (!result) {
      this.status = `no tracked image (${results.length} results)`;
      return { status: this.status, result: null, matrix: null };
    }

    const pose = frame.getPose(result.imageSpace, referenceSpace);
    if (!pose) {
      this.status = `image ${result.index}: no pose`;
      return { status: this.status, result, matrix: null };
    }

    if (targetObject) {
      targetObject.matrixAutoUpdate = false;
      targetObject.matrix.copy(this.getCorrectedPoseMatrix(pose));
      targetObject.matrix.decompose(targetObject.position, targetObject.quaternion, targetObject.scale);
      targetObject.visible = true;
    }

    this.status = `image ${result.index}: ${result.trackingState ?? 'tracked'}`;
    return {
      status: this.status,
      result,
      matrix: this.getCorrectedPoseMatrix(pose),
    };
  }

  getCorrectedPoseMatrix(pose) {
    return new THREE.Matrix4().fromArray(pose.transform.matrix).multiply(this.poseCorrection);
  }
}
