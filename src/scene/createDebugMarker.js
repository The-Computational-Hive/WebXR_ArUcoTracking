import * as THREE from 'three';

export function createDebugMarker() {
  const group = new THREE.Group();
  group.name = 'detectedMarkerDebugGroup';

  const axes = new THREE.AxesHelper(0.15);
  group.add(axes);

  const markerPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.1, 0.1),
    new THREE.MeshBasicMaterial({
      color: 0xff8e3c,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    })
  );
  group.add(markerPlane);

  group.visible = false;

  return group;
}
