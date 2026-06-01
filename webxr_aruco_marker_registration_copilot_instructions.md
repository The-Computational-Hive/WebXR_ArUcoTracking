# Copilot Instructions — WebXR ArUco Marker Registration Prototype

## Goal

Build a simple WebXR prototype that detects an ArUco marker in the camera image, estimates its position and orientation, and uses it to register a WebXR/Three.js scene. The first visual test should be a cube snapped to the marker coordinate frame.

The prototype should follow this logic:

1. Start a WebXR AR session.
2. Detect an ArUco marker from the camera/video frame.
3. Estimate the marker pose relative to the camera.
4. Convert the marker pose into WebXR local/reference-space coordinates.
5. Show a ghost/debug cube or axes on the detected marker.
6. Let the user press a **Snap** button.
7. On snap, align a parent `sceneRoot` to the marker/project coordinate frame.
8. After snapping, rely primarily on WebXR tracking/anchors for continuity.
9. Keep marker detection available only for drift checking and optional re-alignment.

For this first implementation, prioritize correctness, readability, and debuggability over automation.

---

## Recommended behavior

Do **not** continuously hard-snap the scene to the marker every frame. Marker pose detection will be noisy and will cause visible jitter.

Use this state-machine model instead:

```txt
SEARCHING_MARKER
→ MARKER_STABLE
→ READY_TO_SNAP
→ TRACKING_WITH_WEBXR
→ RECALIBRATION_AVAILABLE
```

The marker should be used for **registration**, while WebXR should be used for **continuous tracking**.

---

## Core interaction model

### Before snapping

- Run marker detection continuously.
- If the correct marker is detected, estimate its pose.
- Accumulate several valid detections over a short time window.
- When the detection is stable, show a ghost cube or axes at the detected marker pose.
- Enable the **Snap to Marker** button.

### On snap

- Compute the marker transform in WebXR local space.
- Compute the transform needed to align the project/world coordinate system to the marker.
- Apply that transform to a parent object called `sceneRoot`.
- Put all visible model content inside `sceneRoot`.

Example scene structure:

```txt
XR scene
└── sceneRoot          // transformed by marker calibration
    ├── cube
    ├── axes helper
    └── future Wasp / assembly model
```

### After snapping

- Stop using ArUco as the primary tracker.
- Continue WebXR tracking normally.
- If WebXR anchors are available, create an anchor at the registered pose and attach/update the scene relative to it.
- Keep detecting the marker in the background only for drift measurement.
- If the marker reappears and the drift is small, optionally soft-correct later.
- If the drift is large, show a **Re-align** button instead of auto-snapping.

---

## Implementation stack

Use the existing WebXR/Three.js app structure if available.

Suggested stack:

- Vite
- Three.js
- WebXR AR session
- JavaScript or TypeScript
- ArUco detection using a browser-compatible library, preferably `js-aruco2` or a similar pure-JS ArUco implementation for the first prototype

Avoid OpenCV.js for the first prototype unless absolutely necessary, because ArUco support may require custom OpenCV contrib builds.

---

## Main implementation milestones

## Milestone 1 — Basic WebXR AR scene

Create or reuse a minimal WebXR AR scene.

Requirements:

- A Three.js scene.
- An AR button to enter WebXR.
- A camera controlled by WebXR.
- A `sceneRoot` object added to the scene.
- A test cube inside `sceneRoot`.
- An axes helper inside `sceneRoot`.

Suggested structure:

```js
const scene = new THREE.Scene();
const sceneRoot = new THREE.Group();
scene.add(sceneRoot);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(0.1, 0.1, 0.1),
  new THREE.MeshStandardMaterial({ color: 0x00ff00 })
);

cube.position.set(0, 0.05, 0); // cube sits above marker plane
sceneRoot.add(cube);

const axes = new THREE.AxesHelper(0.2);
sceneRoot.add(axes);
```

The cube should eventually sit on top of the marker plane.

---

## Milestone 2 — Add marker detection pipeline

Create a dedicated marker detection module.

Suggested file:

```txt
src/marker/arucoDetector.js
```

Responsibilities:

- Initialize the ArUco detector.
- Receive an image/video/canvas frame.
- Detect markers.
- Filter by expected marker ID.
- Return marker corners and ID.

Suggested API:

```js
export class ArucoDetector {
  constructor({ markerId }) {
    this.markerId = markerId;
    // initialize detector here
  }

  detect(imageDataOrCanvas) {
    // return null if no valid marker found
    // return { id, corners } if marker is found
  }
}
```

For the first version, support only one expected marker ID.

---

## Milestone 3 — Camera frame acquisition

Create a way to get camera frames for detection.

Possible approaches:

1. Use a hidden `<video>` stream from `getUserMedia()` in parallel with WebXR.
2. Use the WebXR camera/image texture if the current platform exposes it.
3. For the first prototype, use the simplest available video/canvas approach.

Create a canvas used only for detection:

```js
const detectionCanvas = document.createElement('canvas');
const detectionContext = detectionCanvas.getContext('2d', { willReadFrequently: true });
```

Each detection tick:

```js
detectionContext.drawImage(video, 0, 0, detectionCanvas.width, detectionCanvas.height);
const imageData = detectionContext.getImageData(0, 0, detectionCanvas.width, detectionCanvas.height);
const result = arucoDetector.detect(imageData);
```

Throttle detection to avoid excessive CPU load:

```js
const DETECTION_INTERVAL_MS = 100; // 10 Hz
```

Do not run expensive marker detection every render frame unless performance is acceptable.

---

## Milestone 4 — Pose estimation

Create a marker pose estimation module.

Suggested file:

```txt
src/marker/poseEstimator.js
```

Responsibilities:

- Take marker corners in image coordinates.
- Use the known physical marker size.
- Use camera intrinsics or a first approximation.
- Return marker pose relative to the camera.

Suggested API:

```js
export class MarkerPoseEstimator {
  constructor({ markerSizeMeters, cameraIntrinsics }) {
    this.markerSizeMeters = markerSizeMeters;
    this.cameraIntrinsics = cameraIntrinsics;
  }

  estimatePose(corners) {
    // return {
    //   position: THREE.Vector3,
    //   quaternion: THREE.Quaternion,
    //   matrix: THREE.Matrix4
    // }
  }
}
```

For the first test, a rough pose is acceptable as long as the cube approximately follows the marker. Later, refine the camera intrinsics.

Important:

- Keep coordinate-system conversions explicit.
- Add comments wherever axis flips or matrix inversions happen.
- Add a visual axes helper to verify orientation.

---

## Milestone 5 — Convert marker pose into WebXR local space

This is the critical part of the prototype.

Marker pose estimation gives a pose relative to the camera/viewer. But the cube/model needs to be placed in the WebXR local reference space.

Implement a utility module:

```txt
src/xr/markerToXRTransform.js
```

Suggested function:

```js
export function markerCameraPoseToXRLocalPose({
  markerPoseCameraSpace,
  xrCamera,
}) {
  // Convert marker pose from camera/viewer space into XR local/world space.
  // Usually this means:
  // markerWorldMatrix = xrCamera.matrixWorld * markerCameraMatrix
  // But verify coordinate conventions and handedness.
}
```

Pseudo-logic:

```js
const markerMatrixCamera = markerPose.matrix;
const markerMatrixXRLocal = new THREE.Matrix4()
  .multiplyMatrices(xrCamera.matrixWorld, markerMatrixCamera);
```

This may require corrections depending on the pose-estimation coordinate system.

Add debug visualizations:

- A `detectedMarkerDebugGroup` directly in the main scene, not inside `sceneRoot`.
- Place this debug group at the current detected marker pose.
- Add axes and a transparent plane to confirm orientation.

```txt
XR scene
├── detectedMarkerDebugGroup   // raw live marker estimate
└── sceneRoot                  // snapped/calibrated project content
```

---

## Milestone 6 — Marker stability filter

Create a stability filter before enabling snap.

Suggested file:

```txt
src/marker/markerStabilityFilter.js
```

Responsibilities:

- Store the last N valid marker poses.
- Reject poses that jump too much.
- Report whether the marker is stable enough to snap.
- Return an averaged or smoothed pose.

Suggested rules for prototype:

```js
const MIN_STABLE_SAMPLES = 10;
const MAX_POSITION_DELTA = 0.03; // meters between consecutive samples
const MAX_ROTATION_DELTA_DEG = 8;
const MAX_SAMPLE_AGE_MS = 1000;
```

Suggested API:

```js
export class MarkerStabilityFilter {
  constructor(options) {
    this.samples = [];
  }

  addSample(pose, timestamp) {
    // validate and add sample
  }

  isStable() {
    // true when enough recent samples are consistent
  }

  getStablePose() {
    // return averaged/smoothed pose
  }

  reset() {
    this.samples = [];
  }
}
```

For the first version, averaging position is enough. For rotation, either use the latest stable quaternion or implement simple quaternion slerp averaging.

---

## Milestone 7 — Manual snap button

Implement manual snapping first.

Do **not** implement automatic snapping yet.

UI states:

```txt
Searching for marker...
Marker detected, stabilizing...
Marker stable — Snap available
Snapped — WebXR tracking active
Marker visible — drift can be checked
```

Create UI buttons:

```html
<button id="snapButton" disabled>Snap to Marker</button>
<button id="realignButton" hidden>Re-align</button>
```

On snap:

1. Get the stable marker pose in XR local space.
2. Compute the calibration transform.
3. Apply it to `sceneRoot`.

For the simplest version where the project origin should equal the marker frame:

```js
sceneRoot.matrixAutoUpdate = false;
sceneRoot.matrix.copy(markerMatrixXRLocal);
sceneRoot.matrix.decompose(sceneRoot.position, sceneRoot.quaternion, sceneRoot.scale);
```

If the marker represents a known project coordinate frame with an offset, use:

```js
sceneRootMatrix = markerMatrixXRLocal * inverse(markerMatrixInProjectCoordinates)
```

So the general calibration formula is:

```js
const markerInProjectInverse = markerInProject.clone().invert();
const sceneRootMatrix = new THREE.Matrix4()
  .multiplyMatrices(markerMatrixXRLocal, markerInProjectInverse);
```

This lets a marker printed at a known location in project/global coordinates define the whole scene alignment.

---

## Milestone 8 — WebXR anchor support

After manual snapping works, add optional WebXR anchor support.

Create:

```txt
src/xr/anchorManager.js
```

Responsibilities:

- Check whether anchors are supported.
- Create an anchor at the snapped marker pose if possible.
- Update scene placement from the anchor pose each frame.
- Fall back to `sceneRoot` transform if anchors are not available.

Suggested behavior:

```txt
if anchors are supported:
    create anchor at marker pose after snap
    attach sceneRoot/update sceneRoot from anchor pose
else:
    keep sceneRoot transform as calibrated transform
```

Keep the fallback simple and robust.

---

## Milestone 9 — Drift measurement

After snapping, continue detecting the marker in the background.

When the marker is stable again, compare:

```txt
current scene/project marker pose according to WebXR tracking
vs
fresh marker-derived pose
```

Compute drift:

```js
translationDriftMeters
rotationDriftDegrees
```

Display this in the UI:

```txt
Marker visible
Drift: 2.4 cm / 1.8°
```

Thresholds:

```js
const SMALL_DRIFT_TRANSLATION = 0.03; // 3 cm
const LARGE_DRIFT_TRANSLATION = 0.08; // 8 cm
const SMALL_DRIFT_ROTATION_DEG = 3;
const LARGE_DRIFT_ROTATION_DEG = 8;
```

If drift is large, show the **Re-align** button.

Do not auto-correct large drift.

---

## Milestone 10 — Optional soft correction

Only after manual snapping and drift measurement work, add optional soft correction.

Rules:

```txt
If marker is visible
and marker pose is stable
and drift is small
and auto-correction is enabled:
    blend sceneRoot slowly toward corrected transform
```

Example:

```js
sceneRoot.position.lerp(targetPosition, 0.02);
sceneRoot.quaternion.slerp(targetQuaternion, 0.02);
```

Do not soft-correct if the error is large. Large corrections should require user confirmation.

Suggested logic:

```js
if (isStable && drift.translation < 0.05 && drift.rotationDeg < 5) {
  softCorrectSceneRoot(targetPose);
} else if (drift.translation >= 0.05 || drift.rotationDeg >= 5) {
  showRealignButton();
}
```

---

## Suggested file structure

```txt
src/
  main.js
  app.js

  xr/
    xrSessionManager.js
    markerToXRTransform.js
    anchorManager.js

  marker/
    arucoDetector.js
    poseEstimator.js
    markerStabilityFilter.js
    markerQuality.js

  scene/
    createScene.js
    createDebugMarker.js
    sceneRoot.js

  ui/
    statusPanel.js
    snapControls.js

  utils/
    matrixUtils.js
    quaternionUtils.js
    units.js
```

Keep modules small and easy to inspect.

---

## State machine detail

Use an explicit state variable.

```js
const AppState = {
  SEARCHING_MARKER: 'SEARCHING_MARKER',
  MARKER_DETECTED: 'MARKER_DETECTED',
  MARKER_STABLE: 'MARKER_STABLE',
  TRACKING_WITH_WEBXR: 'TRACKING_WITH_WEBXR',
  RECALIBRATION_AVAILABLE: 'RECALIBRATION_AVAILABLE',
};
```

State transitions:

```txt
SEARCHING_MARKER
  marker detected → MARKER_DETECTED

MARKER_DETECTED
  marker stable → MARKER_STABLE
  marker lost → SEARCHING_MARKER

MARKER_STABLE
  user presses Snap → TRACKING_WITH_WEBXR
  marker lost → SEARCHING_MARKER

TRACKING_WITH_WEBXR
  stable marker visible and large drift → RECALIBRATION_AVAILABLE
  stable marker visible and small drift → optional soft correction

RECALIBRATION_AVAILABLE
  user presses Re-align → TRACKING_WITH_WEBXR
  marker lost → TRACKING_WITH_WEBXR
```

---

## Debug visuals

Add these early. They will save a lot of time.

1. Raw detected marker pose:

```txt
detectedMarkerDebugGroup
```

This should show the pose estimated directly from ArUco.

2. Snapped scene root:

```txt
sceneRoot axes
```

This should show the registered project coordinate frame.

3. Cube:

```txt
10 cm cube positioned 5 cm above marker plane
```

4. UI status:

```txt
State: MARKER_STABLE
Marker ID: 3
Samples: 12
Detection FPS: 10
Drift: 2.1 cm / 1.4°
Anchor: supported / not supported
```

---

## Important coordinate-system notes

Expect coordinate-system problems. Build for debugging them.

Check these items explicitly:

- Does the marker Z axis point out of the marker plane or into it?
- Does the cube appear above or below the marker?
- Is the marker mirrored?
- Are X and Y swapped?
- Does rotation around the marker normal behave correctly?
- Does the marker pose change correctly when walking around it?
- Is the marker size in meters correct?

Use a printed marker with a known size, for example:

```txt
markerSizeMeters = 0.10
```

Add a visible axis convention:

```txt
Red: +X
Green: +Y
Blue: +Z
```

---

## Configuration constants

Create one config file:

```txt
src/config.js
```

Example:

```js
export const CONFIG = {
  markerId: 3,
  markerSizeMeters: 0.10,

  detectionIntervalMs: 100,

  minStableSamples: 10,
  maxPositionDeltaMeters: 0.03,
  maxRotationDeltaDeg: 8,
  maxSampleAgeMs: 1000,

  smallDriftTranslationMeters: 0.03,
  largeDriftTranslationMeters: 0.08,
  smallDriftRotationDeg: 3,
  largeDriftRotationDeg: 8,

  enableAutoCorrection: false,
  autoCorrectionLerp: 0.02,
};
```

Start with:

```js
enableAutoCorrection: false
```

---

## First prototype acceptance test

The first successful prototype should satisfy this:

1. Open the app on an AR-capable phone.
2. Enter AR.
3. Point the camera at a printed ArUco marker.
4. The app detects the marker ID.
5. A debug axes/cube appears roughly aligned with the marker.
6. The Snap button becomes enabled after stable detection.
7. Press Snap.
8. The cube remains aligned to the marker frame.
9. Move the phone around.
10. The cube remains in place using WebXR tracking.
11. Hide the marker.
12. The cube remains stable.
13. Show the marker again.
14. The UI displays approximate drift.
15. If drift is large, the Re-align button appears.

---

## Implementation order for Copilot

Work in this order. Do not skip ahead to auto-correction before manual snap works.

### Step 1
Set up or identify the existing Three.js/WebXR AR scene. Add `sceneRoot`, test cube, axes helper, and status panel.

### Step 2
Add the ArUco detector module. Verify that the app can detect marker ID from a canvas/video frame and display the ID in the UI.

### Step 3
Add marker pose estimation. Draw a raw debug axes/cube at the detected marker pose. Do not snap yet.

### Step 4
Convert the marker pose into XR local space. Verify that the debug cube appears on or near the printed marker.

### Step 5
Add the stability filter. Enable the Snap button only when the pose is stable.

### Step 6
Implement manual snap. Apply the stable marker pose to `sceneRoot`.

### Step 7
Add optional WebXR anchor support with fallback.

### Step 8
Add drift measurement and Re-align button.

### Step 9
Only after everything above works, add optional soft correction behind a config flag.

---

## Things to avoid in the first prototype

Avoid these until the basic snap works:

- Automatic continuous hard snapping.
- Multiple marker support.
- Complex marker boards.
- OpenCV.js custom builds.
- Large model loading.
- Permanent cloud persistence.
- Complex UI.
- Auto-correction enabled by default.

---

## Notes for future extension

Later, this system should support:

- Multiple known ArUco markers in the same project coordinate system.
- Marker boards for better accuracy.
- AprilTags as an alternative detector.
- Saving calibration transforms.
- Loading Wasp assemblies under `sceneRoot`.
- Snapping the whole construction model, not only a cube.
- A Grasshopper component to generate markers and export marker metadata.

Future marker metadata could look like this:

```json
{
  "markers": [
    {
      "id": 3,
      "sizeMeters": 0.1,
      "projectTransform": {
        "position": [0, 0, 0],
        "rotationEulerDegrees": [0, 0, 0]
      }
    }
  ]
}
```

This would allow Grasshopper to define the project coordinate frame, while WebXR uses the detected marker to register the AR scene.
