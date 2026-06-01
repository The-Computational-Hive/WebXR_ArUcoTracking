import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { AppState, CONFIG } from './config.js';
import { ArucoDetector } from './marker/arucoDetector.js';
import { CameraFrameSource } from './marker/cameraFrameSource.js';
import { MarkerStabilityFilter } from './marker/markerStabilityFilter.js';
import { MarkerPoseEstimator } from './marker/poseEstimator.js';
import { createDebugMarker } from './scene/createDebugMarker.js';
import { createScene } from './scene/createScene.js';
import { createSceneRoot } from './scene/sceneRoot.js';
import { createMarkerOverlay } from './ui/markerOverlay.js';
import { createSnapControls } from './ui/snapControls.js';
import { createStatusPanel } from './ui/statusPanel.js';
import { markerCameraPoseToXRLocalPose } from './xr/markerToXRTransform.js';

export function startApp() {
  const { scene, camera, renderer } = createScene();
  const { sceneRoot } = createSceneRoot();
  const debugMarker = createDebugMarker();
  const arucoDetector = new ArucoDetector({
    markerId: CONFIG.markerId,
    dictionaryName: CONFIG.markerDictionaryName,
  });
  const poseEstimator = new MarkerPoseEstimator({
    markerSizeMeters: CONFIG.markerSizeMeters,
    basis: CONFIG.markerPoseBasis,
  });
  const cameraFrameSource = new CameraFrameSource();
  const markerOverlay = createMarkerOverlay();

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
  let appState = AppState.SEARCHING_MARKER;
  let latestStableMarkerPoseCameraSpace = null;
  let latestStableMarkerPoseXRLocal = null;

  const controls = createSnapControls({
    container: status.getElement(),
    markerId: CONFIG.markerId,
    onSnap: () => {
      if (!latestStableMarkerPoseXRLocal) {
        return;
      }

      sceneRoot.matrixAutoUpdate = false;
      sceneRoot.matrix.copy(latestStableMarkerPoseXRLocal.matrix);
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

  status.setState(appState);
  status.setAnchorStatus('pending');
  controls.setVisible(true);
  controls.setSnapEnabled(false);
  controls.setMarkerId(CONFIG.markerId);
  markerOverlay.setVisible(true);

  cameraFrameSource.start().catch((error) => {
    console.error(error);
    status.setMarkerId('camera unavailable');
  });

  renderer.xr.addEventListener('sessionstart', () => {
    controls.setVisible(true);
    cameraFrameSource.stop();
    markerOverlay.setVisible(false);
  });

  renderer.xr.addEventListener('sessionend', () => {
    latestStableMarkerPoseXRLocal = null;
    cameraFrameSource.start().catch((error) => {
      console.error(error);
      status.setMarkerId('camera unavailable');
    });
    markerOverlay.setVisible(true);
    controls.setVisible(true);
    controls.showRealign(false);
    controls.setSnapEnabled(false);
    stabilityFilter.reset();
    debugMarker.visible = false;
    latestStableMarkerPoseCameraSpace = null;
    appState = AppState.SEARCHING_MARKER;
    status.setState(appState);
    status.setMarkerId('-');
    status.setSamples(0);
  });

  let lastDetectionTs = 0;
  renderer.setAnimationLoop((ts) => {
    if (!renderer.xr.isPresenting && ts - lastDetectionTs >= CONFIG.detectionIntervalMs) {
      lastDetectionTs = ts;

      status.setDetectionFps(Math.round(1000 / CONFIG.detectionIntervalMs));
      status.setSamples(stabilityFilter.getSampleCount());

      const frame = cameraFrameSource.getFrame(ts);
      const imageData = frame?.imageData ?? null;
      const marker = imageData ? arucoDetector.detect(imageData) : null;
      markerOverlay.draw(imageData, marker, frame?.stats);

      if (marker) {
        status.setMarkerId(marker.id);

        const markerPoseCameraSpace = poseEstimator.estimatePose(marker.corners, {
          width: imageData.width,
          height: imageData.height,
        });

        if (markerPoseCameraSpace) {
          stabilityFilter.addSample(markerPoseCameraSpace, ts);
          status.setSamples(stabilityFilter.getSampleCount());

          if (stabilityFilter.isStable()) {
            latestStableMarkerPoseCameraSpace = stabilityFilter.getStablePose();
            appState = AppState.MARKER_STABLE;
            status.setState(appState);
          }
        }

        if (appState === AppState.SEARCHING_MARKER && !stabilityFilter.isStable()) {
          appState = AppState.MARKER_DETECTED;
          status.setState(appState);
        }
      } else {
        if (appState === AppState.MARKER_DETECTED || appState === AppState.MARKER_STABLE) {
          stabilityFilter.reset();
          latestStableMarkerPoseCameraSpace = null;
          controls.setSnapEnabled(false);
          debugMarker.visible = false;
          appState = AppState.SEARCHING_MARKER;
          status.setState(appState);
        }

        if (appState === AppState.SEARCHING_MARKER) {
          status.setMarkerId('-');
        }
      }
    }

    if (renderer.xr.isPresenting && latestStableMarkerPoseCameraSpace && !latestStableMarkerPoseXRLocal) {
      latestStableMarkerPoseXRLocal = markerCameraPoseToXRLocalPose({
        markerPoseCameraSpace: latestStableMarkerPoseCameraSpace,
        xrCamera: camera,
      });

      debugMarker.matrixAutoUpdate = false;
      debugMarker.matrix.copy(latestStableMarkerPoseXRLocal.matrix);
      debugMarker.matrix.decompose(debugMarker.position, debugMarker.quaternion, debugMarker.scale);
      debugMarker.visible = true;
      controls.setSnapEnabled(true);
    }

    renderer.render(scene, camera);
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
