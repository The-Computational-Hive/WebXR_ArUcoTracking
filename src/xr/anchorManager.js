import * as THREE from 'three';

export class AnchorManager {
  constructor() {
    this.isSupported = false;
    this.anchor = null;
    this.isCreating = false;
    this.anchorToSceneRoot = new THREE.Matrix4().identity();
    this.fallbackMatrix = null;
    this.usesFallback = false;
  }

  initialize(frame) {
    this.isSupported = Boolean(frame?.createAnchor);
    return this.isSupported;
  }

  async createAnchorAtMatrix({ frame, referenceSpace, matrix, anchorToSceneRoot }) {
    if (!frame?.createAnchor || !referenceSpace || !matrix || this.isCreating) {
      return null;
    }

    this.isCreating = true;

    try {
      const position = new THREE.Vector3();
      const orientation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, orientation, scale);

      const transform = new XRRigidTransform(
        { x: position.x, y: position.y, z: position.z },
        { x: orientation.x, y: orientation.y, z: orientation.z, w: orientation.w }
      );

      this.anchor = await frame.createAnchor(transform, referenceSpace);
      this.anchorToSceneRoot.copy(anchorToSceneRoot ?? new THREE.Matrix4());
      this.isSupported = true;
      return this.anchor;
    } finally {
      this.isCreating = false;
    }
  }

  async createAnchorFromHitTest({ hitResult, anchorToSceneRoot }) {
    if (!hitResult?.createAnchor || this.isCreating) {
      return null;
    }

    this.isCreating = true;

    try {
      this.anchor = await hitResult.createAnchor();
      this.anchorToSceneRoot.copy(anchorToSceneRoot ?? new THREE.Matrix4());
      this.isSupported = true;
      return this.anchor;
    } finally {
      this.isCreating = false;
    }
  }

  updateSceneRootFromAnchor({ frame, referenceSpace, sceneRoot }) {
    if (this.usesFallback) {
      if (this.fallbackMatrix && sceneRoot) {
        sceneRoot.matrixAutoUpdate = false;
        sceneRoot.matrix.copy(this.fallbackMatrix);
        sceneRoot.matrix.decompose(sceneRoot.position, sceneRoot.quaternion, sceneRoot.scale);
      }

      return 'fallback: XR local';
    }

    if (!this.anchor || !frame || !referenceSpace || !sceneRoot) {
      return 'none';
    }

    if (frame.trackedAnchors && !frame.trackedAnchors.has(this.anchor)) {
      return 'lost';
    }

    const pose = frame.getPose(this.anchor.anchorSpace, referenceSpace);
    if (!pose) {
      return 'no pose';
    }

    sceneRoot.matrixAutoUpdate = false;
    sceneRoot.matrix.fromArray(pose.transform.matrix);
    sceneRoot.matrix.multiply(this.anchorToSceneRoot);
    sceneRoot.matrix.decompose(sceneRoot.position, sceneRoot.quaternion, sceneRoot.scale);
    return 'tracking';
  }

  reset() {
    if (this.anchor?.delete) {
      this.anchor.delete();
    }

    this.anchor = null;
    this.isCreating = false;
    this.anchorToSceneRoot.identity();
    this.fallbackMatrix = null;
    this.usesFallback = false;
  }

  useFallbackMatrix(matrix) {
    this.reset();
    this.fallbackMatrix = matrix?.clone() ?? null;
    this.usesFallback = Boolean(this.fallbackMatrix);
  }
}
