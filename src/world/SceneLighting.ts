import * as THREE from 'three';

export function createSceneLighting(scene: THREE.Scene): void {
  const hemisphere = new THREE.HemisphereLight(0x9ddcff, 0x101827, 1.8);
  scene.add(hemisphere);

  const keyLight = new THREE.DirectionalLight(0xd9f3ff, 2.4);
  keyLight.position.set(-12, 24, 10);
  scene.add(keyLight);

  const cyanLight = new THREE.PointLight(0x00d9ff, 12, 34, 2);
  cyanLight.position.set(-12, 5, -7);
  scene.add(cyanLight);

  const orangeLight = new THREE.PointLight(0xff6b2b, 10, 28, 2);
  orangeLight.position.set(14, 4, 8);
  scene.add(orangeLight);
}
