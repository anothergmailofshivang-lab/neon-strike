import * as THREE from 'three';
import type { WeaponDefinition } from './WeaponTypes';

export interface WeaponModel {
  group: THREE.Group;
  muzzle: THREE.Object3D;
  flash: THREE.Mesh;
}

export function createWeaponModel(definition: WeaponDefinition): WeaponModel {
  const group = new THREE.Group();
  group.name = `WeaponModel:${definition.id}`;
  group.scale.setScalar(definition.visual.scale);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: definition.visual.primaryColor,
    metalness: 0.7,
    roughness: 0.35,
  });
  const detailMaterial = new THREE.MeshStandardMaterial({
    color: definition.visual.secondaryColor,
    metalness: 0.55,
    roughness: 0.28,
  });
  const energyMaterial = new THREE.MeshStandardMaterial({
    color: definition.visual.energyColor,
    emissive: definition.visual.energyColor,
    emissiveIntensity: 3,
    metalness: 0.15,
    roughness: 0.2,
  });

  const bodySize = definition.id === 'pistol' ? [0.18, 0.16, 0.55] : definition.id === 'sniper-rifle' ? [0.24, 0.2, 1.5] : [0.28, 0.2, 0.9] as [number, number, number];
  const body = new THREE.Mesh(new THREE.BoxGeometry(...bodySize), bodyMaterial);
  body.position.set(0, 0, 0);
  group.add(body);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.18), detailMaterial);
  grip.position.set(0, -0.23, 0.15);
  grip.rotation.x = -0.18;
  group.add(grip);

  if (definition.id === 'sniper-rifle') {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.55, 10), detailMaterial);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.15, -0.1);
    group.add(scope);
  }
  if (definition.id === 'shotgun') {
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.17, 0.4), detailMaterial);
    pump.position.set(0, -0.12, -0.35);
    group.add(pump);
  }
  if (definition.id === 'energy-rifle') {
    const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.45, 10), energyMaterial);
    emitter.rotation.x = Math.PI / 2;
    emitter.position.set(0, 0, -0.62);
    group.add(emitter);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 16), energyMaterial);
    coil.rotation.y = Math.PI / 2;
    coil.position.set(0, 0, -0.38);
    group.add(coil);
  }
  if (definition.id === 'burst-rifle') {
    const upperRail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.7), energyMaterial);
    upperRail.position.set(0, 0.15, -0.1);
    group.add(upperRail);
  }

  const barrelLength = definition.id === 'pistol' ? 0.45 : definition.id === 'sniper-rifle' ? 1.3 : 0.8;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, barrelLength, 8), detailMaterial);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.45 - barrelLength * 0.5);
  group.add(barrel);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, -0.45 - barrelLength);
  group.add(muzzle);
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 6, 4),
    new THREE.MeshBasicMaterial({ color: definition.visual.energyColor, transparent: true, opacity: 0.9 }),
  );
  flash.visible = false;
  muzzle.add(flash);
  return { group, muzzle, flash };
}
