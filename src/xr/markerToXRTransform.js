import * as THREE from 'three';

export function markerCameraPoseToXRLocalPose({ markerPoseCameraSpace, xrCamera }) {
  const markerMatrixXRLocal = new THREE.Matrix4().multiplyMatrices(
    xrCamera.matrixWorld,
    markerPoseCameraSpace.matrix
  );

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  markerMatrixXRLocal.decompose(position, quaternion, scale);

  return {
    matrix: markerMatrixXRLocal,
    position,
    quaternion,
  };
}
