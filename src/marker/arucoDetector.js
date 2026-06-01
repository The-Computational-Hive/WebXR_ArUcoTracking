import arucoModule from 'js-aruco2';

const AR = arucoModule.AR ?? arucoModule.default?.AR ?? globalThis.AR;

function imageDataFromCanvas(canvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('ArucoDetector requires a readable 2D canvas context.');
  }

  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function normalizeImageSource(imageDataOrCanvas) {
  if (!imageDataOrCanvas) {
    return null;
  }

  if (
    imageDataOrCanvas.data &&
    Number.isFinite(imageDataOrCanvas.width) &&
    Number.isFinite(imageDataOrCanvas.height)
  ) {
    return imageDataOrCanvas;
  }

  if (typeof imageDataOrCanvas.getContext === 'function') {
    return imageDataFromCanvas(imageDataOrCanvas);
  }

  throw new TypeError('ArucoDetector.detect expects ImageData or a canvas.');
}

function cloneMarker(marker) {
  return {
    id: marker.id,
    hammingDistance: marker.hammingDistance,
    corners: marker.corners.map((corner) => ({
      x: corner.x,
      y: corner.y,
    })),
  };
}

export class ArucoDetector {
  constructor({ markerId, dictionaryName = 'ARUCO', maxHammingDistance } = {}) {
    if (!AR?.Detector) {
      throw new Error('js-aruco2 AR.Detector is not available.');
    }

    this.markerId = markerId;
    this.detector = new AR.Detector({
      dictionaryName,
      maxHammingDistance,
    });
  }

  detect(imageDataOrCanvas) {
    const markers = this.detectAll(imageDataOrCanvas);
    return markers.find((marker) => marker.id === this.markerId) ?? null;
  }

  detectAll(imageDataOrCanvas) {
    const imageData = normalizeImageSource(imageDataOrCanvas);
    if (!imageData) {
      return [];
    }

    return this.detector.detect(imageData).map(cloneMarker);
  }
}
