import * as THREE from 'three';
import type { NPCArchetypeDefinition } from '../ai/NPCDefinitions';

export interface NPCVisual {
  root: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  weapon: THREE.Mesh;
}

export function createNPCVisual(definition: NPCArchetypeDefinition): NPCVisual {
  const root = new THREE.Group();
  root.name = `NPC:${definition.id}`;
  root.scale.setScalar(definition.scale);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: definition.color, roughness: 0.55, metalness: 0.35 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x152334, roughness: 0.65, metalness: 0.45 });
  const glowMaterial = new THREE.MeshStandardMaterial({ color: definition.color, emissive: definition.color, emissiveIntensity: 1.5 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 5, 10), bodyMaterial);
  body.position.y = 0.95;
  body.name = 'body';
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), glowMaterial);
  head.position.y = 1.85;
  head.name = 'critical';
  const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.75), darkMaterial);
  weapon.position.set(0.38, 1.18, -0.28);
  weapon.name = 'weapon';
  root.add(body, head, weapon);
  return { root, body, head, weapon };
}
