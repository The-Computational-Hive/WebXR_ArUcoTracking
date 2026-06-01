import * as THREE from 'three';

export function createSceneRoot() {
  const sceneRoot = new THREE.Group();
  sceneRoot.name = 'sceneRoot';

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x2cb67d, roughness: 0.45, metalness: 0.1 })
  );
  cube.position.set(0.05, 0.05, 0.05);
  sceneRoot.add(cube);

  const axes = new THREE.AxesHelper(0.1);
  sceneRoot.add(axes);

  return { sceneRoot, cube, axes };
}
