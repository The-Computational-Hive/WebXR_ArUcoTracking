import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { AppState, CONFIG } from './config.js';
import { MarkerStabilityFilter } from './marker/markerStabilityFilter.js';
import { createDebugMarker } from './scene/createDebugMarker.js';
import { createScene } from './scene/createScene.js';
import { createSceneRoot } from './scene/sceneRoot.js';
import { createSnapControls } from './ui/snapControls.js';
import { createStatusPanel } from './ui/statusPanel.js';

export function startApp() {
  const { scene, camera, renderer } = createScene();
  const { sceneRoot } = createSceneRoot();
  const debugMarker = createDebugMarker();

  scene.add(sceneRoot);
  scene.add(debugMarker);

  document.body.appendChild(renderer.domElement);
  document.body.appendChild(
    ARButton.createButton(renderer, {
      requiredFeatures: [],
      optionalFeatures: ['anchors', 'dom-overlay'],
      domOverlay: { root: document.body },
    })
  );

  const status = createStatusPanel();
  const controls = createSnapControls({
    container: status.getElement(),
    markerId: CONFIG.markerId,
    onSnap: () => {
      if (!stabilityFilter.isStable()) {
        return;
      }

      const stablePose = stabilityFilter.getStablePose();
      if (!stablePose) {
        return;
      }

      sceneRoot.matrixAutoUpdate = false;
      sceneRoot.matrix.copy(stablePose.matrix);
      sceneRoot.matrix.decompose(sceneRoot.position, sceneRoot.quaternion, sceneRoot.scale);

      appState = AppState.TRACKING_WITH_WEBXR;
      status.setState(appState);
      controls.setSnapEnabled(false);
    },
    onRealign: () => {
      controls.showRealign(false);
      appState = AppState.TRACKING_WITH_WEBXR;
      status.setState(appState);
    },
  });

  const stabilityFilter = new MarkerStabilityFilter({
    minStableSamples: CONFIG.minStableSamples,
    maxPositionDeltaMeters: CONFIG.maxPositionDeltaMeters,
    maxRotationDeltaDeg: CONFIG.maxRotationDeltaDeg,
    maxSampleAgeMs: CONFIG.maxSampleAgeMs,
  });

  let appState = AppState.SEARCHING_MARKER;
  status.setState(appState);
  status.setAnchorStatus('pending');
  controls.setVisible(false);
  controls.setSnapEnabled(false);
  controls.setMarkerId(CONFIG.markerId);

  renderer.xr.addEventListener('sessionstart', () => {
    controls.setVisible(true);
  });

  renderer.xr.addEventListener('sessionend', () => {
    controls.setVisible(false);
    controls.showRealign(false);
    controls.setSnapEnabled(false);
    appState = AppState.SEARCHING_MARKER;
    status.setState(appState);
  });

  // Placeholder detection tick to keep the milestone wiring visible.
  let lastDetectionTs = 0;
  renderer.setAnimationLoop((ts) => {
    if (ts - lastDetectionTs >= CONFIG.detectionIntervalMs) {
      lastDetectionTs = ts;

      status.setDetectionFps(Math.round(1000 / CONFIG.detectionIntervalMs));
      status.setMarkerId('-');
      status.setSamples(stabilityFilter.getSampleCount());

      if (appState === AppState.SEARCHING_MARKER) {
        status.setState(AppState.SEARCHING_MARKER);
      }
    }

    renderer.render(scene, camera);
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Add a default marker-like pose sample so manual snap flow can be tested early.
  const initMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(0, 0, -0.4),
    new THREE.Quaternion(),
    new THREE.Vector3(1, 1, 1)
  );
  stabilityFilter.addSample(
    { position: new THREE.Vector3(0, 0, -0.4), quaternion: new THREE.Quaternion(), matrix: initMatrix },
    performance.now()
  );

  if (stabilityFilter.isStable()) {
    appState = AppState.MARKER_STABLE;
    status.setState(appState);
    controls.setSnapEnabled(true);
  }
}
