export function createSnapControls({ onSnap, onRealign }) {
  const controls = document.createElement('div');
  controls.className = 'snap-controls';
  controls.classList.add('is-hidden');

  const snapButton = document.createElement('button');
  snapButton.id = 'snapButton';
  snapButton.textContent = 'Snap to Marker';
  snapButton.disabled = true;
  snapButton.addEventListener('click', onSnap);

  const realignButton = document.createElement('button');
  realignButton.id = 'realignButton';
  realignButton.textContent = 'Re-align';
  realignButton.hidden = true;
  realignButton.addEventListener('click', onRealign);

  controls.appendChild(snapButton);
  controls.appendChild(realignButton);
  document.body.appendChild(controls);

  return {
    setVisible(isVisible) {
      controls.classList.toggle('is-hidden', !isVisible);
    },
    setSnapEnabled(isEnabled) {
      snapButton.disabled = !isEnabled;
    },
    showRealign(show) {
      realignButton.hidden = !show;
    },
  };
}
