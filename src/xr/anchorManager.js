import * as THREE from 'three';

export class AnchorManager {
  constructor() {
    this.isSupported = false;
    this.anchor = null;
    this.isCreating = false;
  }

  initialize(frame) {
    this.isSupported = Boolean(frame?.createAnchor);
    return this.isSupported;
  }

  async createAnchorAtMatrix({ frame, referenceSpace, matrix }) {
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
      this.isSupported = true;
      return this.anchor;
    } finally {
      this.isCreating = false;
    }
  }

  updateSceneRootFromAnchor({ frame, referenceSpace, sceneRoot }) {
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
    sceneRoot.matrix.decompose(sceneRoot.position, sceneRoot.quaternion, sceneRoot.scale);
    return 'tracking';
  }

  reset() {
    if (this.anchor?.delete) {
      this.anchor.delete();
    }

    this.anchor = null;
    this.isCreating = false;
  }
}
