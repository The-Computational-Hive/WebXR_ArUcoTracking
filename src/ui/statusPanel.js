export function createStatusPanel() {
  const panel = document.createElement('div');
  panel.className = 'status-panel';

  panel.innerHTML = `
    <div class="status-title">WebXR Marker Registration</div>
    <div id="stateLine">State: SEARCHING_MARKER</div>
    <div id="markerLine">Marker ID: -</div>
    <div id="samplesLine">Samples: 0</div>
    <div id="detectionLine">Detection FPS: 0</div>
    <div id="driftLine">Drift: -</div>
    <div id="anchorLine">Anchor: unknown</div>
  `;

  document.body.appendChild(panel);

  return {
    getElement() {
      return panel;
    },
    setState(state) {
      panel.querySelector('#stateLine').textContent = `State: ${state}`;
    },
    setMarkerId(markerId) {
      panel.querySelector('#markerLine').textContent = `Marker ID: ${markerId ?? '-'}`;
    },
    setSamples(samples) {
      panel.querySelector('#samplesLine').textContent = `Samples: ${samples}`;
    },
    setDetectionFps(fps) {
      panel.querySelector('#detectionLine').textContent = `Detection FPS: ${fps}`;
    },
    setDrift(translationMeters, rotationDeg) {
      if (translationMeters == null || rotationDeg == null) {
        panel.querySelector('#driftLine').textContent = 'Drift: -';
        return;
      }

      const cm = (translationMeters * 100).toFixed(1);
      panel.querySelector('#driftLine').textContent = `Drift: ${cm} cm / ${rotationDeg.toFixed(1)} deg`;
    },
    setAnchorStatus(value) {
      panel.querySelector('#anchorLine').textContent = `Anchor: ${value}`;
    },
  };
}
