export function createMarkerOverlay() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.className = 'marker-overlay is-hidden';
  document.body.appendChild(canvas);
  let drawCount = 0;
  let videoFrameCount = 0;

  function drawMarker(marker) {
    if (!marker || marker.corners.length < 4) {
      return;
    }

    context.lineWidth = 4;
    context.strokeStyle = '#4fc3f7';
    context.fillStyle = '#ffeb3b';

    context.beginPath();
    context.moveTo(marker.corners[0].x, marker.corners[0].y);
    for (let i = 1; i < marker.corners.length; i += 1) {
      context.lineTo(marker.corners[i].x, marker.corners[i].y);
    }
    context.closePath();
    context.stroke();

    for (const corner of marker.corners) {
      context.beginPath();
      context.arc(corner.x, corner.y, 6, 0, Math.PI * 2);
      context.fill();
    }
  }

  return {
    draw(imageData, marker, stats) {
      if (!imageData) {
        return;
      }

      drawCount += 1;
      if (stats?.hasNewVideoTime) {
        videoFrameCount += 1;
      }

      if (canvas.width !== imageData.width || canvas.height !== imageData.height) {
        canvas.width = imageData.width;
        canvas.height = imageData.height;
      }

      context.putImageData(imageData, 0, 0);
      drawMarker(marker);

      context.fillStyle = 'rgba(10, 17, 28, 0.8)';
      context.fillRect(8, 8, 260, 76);
      context.fillStyle = '#e0e7ff';
      context.font = '18px Segoe UI, sans-serif';
      context.fillText(`Draw ${drawCount}`, 18, 31);
      context.fillText(`Video ${videoFrameCount}`, 18, 55);

      if (stats) {
        const staleMs = Math.round(stats.staleForMs);
        context.fillStyle = staleMs > 1000 ? '#ffb4a8' : '#b8f7d4';
        context.fillText(`Stale ${staleMs} ms`, 126, 55);
        context.fillStyle = '#e0e7ff';
        context.fillText(`Ready ${stats.readyState}`, 18, 79);
      }
    },
    setVisible(isVisible) {
      canvas.classList.toggle('is-hidden', !isVisible);
    },
    clear() {
      context.clearRect(0, 0, canvas.width, canvas.height);
      drawCount = 0;
      videoFrameCount = 0;
    },
  };
}
