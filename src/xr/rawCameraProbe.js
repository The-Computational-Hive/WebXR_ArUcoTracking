export class RawCameraProbe {
  constructor({ requestTexture = false, textureProbeIntervalMs = 1000 } = {}) {
    this.requestTexture = requestTexture;
    this.textureProbeIntervalMs = textureProbeIntervalMs;
    this.lastTextureProbeTime = -Infinity;
    this.status = 'waiting for XR frame';
  }

  reset() {
    this.lastTextureProbeTime = -Infinity;
    this.status = 'waiting for XR frame';
  }

  update({ frame, renderer, timestamp }) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    if (!frame || !referenceSpace) {
      this.status = 'no XR frame';
      return this.status;
    }

    const viewerPose = frame.getViewerPose(referenceSpace);
    const view = viewerPose?.views?.[0];
    const xrCamera = view?.camera;

    if (!xrCamera) {
      this.status = 'XRView.camera unavailable';
      return this.status;
    }

    const binding = renderer.xr.getBinding();
    const canGetCameraImage = Boolean(binding?.getCameraImage);

    if (!this.requestTexture) {
      this.status = `camera ${xrCamera.width}x${xrCamera.height}, texture probe disabled`;
      return this.status;
    }

    if (!canGetCameraImage) {
      this.status = `camera ${xrCamera.width}x${xrCamera.height}, getCameraImage unavailable`;
      return this.status;
    }

    if (timestamp - this.lastTextureProbeTime < this.textureProbeIntervalMs) {
      return this.status;
    }

    this.lastTextureProbeTime = timestamp;

    try {
      const texture = binding.getCameraImage(xrCamera);
      this.status = texture
        ? `camera texture ok ${xrCamera.width}x${xrCamera.height}`
        : `camera texture null ${xrCamera.width}x${xrCamera.height}`;
    } catch (error) {
      this.status = `camera texture error: ${error.name ?? 'unknown'}`;
      console.error(error);
    }

    return this.status;
  }
}
