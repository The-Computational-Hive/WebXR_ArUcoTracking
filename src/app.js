import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { AppState, CONFIG } from './config.js';
import { MarkerStabilityFilter } from './marker/markerStabilityFilter.js';
import { createDebugMarker } from './scene/createDebugMarker.js';
import { createScene } from './scene/createScene.js';
import { createSceneRoot } from './scene/sceneRoot.js';
import { createSurfaceGrid } from './scene/createSurfaceGrid.js';
import { createSnapControls } from './ui/snapControls.js';
import { createStatusPanel } from './ui/statusPanel.js';
import { createTrackedImagePreview } from './ui/trackedImagePreview.js';
import { AnchorManager } from './xr/anchorManager.js';
import { HitTestManager } from './xr/hitTestManager.js';
import { ImageTrackingProbe } from './xr/imageTrackingProbe.js';
import { RawCameraProbe } from './xr/rawCameraProbe.js';
import { createTrackedMarkerTarget } from './xr/trackedMarkerImage.js';

export async function startApp() {
  const { scene, camera, renderer } = createScene();
  const { sceneRoot } = createSceneRoot();
  const debugMarker = createDebugMarker();
  const surfaceGrid = createSurfaceGrid();
  const anchorManager = new AnchorManager();
  const hitTestManager = new HitTestManager();
  const rawCameraProbe = new RawCameraProbe({
    requestTexture: CONFIG.rawCameraProbeTexture,
    textureProbeIntervalMs: CONFIG.rawCameraTextureProbeIntervalMs,
  });
  const imageTrackingProbe = new ImageTrackingProbe({
    targetIndex: 0,
    poseCorrection: CONFIG.trackedImagePoseCorrection,
  });
  const trackedMarkerTarget = await createTrackedMarkerTarget({
    sourceUrl: CONFIG.trackedImageSourceUrl,
    canvasSize: CONFIG.trackedImageCanvasSize,
    paddingRatio: CONFIG.trackedImagePaddingRatio,
  });
  const trackedImagePreview = createTrackedImagePreview({
    canvas: trackedMarkerTarget.canvas,
    sourceUrl: CONFIG.trackedImageSourceUrl,
  });

  scene.add(sceneRoot);
  scene.add(debugMarker);
  scene.add(surfaceGrid);

  document.body.appendChild(renderer.domElement);
  document.body.appendChild(
    ARButton.createButton(renderer, {
      requiredFeatures: CONFIG.requireImageTracking ? ['image-tracking'] : [],
      optionalFeatures: [
        'anchors',
        'camera-access',
        'dom-overlay',
        'hit-test',
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
  let latestSurfaceHit = null;
  let pendingSurfaceAnchor = false;
  let hasSnapped = false;
  const imageTrackingStabilityFilter = new MarkerStabilityFilter({
    minStableSamples: CONFIG.minStableSamples,
    maxPositionDeltaMeters: CONFIG.maxPositionDeltaMeters,
    maxRotationDeltaDeg: CONFIG.maxRotationDeltaDeg,
    maxSampleAgeMs: CONFIG.maxSampleAgeMs,
  });
  const controls = createSnapControls({
    container: status.getElement(),
    markerId: 'image',
    onSnap: () => snapToStableImagePose(),
    onRealign: () => snapToStableImagePose(),
  });

  function snapToStableImagePose() {
    if (!latestStableTrackedImageMatrix) {
      return;
    }

    sceneRoot.matrixAutoUpdate = false;
    sceneRoot.matrix.copy(latestStableTrackedImageMatrix);
    sceneRoot.matrix.decompose(sceneRoot.position, sceneRoot.quaternion, sceneRoot.scale);
    pendingSurfaceAnchor = Boolean(latestSurfaceHit);
    hasSnapped = true;

    appState = AppState.TRACKING_WITH_WEBXR;
    status.setState(appState);
    controls.showRealign(false);

    if (pendingSurfaceAnchor) {
      status.setAnchorStatus('creating...');
    } else {
      anchorManager.useFallbackMatrix(latestStableTrackedImageMatrix);
      status.setAnchorStatus('fallback: XR local');
    }

    controls.setSnapEnabled(false);
  }

  let appState = AppState.SEARCHING_MARKER;
  status.setState(appState);
  status.setMarkerId('-');
  status.setSamples(0);
  status.setDetectionFps(0);
  status.setRawCameraStatus('enter AR to probe');
  status.setImageTrackingStatus('enter AR to probe');
  status.setSurfaceStatus('enter AR to scan');
  status.setAnchorStatus('pending');
  controls.setVisible(true);
  controls.setSnapEnabled(false);
  controls.showRealign(false);

  renderer.xr.addEventListener('sessionstart', () => {
    appState = AppState.SEARCHING_MARKER;
    status.setState(appState);
    status.setRawCameraStatus('probing...');
    status.setImageTrackingStatus('probing...');
    status.setSurfaceStatus('requesting...');
    rawCameraProbe.reset();
    imageTrackingProbe.reset();
    anchorManager.reset();
    hitTestManager.reset();
    hitTestManager
      .initialize(renderer.xr.getSession())
      .then(() => status.setSurfaceStatus('scanning...'))
      .catch((error) => {
        console.error(error);
        status.setSurfaceStatus(`error: ${error.name ?? 'unknown'}`);
      });
    latestTrackedImageMatrix = null;
    latestStableTrackedImageMatrix = null;
    latestSurfaceHit = null;
    pendingSurfaceAnchor = false;
    hasSnapped = false;
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
    status.setSurfaceStatus('enter AR to scan');
    rawCameraProbe.reset();
    imageTrackingProbe.reset();
    anchorManager.reset();
    hitTestManager.reset();
    latestTrackedImageMatrix = null;
    latestStableTrackedImageMatrix = null;
    latestSurfaceHit = null;
    pendingSurfaceAnchor = false;
    hasSnapped = false;
    imageTrackingStabilityFilter.reset();
    controls.setSnapEnabled(false);
    status.setSamples(0);
    trackedImagePreview.setVisible(true);
    debugMarker.visible = false;
    surfaceGrid.visible = false;
  });

  let lastStatus = '';
  let lastImageTrackingStatus = '';
  let lastSurfaceStatus = '';
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

      const surfaceState = hitTestManager.update({
        frame,
        renderer,
        targetObject: surfaceGrid,
      });
      latestSurfaceHit = surfaceState.hit;

      if (surfaceState.status !== lastSurfaceStatus) {
        lastSurfaceStatus = surfaceState.status;
        status.setSurfaceStatus(surfaceState.status);
      }

      if (imageTrackingState.isLive && latestTrackedImageMatrix) {
        imageTrackingStabilityFilter.addSample(matrixToPose(latestTrackedImageMatrix), timestamp);
        status.setSamples(imageTrackingStabilityFilter.getSampleCount());

        const stablePose = imageTrackingStabilityFilter.getStablePose();
        latestStableTrackedImageMatrix = stablePose?.matrix ?? null;
        controls.setSnapEnabled(
          Boolean(latestStableTrackedImageMatrix && latestSurfaceHit) && appState !== AppState.TRACKING_WITH_WEBXR
        );

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

        if (!hasSnapped && (appState === AppState.MARKER_STABLE || appState === AppState.MARKER_DETECTED)) {
          appState = AppState.SEARCHING_MARKER;
          status.setState(appState);
        }
      }

      if (hasSnapped && latestStableTrackedImageMatrix) {
        const drift = measureMatrixDrift(sceneRoot.matrix, latestStableTrackedImageMatrix);
        status.setDrift(drift.translationMeters, drift.rotationDeg);
        controls.showRealign(
          drift.translationMeters >= CONFIG.largeDriftTranslationMeters ||
            drift.rotationDeg >= CONFIG.largeDriftRotationDeg
        );
      } else if (hasSnapped && !latestTrackedImageMatrix) {
        status.setDrift(null, null);
        controls.showRealign(false);
      }

      if (imageTrackingStatus !== lastImageTrackingStatus) {
        lastImageTrackingStatus = imageTrackingStatus;
        status.setImageTrackingStatus(imageTrackingStatus);
      }

      const referenceSpace = renderer.xr.getReferenceSpace();

      if (
        pendingSurfaceAnchor &&
        latestStableTrackedImageMatrix &&
        latestSurfaceHit &&
        !anchorManager.isCreating &&
        referenceSpace
      ) {
        const anchorToSceneRoot = new THREE.Matrix4()
          .copy(latestSurfaceHit.matrix)
          .invert()
          .multiply(latestStableTrackedImageMatrix);
        const hitResult = latestSurfaceHit.result;
        pendingSurfaceAnchor = false;
        const canCreateAnchor = Boolean(hitResult.createAnchor || frame?.createAnchor);

        if (!canCreateAnchor) {
          anchorManager.useFallbackMatrix(latestStableTrackedImageMatrix);
          status.setAnchorStatus('fallback: anchors unavailable');
        } else {
          const createAnchorPromise = hitResult.createAnchor
            ? anchorManager.createAnchorFromHitTest({
                hitResult,
                anchorToSceneRoot,
              })
            : anchorManager.createAnchorAtMatrix({
                frame,
                referenceSpace,
                matrix: latestSurfaceHit.matrix,
                anchorToSceneRoot,
              });

          createAnchorPromise
            .then((anchor) => {
              if (anchor) {
                status.setAnchorStatus('created');
              } else {
                anchorManager.useFallbackMatrix(latestStableTrackedImageMatrix);
                status.setAnchorStatus('fallback: XR local');
              }
            })
            .catch((error) => {
              console.error(error);
              anchorManager.useFallbackMatrix(latestStableTrackedImageMatrix);
              status.setAnchorStatus(`fallback: ${error.name ?? 'anchor error'}`);
            });
        }
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

function measureMatrixDrift(referenceMatrix, measuredMatrix) {
  const referencePose = matrixToPose(referenceMatrix);
  const measuredPose = matrixToPose(measuredMatrix);
  const translationMeters = referencePose.position.distanceTo(measuredPose.position);
  const dot = Math.min(1, Math.max(-1, Math.abs(referencePose.quaternion.dot(measuredPose.quaternion))));
  const rotationDeg = (2 * Math.acos(dot) * 180) / Math.PI;

  return {
    translationMeters,
    rotationDeg,
  };
}
