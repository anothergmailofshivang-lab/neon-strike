import { NPC_ARCHETYPES } from '../ai/NPCDefinitions';
import type { MapDefinition } from '../world/MapDefinition';
import type { MissionDefinition } from './CampaignTypes';

const kinds = new Set(['reach', 'escape', 'eliminate', 'secure', 'capture', 'interact', 'recover', 'activate', 'defend', 'survive', 'extract']);
const validId = (id: string) => typeof id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(id);
export function validateMissionCatalog(missions: readonly MissionDefinition[], maps: readonly MapDefinition[]): void {
  const unique = (values: readonly { id: string }[], label: string): void => {
    if (new Set(values.map((v) => v.id)).size !== values.length || values.some((v) => !validId(v.id))) throw new Error(`Invalid or duplicate ${label} ID`);
  };
  unique(missions, 'mission');
  validateGraph(missions.map((m) => ({ id: m.id, requires: m.requires })), 'mission unlock');
  for (const mission of missions) {
    if (!validId(mission.campaignId) || !mission.name || !mission.briefing || !mission.debrief) throw new Error(`Incomplete mission: ${mission.id}`);
    const map = maps.find((entry) => entry.id === mission.mapId);
    if (!map) throw new Error(`Unknown map for ${mission.id}: ${mission.mapId}`);
    unique(mission.objectives, 'objective'); unique(mission.objects, 'object'); unique(mission.encounters, 'encounter'); unique(mission.checkpoints, 'checkpoint');
    validateGraph(mission.objectives, `${mission.id} objective`);
    const required = mission.objectives.filter((o) => !o.optional);
    const exits = required.filter((o) => o.kind === 'extract');
    if (exits.length !== 1) throw new Error(`${mission.id} requires one extraction completion route`);
    const ancestors = new Set<string>();
    const visit = (id: string): void => { if (ancestors.has(id)) return; ancestors.add(id); mission.objectives.find((o) => o.id === id)!.requires.forEach(visit); };
    visit(exits[0].id);
    if (required.some((o) => !ancestors.has(o.id))) throw new Error(`${mission.id}: extraction must depend on every mandatory objective`);
    if (!Number.isInteger(mission.firstCompletionXp) || mission.firstCompletionXp < 0 || mission.firstCompletionXp > 1000) throw new Error('Invalid mission XP reward');
    for (const object of mission.objects) {
      if (!object.position.every(Number.isFinite) || !['item', 'terminal'].includes(object.kind)) throw new Error(`Invalid mission object: ${object.id}`);
      if (object.opensDoorId && !map.doors?.some((door) => door.id === object.opensDoorId)) throw new Error(`Unknown door: ${object.opensDoorId}`);
      if (!mission.objectives.some((o) => o.objectId === object.id)) throw new Error(`Unused mission object: ${object.id}`);
    }
    for (const objective of mission.objectives) {
      if (!kinds.has(objective.kind)) throw new Error(`Unsupported objective: ${objective.id}`);
      if (!objective.optional && objective.requires.some((id) => mission.objectives.find((o) => o.id === id)?.optional)) throw new Error('Mandatory objective depends on optional objective');
      if (['interact', 'recover', 'activate'].includes(objective.kind) && !mission.objects.some((object) => object.id === objective.objectId)) throw new Error(`Missing object for ${objective.id}`);
      if (objective.kind === 'recover' && mission.objects.find((object) => object.id === objective.objectId)?.kind !== 'item') throw new Error('Recovery requires an item');
      if (objective.kind === 'capture' && !map.controlPoints.some((point) => point.id === objective.controlPointId)) throw new Error(`Invalid control point: ${objective.controlPointId}`);
      if (['reach', 'escape', 'secure', 'defend', 'extract'].includes(objective.kind) && (!objective.position?.every(Number.isFinite) || !Number.isFinite(objective.radius) || objective.radius! <= 0)) throw new Error(`Invalid region: ${objective.id}`);
      if (['secure', 'defend', 'survive', 'extract'].includes(objective.kind) && (!Number.isFinite(objective.duration) || objective.duration! <= 0 || objective.duration! > 300)) throw new Error(`Invalid duration: ${objective.id}`);
      if (objective.timeout !== undefined && (!Number.isFinite(objective.timeout) || objective.timeout <= (objective.duration ?? 0))) throw new Error(`Contradictory timeout: ${objective.id}`);
      if (['eliminate', 'survive'].includes(objective.kind) && !objective.encounterIds?.length) throw new Error(`Missing encounter for ${objective.id}`);
      for (const id of objective.encounterIds ?? []) {
        const encounter = mission.encounters.find((entry) => entry.id === id);
        if (!encounter) throw new Error(`Unknown encounter: ${id}`);
        const prerequisites = new Set<string>();
        const walk = (key: string): void => { if (prerequisites.has(key)) return; prerequisites.add(key); mission.objectives.find((o) => o.id === key)!.requires.forEach(walk); };
        objective.requires.forEach(walk);
        if (encounter.after.some((key) => !prerequisites.has(key))) throw new Error(`Encounter activation deadlock: ${id}`);
      }
    }
    let total = 0;
    for (const encounter of mission.encounters) {
      unique(encounter.units, 'encounter unit'); total += encounter.units.length;
      if (!encounter.units.length || encounter.units.length > 4 || new Set(encounter.units.map((u) => u.spawnId)).size !== encounter.units.length) throw new Error(`Invalid encounter size/spawns: ${encounter.id}`);
      if (encounter.after.some((id) => !mission.objectives.some((o) => o.id === id))) throw new Error(`Unknown encounter prerequisite: ${encounter.id}`);
      if (encounter.units.some((u) => !NPC_ARCHETYPES.some((a) => a.id === u.archetype))) throw new Error(`Unknown archetype: ${encounter.id}`);
    }
    if (total > 8) throw new Error('Mission roster exceeds supported population');
    for (const checkpoint of mission.checkpoints) if (!mission.objectives.some((o) => o.id === checkpoint.after && !o.optional) || !checkpoint.position.every(Number.isFinite)) throw new Error(`Invalid checkpoint: ${checkpoint.id}`);
  }
}

function validateGraph(nodes: readonly { id: string; requires: readonly string[] }[], label: string): void {
  const visiting = new Set<string>(), done = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`Cycle in ${label}: ${id}`);
    if (done.has(id)) return;
    const node = nodes.find((n) => n.id === id);
    if (!node) throw new Error(`Unknown ${label} dependency: ${id}`);
    visiting.add(id); node.requires.forEach(visit); visiting.delete(id); done.add(id);
  };
  nodes.forEach((node) => visit(node.id));
}
