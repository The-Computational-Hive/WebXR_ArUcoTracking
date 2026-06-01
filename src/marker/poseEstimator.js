import * as THREE from 'three';
import positModule from 'js-aruco2/src/posit1.js';

const POS = positModule.POS ?? positModule.default?.POS ?? globalThis.POS;

const BASIS_TRANSFORMS = {
  none: new THREE.Matrix4().identity(),
  'camera-z-flip': new THREE.Matrix4().makeScale(1, 1, -1),
  'camera-yz-flip': new THREE.Matrix4().makeScale(1, -1, -1),
};

export class MarkerPoseEstimator {
  constructor({ markerSizeMeters, cameraIntrinsics, basis = 'camera-z-flip' }) {
    if (!POS?.Posit) {
      throw new Error('js-aruco2 POS.Posit is not available.');
    }

    this.markerSizeMeters = markerSizeMeters;
    this.cameraIntrinsics = cameraIntrinsics;
    this.basis = BASIS_TRANSFORMS[basis] ?? BASIS_TRANSFORMS['camera-z-flip'];
    this.posit = null;
    this.focalLengthPixels = null;
  }

  estimatePose(corners, { width, height } = {}) {
    if (!corners || corners.length < 4 || !width || !height) {
      return null;
    }

    const focalLengthPixels = this.cameraIntrinsics?.focalLengthPixels ?? width;
    if (!this.posit || this.focalLengthPixels !== focalLengthPixels) {
      this.posit = new POS.Posit(this.markerSizeMeters, focalLengthPixels);
      this.focalLengthPixels = focalLengthPixels;
    }

    const centeredCorners = corners.map((corner) => ({
      x: corner.x - width / 2,
      y: height / 2 - corner.y,
    }));

    const pose = this.posit.pose(centeredCorners);
    if (!pose) {
      return null;
    }

    const matrix = this.createThreeCameraSpaceMatrix(pose.bestRotation, pose.bestTranslation);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose(position, quaternion, scale);

    return {
      position,
      quaternion,
      matrix,
      error: pose.bestError,
    };
  }

  createThreeCameraSpaceMatrix(rotation, translation) {
    const cvMatrix = new THREE.Matrix4().set(
      rotation[0][0],
      rotation[0][1],
      rotation[0][2],
      translation[0],
      rotation[1][0],
      rotation[1][1],
      rotation[1][2],
      translation[1],
      rotation[2][0],
      rotation[2][1],
      rotation[2][2],
      translation[2],
      0,
      0,
      0,
      1
    );

    // POSIT reports the marker in a camera space where +Z points forward.
    // Three.js cameras look down -Z, so we convert camera basis explicitly.
    return new THREE.Matrix4().multiplyMatrices(this.basis, cvMatrix);
  }
}
