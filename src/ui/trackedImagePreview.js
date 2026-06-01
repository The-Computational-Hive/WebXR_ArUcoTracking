export function createTrackedImagePreview({ canvas, sourceUrl }) {
  const container = document.createElement('div');
  container.className = 'tracked-image-preview';

  const title = document.createElement('div');
  title.className = 'tracked-image-preview-title';
  title.textContent = `Tracked image: ${sourceUrl}`;

  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = canvas.width;
  previewCanvas.height = canvas.height;
  previewCanvas.getContext('2d').drawImage(canvas, 0, 0);

  container.appendChild(title);
  container.appendChild(previewCanvas);
  document.body.appendChild(container);

  return {
    setVisible(isVisible) {
      container.classList.toggle('is-hidden', !isVisible);
    },
  };
}
