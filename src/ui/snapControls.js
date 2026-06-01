export function createSnapControls({ onSnap, onRealign, markerId, container }) {
  const controls = document.createElement('div');
  controls.className = 'snap-controls';
  controls.classList.add('is-hidden');

  if (container) {
    controls.classList.add('embedded');
  }

  const snapButton = document.createElement('button');
  snapButton.id = 'snapButton';
  snapButton.textContent = `Snap to Marker #${markerId}`;
  snapButton.disabled = true;
  snapButton.addEventListener('click', onSnap);

  const realignButton = document.createElement('button');
  realignButton.id = 'realignButton';
  realignButton.textContent = 'Re-align';
  realignButton.hidden = true;
  realignButton.addEventListener('click', onRealign);

  controls.appendChild(snapButton);
  controls.appendChild(realignButton);
  (container ?? document.body).appendChild(controls);

  return {
    setVisible(isVisible) {
      controls.classList.toggle('is-hidden', !isVisible);
    },
    setSnapEnabled(isEnabled) {
      snapButton.disabled = !isEnabled;
    },
    setMarkerId(nextMarkerId) {
      snapButton.textContent = `Snap to Marker #${nextMarkerId}`;
    },
    showRealign(show) {
      realignButton.hidden = !show;
    },
  };
}
