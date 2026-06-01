import arucoModule from 'js-aruco2';

const AR = arucoModule.AR ?? arucoModule.default?.AR ?? globalThis.AR;

export async function createTrackedMarkerTarget({
  markerId,
  dictionaryName,
  sourceUrl,
  canvasSize = 512,
  paddingRatio = 0.08,
}) {
  let image;

  if (sourceUrl) {
    image = await loadImage(sourceUrl);
  } else {
    image = await loadGeneratedMarkerImage({ markerId, dictionaryName });
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not create marker image canvas context.');
  }

  const padding = Math.round(canvasSize * paddingRatio);
  const drawSize = canvasSize - padding * 2;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(image, padding, padding, drawSize, drawSize);

  return {
    imageBitmap: await createImageBitmap(canvas),
    canvas,
  };
}

async function loadGeneratedMarkerImage({ markerId, dictionaryName }) {
  if (!AR?.Dictionary) {
    throw new Error('js-aruco2 AR.Dictionary is not available.');
  }

  const dictionary = new AR.Dictionary(dictionaryName);
  const svg = dictionary.generateSVG(markerId);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function createTrackedMarkerImageBitmap(options) {
  return (await createTrackedMarkerTarget(options)).imageBitmap;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The generated marker SVG could not be decoded.'));
    image.src = url;
  });
}
