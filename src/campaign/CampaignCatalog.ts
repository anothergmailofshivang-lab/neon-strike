import type { MissionDefinition, MissionObjectiveDefinition as Objective, MissionObjectDefinition, MissionEncounterDefinition } from './CampaignTypes';
import type { MapVector3 as Point } from '../world/MapDefinition';

export const CAMPAIGN = {
  id: 'carrier-zero', name: 'CARRIER ZERO',
  premise: 'A stolen authorization signal is turning local security units against their own districts. Trace its supply chain, recover the signing keys, and isolate the combat archive that keeps rebroadcasting it.',
  conclusion: 'The carrier is isolated. The recovered evidence identifies the compromised supply route, and the archive can no longer authorize hostile deployments. The districts can rebuild. Every operation remains available for replay.',
} as const;

const o = (id: string, title: string, kind: Objective['kind'], requires: string[] = [], fields: Partial<Objective> = {}): Objective => ({ id, title, kind, requires, ...fields });
const terminal = (id: string, label: string, position: Point, shutdown = false, opensDoorId?: string): MissionObjectDefinition => ({ id, label, position, kind: 'terminal', initialActive: shutdown, action: shutdown ? 'disable' : 'enable', opensDoorId });
const item = (id: string, label: string, position: Point): MissionObjectDefinition => ({ id, label, position, kind: 'item', action: 'collect' });
const encounter = (id: string, after: string[], destination: Point, units: readonly [string, MissionEncounterDefinition['units'][number]['archetype']][]): MissionEncounterDefinition => ({ id, after, destination, units: units.map(([spawnId, archetype]) => ({ id: `${id}-${archetype}`, spawnId, archetype })) });
const extract = (requires: string[], position: Point, duration = 3): Objective => o('extract', 'Reach extraction and hold the marked zone', 'extract', requires, { position, radius: 3, duration });
const side = (objectId: string): Objective => o('side-record', 'Optional: recover the secondary record', 'recover', [], { objectId, optional: true });
const cp = (after: string, position: Point) => [{ id: 'secured-stage', after, position, yaw: 0 }];

export const MISSIONS: readonly MissionDefinition[] = [
  {
    id: 'dead-air', campaignId: CAMPAIGN.id, chapter: 'I · Urban Signal', name: 'Dead Air', mapId: 'modern-city', spawnId: 'city-player-plaza', requires: [],
    summary: 'Restore the market relay and recover its authorization trace.',
    briefing: 'City patrols are accepting orders from an unknown carrier. Move up the avenue, clear the relay guards, enable the market reader, and collect its trace cartridge. Extract at the north avenue approach. A park recorder is optional.',
    debrief: 'The trace cartridge points to falsified perimeter manifests. The next operation follows that paper trail through the residential approach.',
    suggestedEquipment: 'Rifle or SMG; recovery for the avenue, smoke for crossing exposed streets.', firstCompletionXp: 200,
    objects: [terminal('market-reader', 'Enable market reader', [3, 1, 8]), item('trace', 'Recover trace cartridge', [0, 1, 3]), item('park-record', 'Recover park recorder', [-12, 1, 6])],
    objectives: [o('approach', 'Reach the market approach', 'reach', [], { position: [0, 0, 9], radius: 3 }), o('guards', 'Clear the relay guards', 'eliminate', ['approach'], { encounterIds: ['relay-guards'], position: [0, 0, 5] }), o('reader', 'Enable the market reader', 'activate', ['guards'], { objectId: 'market-reader' }), o('trace', 'Recover the trace cartridge', 'recover', ['reader'], { objectId: 'trace' }), side('park-record'), extract(['trace'], [2, 0, -14])],
    encounters: [encounter('relay-guards', ['approach'], [0, 0, 5], [['city-heavy-north', 'rifleman'], ['city-sniper-roof', 'scout']])], checkpoints: cp('guards', [0, 0, 7]),
  },
  {
    id: 'perimeter-receipt', campaignId: CAMPAIGN.id, chapter: 'I · Urban Signal', name: 'Perimeter Receipt', mapId: 'modern-city', spawnId: 'city-player-plaza', requires: ['dead-air'],
    summary: 'Take the park control point, open the residence route, and recover a manifest.',
    briefing: 'The forged manifests were routed through a residential control panel. Capture the park beacon, activate the residence access panel, and collect the manifest at its south approach. The panel opens the real residence door. Extract south; the café-side record is optional.',
    debrief: 'The manifest identifies an industrial contractor shipping carrier hardware. A depot ledger can tie those shipments to the source.',
    suggestedEquipment: 'A mobile primary and a frag; control-point capture takes five uncontested seconds.', firstCompletionXp: 200,
    objects: [terminal('residence-access', 'Authorize residence access', [12, 1, 18], false, 'city-house-door'), item('manifest', 'Recover perimeter manifest', [14, 1, 19]), item('cafe-record', 'Recover café-side record', [-12, 1, -8])],
    objectives: [o('park', 'Capture the park beacon', 'capture', [], { controlPointId: 'city-park', position: [-12, 0, 6] }), o('access', 'Authorize residence access', 'activate', ['park'], { objectId: 'residence-access' }), o('manifest', 'Recover the perimeter manifest', 'recover', ['access'], { objectId: 'manifest' }), side('cafe-record'), extract(['manifest'], [0, 0, 21])],
    encounters: [encounter('park-patrol', [], [-12, 0, 6], [['city-heavy-north', 'defender'], ['city-sniper-roof', 'flanker']])], checkpoints: cp('manifest', [12, 0, 20]),
  },
  {
    id: 'cold-ledger', campaignId: CAMPAIGN.id, chapter: 'II · Broken Supply Chain', name: 'Cold Ledger', mapId: 'industrial-facility', spawnId: 'dustline-player-south', requires: ['perimeter-receipt'],
    summary: 'Enter the loading lanes and recover the shipping ledger.',
    briefing: 'Use the west loading lane to reach the depot apron. Clear the shipping guards and recover the ledger beside the loading bay. Extract through the west service lane. A north-lane consignment tag supplies optional evidence; the solid loading bay itself is not an interior.',
    debrief: 'The ledger reveals carrier components dispatched to a forest listening post. Before following them, disable the depot transmitter.',
    suggestedEquipment: 'Rifle and recovery; use cargo cover rather than the exposed central bay.', firstCompletionXp: 225,
    objects: [item('ledger', 'Recover shipping ledger', [0, 1, -1]), item('consignment', 'Recover consignment tag', [0, 1, -21])],
    objectives: [o('lane', 'Reach the west loading lane', 'reach', [], { position: [-11, 0, 7], radius: 3 }), o('shipping', 'Clear the shipping guards', 'eliminate', ['lane'], { encounterIds: ['shipping-guards'], position: [0, 0, -4] }), o('ledger', 'Recover the shipping ledger', 'recover', ['shipping'], { objectId: 'ledger' }), side('consignment'), extract(['ledger'], [-22, 0, 2])],
    encounters: [encounter('shipping-guards', ['lane'], [0, 0, -4], [['dustline-heavy-north', 'heavy'], ['dustline-rifleman-east', 'rifleman']])], checkpoints: cp('shipping', [0, 0, -4]),
  },
  {
    id: 'breaker-window', campaignId: CAMPAIGN.id, chapter: 'II · Broken Supply Chain', name: 'Breaker Window', mapId: 'industrial-facility', spawnId: 'dustline-player-south', requires: ['cold-ledger'],
    summary: 'Shut down the transmitter and hold the apron against its response team.',
    briefing: 'Disable the lit transmitter on the loading apron. This stops its carrier flag and triggers a finite response team. Hold the apron for twenty uncontested seconds and defeat that team within two minutes, then extract west. A backup tag is optional. Speed is a stated performance goal for this operation.',
    debrief: 'The depot transmitter is offline. The remaining carrier traffic originates from the forest listening post.',
    suggestedEquipment: 'Frag and recovery; stay within the marked apron during upload verification.', firstCompletionXp: 225, timeGoal: 240,
    objects: [terminal('transmitter', 'Disable depot transmitter', [-2, 1, -2], true), item('backup-tag', 'Recover backup tag', [12, 1, -12])],
    objectives: [o('shutdown', 'Disable the depot transmitter', 'interact', [], { objectId: 'transmitter' }), o('hold', 'Hold the apron 20s and clear the response team (120s limit)', 'defend', ['shutdown'], { position: [0, 0, -4], radius: 5, duration: 20, timeout: 120, encounterIds: ['response'] }), side('backup-tag'), extract(['hold'], [-22, 0, 2], 5)],
    encounters: [encounter('response', ['shutdown'], [0, 0, -4], [['dustline-heavy-north', 'defender'], ['dustline-scout-west', 'scout'], ['dustline-rifleman-east', 'rifleman']])], checkpoints: cp('shutdown', [0, 0, -4]),
  },
  {
    id: 'green-trace', campaignId: CAMPAIGN.id, chapter: 'III · Lost Outpost', name: 'Green Trace', mapId: 'jungle-forest', spawnId: 'forest-player-clearing', requires: ['breaker-window'],
    summary: 'Follow field notes from the cabin approach to the stream bank.',
    briefing: 'A missing operator left a field recorder outside the cabin. Recover it, then secure the stream-bank investigation zone for eight uncontested seconds. The recorder activates a bounded search patrol. Extract at the south trail; an outpost log is optional.',
    debrief: 'The field recorder identifies an emergency carrier channel. The listening-post relay can transmit the evidence if you hold the clearing.',
    suggestedEquipment: 'SMG or rifle; a sensor helps track the search patrol through natural cover.', firstCompletionXp: 250,
    objects: [item('field-recorder', 'Recover field recorder', [-10, 1, 3]), item('outpost-log', 'Recover outpost log', [12, 1, 13])],
    objectives: [o('cabin', 'Reach the cabin approach', 'reach', [], { position: [-10, 0, 4], radius: 3 }), o('recorder', 'Recover the field recorder', 'recover', ['cabin'], { objectId: 'field-recorder' }), o('bank', 'Secure the stream-bank zone for 8s', 'secure', ['recorder'], { position: [12, 0, 4], radius: 4, duration: 8 }), side('outpost-log'), extract(['bank'], [0, 0, 22])],
    encounters: [encounter('search-patrol', ['recorder'], [12, 0, 4], [['forest-heavy-north', 'scout'], ['forest-sniper-ridge', 'flanker']])], checkpoints: cp('recorder', [-10, 0, 4]),
  },
  {
    id: 'carrier-hold', campaignId: CAMPAIGN.id, chapter: 'III · Lost Outpost', name: 'Carrier Hold', mapId: 'jungle-forest', spawnId: 'forest-player-clearing', requires: ['green-trace'],
    summary: 'Bring the clearing relay online and survive its finite assault.',
    briefing: 'Enable the field relay in the clearing. Defend the marked zone for twenty-five uncontested seconds and defeat the assault group. Recover the completed transmission cartridge and extract via the stream bank. A north-trail bearing is optional.',
    debrief: 'The transmission identifies a research installation and its combat-archive link. The carrier signing key is stored there.',
    suggestedEquipment: 'A sustained-fire primary, frag, and an ammo pack for the finite assault.', firstCompletionXp: 250,
    objects: [terminal('field-relay', 'Enable field relay', [-2, 1, 4]), item('transmission', 'Recover transmission cartridge', [0, 1, 6]), item('bearing', 'Recover north-trail bearing', [0, 1, -19])],
    objectives: [o('relay', 'Enable the clearing relay', 'activate', [], { objectId: 'field-relay' }), o('defense', 'Defend the clearing 25s and defeat the assault', 'defend', ['relay'], { position: [0, 0, 4], radius: 5, duration: 25, encounterIds: ['assault'] }), o('cartridge', 'Recover the completed transmission', 'recover', ['defense'], { objectId: 'transmission' }), side('bearing'), extract(['cartridge'], [12, 0, 4])],
    encounters: [encounter('assault', ['relay'], [0, 0, 4], [['forest-heavy-north', 'heavy'], ['forest-sniper-ridge', 'rifleman'], ['forest-rifleman-east', 'scout']])], checkpoints: cp('relay', [0, 0, 6]),
  },
  {
    id: 'glass-witness', campaignId: CAMPAIGN.id, chapter: 'IV · Black Circuit', name: 'Glass Witness', mapId: 'sci-fi-facility', spawnId: 'skybridge-player-lower', requires: ['carrier-hold'],
    summary: 'Take the west court and recover the archive signing sample.',
    briefing: 'Stay on the installation’s lower level. Capture the west court control point, then recover the signing sample. Its removal triggers a two-operative interception team: defeat them before extracting at the east court. A lower-hall audit record is optional.',
    debrief: 'The sample reveals that the carrier is being regenerated by a combat archive. Isolate the two physical links before entering the archive.',
    suggestedEquipment: 'Rifle or precision primary; smoke for lower-court crossings.', firstCompletionXp: 275,
    objects: [item('signing-sample', 'Recover signing sample', [-10, 1, -10]), item('audit-record', 'Recover audit record', [0, 1, -12])],
    objectives: [o('west', 'Capture the west court', 'capture', [], { controlPointId: 'sci-fi-west', position: [-10, 0, -10] }), o('sample', 'Recover the signing sample', 'recover', ['west'], { objectId: 'signing-sample' }), o('interception', 'Defeat the interception team', 'eliminate', ['sample'], { encounterIds: ['interceptors'], position: [0, 0, 7] }), side('audit-record'), extract(['interception'], [10, 0, 10])],
    encounters: [encounter('interceptors', ['sample'], [-10, 0, -10], [['skybridge-scout-west', 'flanker'], ['skybridge-rifleman-east', 'rifleman']])], checkpoints: cp('sample', [-10, 0, -10]),
  },
  {
    id: 'black-circuit', campaignId: CAMPAIGN.id, chapter: 'IV · Black Circuit', name: 'Black Circuit', mapId: 'sci-fi-facility', spawnId: 'skybridge-player-lower', requires: ['glass-witness'],
    summary: 'Isolate two links, survive the response, and leave the isolation zone.',
    briefing: 'Disable the lower uplink, then the west return link in that order. Both lit consoles must change state. Survive the finite response encounter and clear it, leave the west isolation radius, then extract south. The independent checksum recorder is optional.',
    debrief: 'Both physical links are isolated. The remaining carrier is contained inside Old Guard, a historical combat simulation using modern security avatars—not a portal to another world.',
    suggestedEquipment: 'Rifle, flash, and recovery; use the lower-level routes around central cover.', firstCompletionXp: 275,
    objects: [terminal('uplink', 'Disable lower uplink', [-3, 1, 6], true), terminal('return-link', 'Disable west return link', [-10, 1, -10], true), item('checksum', 'Recover checksum recorder', [10, 1, 10])],
    objectives: [o('uplink', 'Disable the lower uplink', 'interact', [], { objectId: 'uplink' }), o('return', 'Disable the west return link', 'interact', ['uplink'], { objectId: 'return-link' }), o('response', 'Survive 12s and defeat the response encounter', 'survive', ['return'], { duration: 12, encounterIds: ['response'], position: [-10, 0, -10] }), o('escape', 'Leave the marked west isolation radius', 'escape', ['response'], { position: [-10, 0, -10], radius: 12 }), side('checksum'), extract(['escape'], [0, 0, 20])],
    encounters: [encounter('response', ['return'], [-10, 0, -10], [['skybridge-scout-west', 'defender'], ['skybridge-rifleman-east', 'heavy']])], checkpoints: cp('return', [-10, 0, -10]),
  },
  {
    id: 'archive-keep', campaignId: CAMPAIGN.id, chapter: 'V · Old Guard Archive', name: 'Archive Keep', mapId: 'fantasy-ruins', spawnId: 'fantasy-player-market', requires: ['black-circuit'],
    summary: 'Recover an archive key from a historical combat simulation.',
    briefing: 'Old Guard renders a ruined kingdom, but its defenders use the same security combat systems. Follow the outer lanes around the intact north wall, capture the gate-side point, and recover the archive key. Defeat the awakened sentinels and extract at the market. A western annotation is optional.',
    debrief: 'The archive key exposes the carrier’s final authorization node. One final operation can retire it and end the rebroadcast.',
    suggestedEquipment: 'Rifle, frag, and recovery; the castle wall is solid—use an outer lane.', firstCompletionXp: 300,
    objects: [item('archive-key', 'Recover archive key', [2, 1, -20]), item('annotation', 'Recover western annotation', [-12, 1, -6])],
    objectives: [o('gate', 'Capture the gate-side control point', 'capture', [], { controlPointId: 'fantasy-gate', position: [0, 0, -20] }), o('key', 'Recover the archive key', 'recover', ['gate'], { objectId: 'archive-key' }), o('sentinels', 'Defeat the archive sentinels', 'eliminate', ['key'], { encounterIds: ['sentinels'], position: [0, 0, -20] }), side('annotation'), extract(['sentinels'], [0, 0, 9])],
    encounters: [encounter('sentinels', ['key'], [0, 0, -20], [['fantasy-heavy-gate', 'defender'], ['fantasy-sniper-bridge', 'rifleman']])], checkpoints: cp('key', [2, 0, -20]),
  },
  {
    id: 'last-carrier', campaignId: CAMPAIGN.id, chapter: 'V · Old Guard Archive', name: 'Last Carrier', mapId: 'fantasy-ruins', spawnId: 'fantasy-player-market', requires: ['archive-keep'],
    summary: 'Clear the final guard, retire the authorization node, and extract.',
    briefing: 'Reach the western ruins and enable the archive maintenance terminal. Clear its guard, then disable the final carrier node at the north gate. That action triggers the archive’s last finite defense group. Defeat it and hold south extraction for five seconds. An integrity record is optional.',
    debrief: 'The authorization node is retired and the last defense group is defeated. You extracted with the evidence. The carrier can no longer issue hostile deployment orders.',
    suggestedEquipment: 'Your preferred combat loadout; use pickups between the two bounded encounters.', firstCompletionXp: 400,
    objects: [terminal('maintenance', 'Enable archive maintenance', [-12, 1, -6]), terminal('carrier-node', 'Retire final carrier node', [2, 1, -20], true), item('integrity', 'Recover integrity record', [10, 1, 18])],
    objectives: [o('ruins', 'Reach the western ruins', 'reach', [], { position: [-12, 0, -6], radius: 3 }), o('maintenance', 'Enable archive maintenance', 'activate', ['ruins'], { objectId: 'maintenance' }), o('guard', 'Clear the maintenance guard', 'eliminate', ['maintenance'], { encounterIds: ['guard'], position: [-12, 0, -6] }), o('retire', 'Retire the final carrier node', 'interact', ['guard'], { objectId: 'carrier-node' }), o('final', 'Defeat the final defense group', 'eliminate', ['retire'], { encounterIds: ['final-defense'], position: [0, 0, -20] }), side('integrity'), extract(['final'], [0, 0, 22], 5)],
    encounters: [encounter('guard', ['maintenance'], [-12, 0, -6], [['fantasy-scout-west', 'flanker'], ['fantasy-rifleman-east', 'rifleman']]), encounter('final-defense', ['retire'], [0, 0, -20], [['fantasy-heavy-gate', 'heavy'], ['fantasy-scout-west', 'defender'], ['fantasy-sniper-bridge', 'rifleman']])], checkpoints: cp('guard', [-12, 0, -6]),
  },
];

export function getMission(id: string): MissionDefinition {
  const mission = MISSIONS.find((entry) => entry.id === id);
  if (!mission) throw new Error(`Unknown mission: ${id}`);
  return mission;
}
