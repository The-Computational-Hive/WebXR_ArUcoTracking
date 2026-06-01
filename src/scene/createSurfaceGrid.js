import * as THREE from 'three';

export function createSurfaceGrid() {
  const group = new THREE.Group();
  group.name = 'surfaceHitGrid';

  const grid = new THREE.GridHelper(0.4, 8, 0x4fc3f7, 0x4fc3f7);
  grid.material.transparent = true;
  grid.material.opacity = 0.65;
  group.add(grid);

  const center = new THREE.Mesh(
    new THREE.RingGeometry(0.025, 0.035, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffeb3b,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    })
  );
  center.rotation.x = -Math.PI / 2;
  group.add(center);

  group.visible = false;
  return group;
}
