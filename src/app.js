import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { AppState, CONFIG } from './config.js';
import { MarkerStabilityFilter } from './marker/markerStabilityFilter.js';
import { createDebugMarker } from './scene/createDebugMarker.js';
import { createScene } from './scene/createScene.js';
import { createSceneRoot } from './scene/sceneRoot.js';
import { createSnapControls } from './ui/snapControls.js';
import { createStatusPanel } from './ui/statusPanel.js';
import { createTrackedImagePreview } from './ui/trackedImagePreview.js';
import { AnchorManager } from './xr/anchorManager.js';
import { ImageTrackingProbe } from './xr/imageTrackingProbe.js';
import { RawCameraProbe } from './xr/rawCameraProbe.js';
import { createTrackedMarkerTarget } from './xr/trackedMarkerImage.js';

export async function startApp() {
  const { scene, camera, renderer } = createScene();
  const { sceneRoot } = createSceneRoot();
  const debugMarker = createDebugMarker();
  const anchorManager = new AnchorManager();
  const rawCameraProbe = new RawCameraProbe({
    requestTexture: CONFIG.rawCameraProbeTexture,
    textureProbeIntervalMs: CONFIG.rawCameraTextureProbeIntervalMs,
  });
  const imageTrackingProbe = new ImageTrackingProbe({
    targetIndex: 0,
    poseCorrection: CONFIG.trackedImagePoseCorrection,
  });
  const trackedMarkerTarget = await createTrackedMarkerTarget({
    markerId: CONFIG.markerId,
    dictionaryName: CONFIG.markerDictionaryName,
    sourceUrl: CONFIG.trackedImageSourceUrl,
    canvasSize: CONFIG.trackedImageCanvasSize,
    paddingRatio: CONFIG.trackedImagePaddingRatio,
  });
  const trackedImagePreview = createTrackedImagePreview({
    canvas: trackedMarkerTarget.canvas,
    markerId: CONFIG.markerId,
    dictionaryName: CONFIG.markerDictionaryName,
    sourceUrl: CONFIG.trackedImageSourceUrl,
  });

  scene.add(sceneRoot);
  scene.add(debugMarker);

  document.body.appendChild(renderer.domElement);
  document.body.appendChild(
    ARButton.createButton(renderer, {
      requiredFeatures: CONFIG.requireImageTracking ? ['image-tracking'] : [],
      optionalFeatures: [
        'anchors',
        'camera-access',
        'dom-overlay',
        ...(CONFIG.requireImageTracking ? [] : ['image-tracking']),
      ],
      domOverlay: { root: document.body },
      trackedImages: [
        {
          image: trackedMarkerTarget.imageBitmap,
          widthInMeters: CONFIG.trackedImageWidthMeters,
        },
      ],
    })
  );

  const status = createStatusPanel();
  let latestTrackedImageMatrix = null;
  let latestStableTrackedImageMatrix = null;
  let pendingAnchorMatrix = null;
  const imageTrackingStabilityFilter = new MarkerStabilityFilter({
    minStableSamples: CONFIG.minStableSamples,
    maxPositionDeltaMeters: CONFIG.maxPositionDeltaMeters,
    maxRotationDeltaDeg: CONFIG.maxRotationDeltaDeg,
    maxSampleAgeMs: CONFIG.maxSampleAgeMs,
  });
  const controls = createSnapControls({
    container: status.getElement(),
    markerId: CONFIG.markerId,
    onSnap: () => {
      if (!latestStableTrackedImageMatrix) {
        return;
      }

      sceneRoot.matrixAutoUpdate = false;
      sceneRoot.matrix.copy(latestStableTrackedImageMatrix);
      sceneRoot.matrix.decompose(sceneRoot.position, sceneRoot.quaternion, sceneRoot.scale);
      pendingAnchorMatrix = latestStableTrackedImageMatrix.clone();

      appState = AppState.TRACKING_WITH_WEBXR;
      status.setState(appState);
      status.setAnchorStatus('creating...');
      controls.setSnapEnabled(false);
    },
    onRealign: () => {},
  });

  let appState = AppState.SEARCHING_MARKER;
  status.setState(appState);
  status.setMarkerId('-');
  status.setSamples(0);
  status.setDetectionFps(0);
  status.setRawCameraStatus('enter AR to probe');
  status.setImageTrackingStatus('enter AR to probe');
  status.setAnchorStatus('pending');
  controls.setVisible(true);
  controls.setSnapEnabled(false);
  controls.showRealign(false);

  renderer.xr.addEventListener('sessionstart', () => {
    appState = AppState.SEARCHING_MARKER;
    status.setState(appState);
    status.setRawCameraStatus('probing...');
    status.setImageTrackingStatus('probing...');
    rawCameraProbe.reset();
    imageTrackingProbe.reset();
    anchorManager.reset();
    latestTrackedImageMatrix = null;
    latestStableTrackedImageMatrix = null;
    pendingAnchorMatrix = null;
    imageTrackingStabilityFilter.reset();
    controls.setSnapEnabled(false);
    status.setSamples(0);
    trackedImagePreview.setVisible(false);
  });

  renderer.xr.addEventListener('sessionend', () => {
    appState = AppState.SEARCHING_MARKER;
    status.setState(appState);
    status.setRawCameraStatus('enter AR to probe');
    status.setImageTrackingStatus('enter AR to probe');
    rawCameraProbe.reset();
    imageTrackingProbe.reset();
    anchorManager.reset();
    latestTrackedImageMatrix = null;
    latestStableTrackedImageMatrix = null;
    pendingAnchorMatrix = null;
    imageTrackingStabilityFilter.reset();
    controls.setSnapEnabled(false);
    status.setSamples(0);
    trackedImagePreview.setVisible(true);
    debugMarker.visible = false;
  });

  let lastStatus = '';
  let lastImageTrackingStatus = '';
  renderer.setAnimationLoop((timestamp, frame) => {
    if (renderer.xr.isPresenting) {
      anchorManager.initialize(frame);

      const rawCameraStatus = rawCameraProbe.update({
        frame,
        renderer,
        timestamp,
      });

      if (rawCameraStatus !== lastStatus) {
        lastStatus = rawCameraStatus;
        status.setRawCameraStatus(rawCameraStatus);
      }

      const imageTrackingState = imageTrackingProbe.update({
        frame,
        renderer,
        targetObject: debugMarker,
      });
      const imageTrackingStatus = imageTrackingState.status;
      latestTrackedImageMatrix = imageTrackingState.matrix;

      if (latestTrackedImageMatrix) {
        imageTrackingStabilityFilter.addSample(matrixToPose(latestTrackedImageMatrix), timestamp);
        status.setSamples(imageTrackingStabilityFilter.getSampleCount());

        const stablePose = imageTrackingStabilityFilter.getStablePose();
        latestStableTrackedImageMatrix = stablePose?.matrix ?? null;
        controls.setSnapEnabled(Boolean(latestStableTrackedImageMatrix) && appState !== AppState.TRACKING_WITH_WEBXR);

        if (stablePose && appState !== AppState.TRACKING_WITH_WEBXR) {
          appState = AppState.MARKER_STABLE;
          status.setState(appState);
        } else if (appState === AppState.SEARCHING_MARKER) {
          appState = AppState.MARKER_DETECTED;
          status.setState(appState);
        }
      } else {
        imageTrackingStabilityFilter.reset();
        latestStableTrackedImageMatrix = null;
        controls.setSnapEnabled(false);
        status.setSamples(0);

        if (appState === AppState.MARKER_STABLE || appState === AppState.MARKER_DETECTED) {
          appState = AppState.SEARCHING_MARKER;
          status.setState(appState);
        }
      }

      if (imageTrackingStatus !== lastImageTrackingStatus) {
        lastImageTrackingStatus = imageTrackingStatus;
        status.setImageTrackingStatus(imageTrackingStatus);
      }

      const referenceSpace = renderer.xr.getReferenceSpace();

      if (pendingAnchorMatrix && !anchorManager.isCreating && frame?.createAnchor && referenceSpace) {
        const anchorMatrix = pendingAnchorMatrix.clone();
        pendingAnchorMatrix = null;

        anchorManager
          .createAnchorAtMatrix({
            frame,
            referenceSpace,
            matrix: anchorMatrix,
          })
          .then((anchor) => {
            status.setAnchorStatus(anchor ? 'created' : 'unavailable');
          })
          .catch((error) => {
            console.error(error);
            status.setAnchorStatus(`error: ${error.name ?? 'unknown'}`);
          });
      }

      const anchorStatus = anchorManager.updateSceneRootFromAnchor({
        frame,
        referenceSpace,
        sceneRoot,
      });

      if (anchorStatus !== 'none') {
        status.setAnchorStatus(anchorStatus);
      }
    }

    renderer.render(scene, camera);
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function matrixToPose(matrix) {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);

  return {
    position,
    quaternion,
    matrix,
  };
}
