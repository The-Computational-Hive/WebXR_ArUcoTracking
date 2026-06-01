export async function createTrackedMarkerTarget({
  sourceUrl,
  canvasSize = 512,
  paddingRatio = 0.08,
}) {
  if (!sourceUrl) {
    throw new Error('Tracked image source URL is required.');
  }

  const image = await loadImage(sourceUrl);
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

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Tracked image could not be decoded: ${url}`));
    image.src = url;
  });
}
