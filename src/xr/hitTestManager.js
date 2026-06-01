import * as THREE from 'three';

export class HitTestManager {
  constructor() {
    this.viewerSpace = null;
    this.hitTestSource = null;
    this.isRequesting = false;
    this.latestHit = null;
  }

  async initialize(session) {
    if (!session || this.hitTestSource || this.isRequesting) {
      return;
    }

    this.isRequesting = true;

    try {
      this.viewerSpace = await session.requestReferenceSpace('viewer');
      this.hitTestSource = await session.requestHitTestSource({ space: this.viewerSpace });
    } finally {
      this.isRequesting = false;
    }
  }

  update({ frame, renderer, targetObject }) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    if (!frame || !referenceSpace || !this.hitTestSource) {
      this.latestHit = null;
      if (targetObject) {
        targetObject.visible = false;
      }
      return { status: 'unavailable', hit: null };
    }

    const results = frame.getHitTestResults(this.hitTestSource);
    const result = results[0];

    if (!result) {
      this.latestHit = null;
      if (targetObject) {
        targetObject.visible = false;
      }
      return { status: 'no surface', hit: null };
    }

    const pose = result.getPose(referenceSpace);
    if (!pose) {
      this.latestHit = null;
      return { status: 'no pose', hit: null };
    }

    const matrix = new THREE.Matrix4().fromArray(pose.transform.matrix);
    this.latestHit = { result, matrix };

    if (targetObject) {
      targetObject.matrixAutoUpdate = false;
      targetObject.matrix.copy(matrix);
      targetObject.matrix.decompose(targetObject.position, targetObject.quaternion, targetObject.scale);
      targetObject.visible = true;
    }

    return { status: 'surface found', hit: this.latestHit };
  }

  reset() {
    if (this.hitTestSource?.cancel) {
      this.hitTestSource.cancel();
    }

    this.viewerSpace = null;
    this.hitTestSource = null;
    this.isRequesting = false;
    this.latestHit = null;
  }
}
