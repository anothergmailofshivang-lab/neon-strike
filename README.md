# NEON STRIKE

NEON STRIKE is an original browser-based single-player 3D FPS in development. The current foundation includes the ten-operation **Carrier Zero** campaign, five arena modes and maps, five operatives, procedural customization, weapon loadouts, local career progression, six tactical/utility items, resource pickups, interactive world objects, and versioned local preferences.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- A modern desktop browser with WebGL support

## Installation

```bash
npm install
```

## Development

Start the Vite development server:

```bash
npm run dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173/`.

## Production build and preview

```bash
npm run build
npm run preview
```

## Tests

Run the unit and real-physics integration tests:

```bash
npm test
```

Run TypeScript validation alone:

```bash
npm run typecheck
```

## Architecture

- `src/main.ts` — creates the single `GameApp` entry point.
- `src/app/GameApp.ts` — coordinates initialization, lifecycle, state, loop, rendering, and cleanup.
- `src/campaign/` — validated mission definitions, authoritative objectives/encounters, collision-checked ground routes, extraction, in-session checkpoints, ratings, and persistent campaign records.
- `src/ui/CampaignPanel.ts` — AppShell-owned campaign selector and briefing panel; existing results/HUD/minimap render mission state.
- `src/app/GameConfig.ts` — typed foundational configuration and validation.
- `src/app/GameState.ts` — explicit application states and legal transitions.
- `src/engine/Renderer.ts` — one Three.js WebGL renderer, sizing, render calls, and disposal.
- `src/engine/SceneManager.ts` — shared scene and observation-camera ownership; MapManager owns active map roots and environment lighting.
- `src/engine/GameLoop.ts` — bounded fixed-step simulation scheduling and render scheduling.
- `src/engine/InputManager.ts` — centralized keyboard held/pressed/released state and reset behavior.
- `src/engine/AppLifecycle.ts` — document visibility lifecycle subscription.
- `src/engine/Diagnostics.ts` — development performance and runtime diagnostics overlay.
- `src/world/PracticeArena.ts` — reusable procedural ground, boundaries, obstacles, platforms, landmarks, and materials.
- `src/physics/CollisionWorld.ts` — shared Rapier arena geometry, owned door/prop colliders, swept-sphere queries, and kinematic capsule movement.
- `src/world/MapDefinition.ts` / `src/world/MapInstance.ts` — typed map metadata and active-map ownership.
- `src/world/MapRegistry.ts` — validated map catalog and selection metadata.
- `src/world/MapManager.ts` — map build, collision replacement, validation, activation, unload, rollback, and disposal lifecycle.
- `src/world/MapValidation.ts` — structural, spawn-support, capsule-clearance, navigation, cover, pickup, training-target, and control-point validation.
- `src/world/maps/` — distinct Modern City, Industrial Facility, Jungle Frontier, Sci-Fi Facility, and Fantasy Ruins procedural builders and catalog.
- `src/world/geometry/` — reusable map geometry, material, lighting, floor, boundary, ramp, rail, and trim helpers.
- `src/navigation/NavigationGraph.ts` / `src/navigation/AStarPathfinder.ts` — tagged navigation graph and deterministic A* routes.
- `src/navigation/WalkableNavigation.ts` — attaches mode objective approach nodes only after real floor, capsule-clearance, and route checks.
- `src/world/CoverRegistry.ts` — world-geometry-validated cover point registry and cover scoring.
- `src/ai/NPCManager.ts` — encounter lifecycle, registration, reset, respawn, and AI diagnostics summary.
- `src/ai/NPCController.ts` — fixed-step NPC movement, perception-driven states, combat decisions, health, and lifecycle.
- `src/ai/NPCDefinitions.ts` / `src/ai/NPCDifficulty.ts` — Scout, Rifleman, Heavy, Sniper, Flanker, and Defender data plus Easy/Normal/Hard/Expert tuning.
- `src/ai/NPCPerception.ts` / `src/ai/NPCMemory.ts` — FOV, range, static-world line of sight, last-known target memory, sound/damage memory, and decay.
- `src/ai/NPCWeaponAdapter.ts` — NPC firing adapter over the shared `WeaponRuntime` catalog and `DamageSystem`.
- `src/characters/NPCCharacterFactory.ts` — procedural NPC body, critical head region, and weapon visuals.
- `src/characters/CharacterTypes.ts` / `src/characters/CharacterDefinitions.ts` — typed operative identities, palettes, silhouettes, and supported visual variants.
- `src/characters/CharacterRegistry.ts` / `src/characters/CharacterCustomization.ts` — validated character catalog and appearance-selection state.
- `src/characters/CharacterFactory.ts` — disposable procedural character models used by previews and NPC visual variants.
- `src/characters/CharacterPreview.ts` — isolated character/weapon preview scene rendered through the existing renderer with scissor bounds.
- `src/characters/CharacterVisualAdapter.ts` — first-person cosmetic forearm/accent presentation that does not affect player collision.
- `src/characters/NPCVisualVariants.ts` — archetype-to-character appearance mapping independent of NPC behavior.
- `src/player/PlayerController.ts` — player system coordinator and lifecycle owner.
- `src/player/PlayerMotor.ts` — fixed-step acceleration, friction, sprint, air control, jumping, gravity, ground state, and recovery.
- `src/player/PlayerLook.ts` — yaw/pitch mouse-look with sensitivity and pitch limits.
- `src/player/PlayerCamera.ts` — player-root camera hierarchy and optional restrained head-bob/landing presentation.
- `src/player/PointerLockManager.ts` — user-initiated pointer capture and browser state handling.
- `src/player/PlayerConfig.ts` — validated movement/look/camera tuning and local settings persistence.
- `src/player/PlayerState.ts` — movement-state and diagnostics snapshot types.
- `src/weapons/WeaponDefinitions.ts` — validated catalog containing the seven Phase 02 weapons.
- `src/weapons/WeaponRuntime.ts` — ammunition, cooldown, reload, aiming, and runtime-state invariants.
- `src/weapons/WeaponInventory.ts` — runtime instances and development weapon cycling.
- `src/weapons/WeaponController.ts` — centralized weapon input, firing modes, spread, hit resolution, recoil, switching, and HUD status.
- `src/weapons/WeaponPresentation.ts` — procedural first-person weapon models and firing presentation.
- `src/cosmetics/WeaponSkinDefinitions.ts` / `src/cosmetics/WeaponSkinRegistry.ts` — validated Standard, Neon Circuit, Sandstorm, Arctic, and Dark Carbon skin catalog.
- `src/cosmetics/WeaponSkinApplicator.ts` — cosmetic-only weapon material application.
- `src/loadouts/LoadoutManager.ts` / `src/loadouts/LoadoutValidator.ts` — primary/secondary weapons and tactical/utility equipment slot validation.
- `src/persistence/SaveManager.ts` / `src/persistence/SaveSchema.ts` / `src/persistence/SaveMigrations.ts` — versioned local character, appearance, loadout, and skin preferences.
- `src/persistence/ProgressionSaveManager.ts` / `src/progression/` — recoverable local career profile, XP, level thresholds, match history, achievements, UTC challenges, weapon mastery, reward entitlements, and exact-once progression transactions.
- `src/weapons/RecoilController.ts` — weapon-specific camera recoil and recovery.
- `src/weapons/AmmoPickupSystem.ts` — existing pickup owner extended to ammunition, health, and equipped-item charges in every mode.
- `src/equipment/` — six validated equipment definitions and finite-charge/cooldown runtime state.
- `src/tactical/TacticalEquipmentService.ts` — player/NPC equipment activation, simulation-time status effects, resupply, and match cleanup.
- `src/tactical/ThrowableSimulation.ts` / `src/tactical/ExplosionResolver.ts` — swept throwable movement and cover-aware damage through the shared damage system.
- `src/tactical/VisibilityFieldRegistry.ts` / `src/tactical/TacticalEffects.ts` — smoke sight obstruction and bounded presentation effects.
- `src/tactical/InteractionManager.ts` / `src/tactical/DoorController.ts` — contextual interactions, real switch lights, and animated solid doors.
- `src/tactical/DestructibleObject.ts` / `src/tactical/DestructibleManager.ts` — registered damageable props and owned collider lifecycle.
- `src/tactical/TacticalEvents.ts` / `src/progression/MatchCombatTracker.ts` — equipment/resource events and authoritative per-match progression aggregation.
- `src/combat/HitDetection.ts` — camera-center target raycast combined with Rapier world obstruction.
- `src/combat/DamageSystem.ts` — validated damage, falloff, critical-hit, and defeat pipeline.
- `src/combat/Damageable.ts` / `src/combat/DamageTypes.ts` — shared damageable and hit-region contracts.
- `src/combat/CombatEvents.ts` — typed combat event bus.
- `src/match/MatchTypes.ts` — authoritative match settings, participant statistics, teams, objective state, phases, and events.
- `src/match/GameModeDefinitions.ts` — validated Free-for-All, Team Deathmatch, Domination, Survival, and Practice definitions.
- `src/match/MatchSession.ts` — fixed-step match clock, countdown, round lifecycle, once-only elimination/scoring, timeout/tie resolution, and results snapshot.
- `src/match/ObjectiveManager.ts` — world control-point markers, capture/contest state, passive objective scoring, and minimap objective state.
- `src/targets/TargetDummy.ts` / `src/targets/TargetRange.ts` — reusable health-bearing practice targets with body and critical regions.
- `src/player/PlayerHealth.ts` — player-side `Damageable` health target used by NPC fire.
- `src/effects/CombatEffects.ts` — bounded muzzle/tracer/impact presentation effects.
- `src/audio/WeaponAudio.ts` — lightweight local Web Audio weapon and reload feedback.
- `src/ui/AppShell.ts` — mode/map/settings setup, pre-match summary, pause, mode-aware combat HUD, scoreboard, kill feed, results actions, and match-only minimap mount.
- `src/ui/Minimap.ts` — map-data-driven live minimap using active navigation topology, player position/yaw, and visible or temporarily sensor-revealed NPC markers.
- `src/styles/main.css` — full-window layout and restrained neon-industrial visual styling.

## Current feature status

The main menu now opens a real Phase 6 match setup flow. It presents Free-for-All, Team Deathmatch, Domination, Elimination/Survival, and Training Range, then applies the selected mode, map, difficulty, duration, score limit, NPC population, rounds, operative, and loadout to one authoritative match session. The player receives a real countdown before combat. Free-for-All uses independent NPC factions and a shared elimination board; Team Deathmatch uses local allied/enemy teams and authoritative friendly-fire blocking; Domination uses three map-authored control points with capture progress, contesting, passive score ticks, world markers, and minimap state; Survival uses one-life rounds and controlled intermissions; Practice uses the existing real weapon/target systems without a competitive result. All modes share the existing player, weapon, damage, NPC, map, minimap, and fixed-step loop systems. Match results contain actual scores and participant statistics, and Rematch/Change Setup/Main Menu clear transient state.

The grounded movement basis follows the player yaw hierarchy and has regression coverage across all eight cardinal/diagonal headings; pitch remains camera-only. Multiplayer, online accounts, and network synchronization remain deferred.

Phase 7 progression is integrated with finalized `MatchSession` results and the shared combat event bus. Non-practice matches award a documented XP breakdown for completion, result, verified eliminations, objective activity, and completed Survival rounds. A local profile stores career totals, bounded recent match history, achievement progress, deterministic UTC daily/weekly challenges, per-weapon mastery, cosmetic entitlements, and equipped title/badge state. Existing Phase 5 weapon skins remain starter-accessible; progression adds Signal Flare, Ion Bloom, and Mastery Chrome finishes without changing weapon gameplay values.

Phase 8 adds selectable frag, smoke, and flash throwables; recovery, ammo, and sensor utilities; health/equipment pickups; a working hinged door and light switches; and one designated destructible prop on each map. Equipment shares the existing fixed-step loop, Rapier world, damage/score authority, NPC perception, minimap, and progression transaction path. Every equipment choice is starter-accessible.

## Phase 09 campaign: Carrier Zero

Open **Campaign · Carrier Zero** from the main menu, select an available operation, review its briefing and current operative/loadout, choose the existing AI difficulty, and press **Deploy**. Completing an operation unlocks the next; completed operations remain replayable. The campaign follows a stolen authorization signal through the City, Industrial Facility, Jungle Frontier, Sci-Fi Facility, and the Old Guard historical combat simulation represented by Fantasy Ruins.

The ten implemented operations are **Dead Air**, **Perimeter Receipt**, **Cold Ledger**, **Breaker Window**, **Green Trace**, **Carrier Hold**, **Glass Witness**, **Black Circuit**, **Archive Keep**, and **Last Carrier**. They combine movement, item recovery, terminal activation/shutdown, real control-point capture, bounded encounters, area defense, and physical extraction. Mission objects use the existing **E** interaction; equipment retains **G/H**.

- Mandatory objectives unlock in dependency order; optional records affect ratings/rewards but never block extraction.
- Extraction requires standing in its active region without hostile presence for the displayed hold duration. Leaving or contesting resets that countdown. Pause freezes mission clocks and objectives.
- Checkpoints are **in-session only**. A quiet milestone records completed objectives/encounters. Failure can offer checkpoint retry, which reconstructs the world with full starting health, ammunition, and equipment. Closing/reloading/leaving the operation discards that checkpoint.
- Failed-attempt combat after the checkpoint is rolled back for career/mastery credit. Total mission time, damage, defeated-hostile count, and retry count remain in the run's performance record. Full restart creates a new run.
- Successful missions use the existing progression transaction for ordinary gameplay rewards, a first-completion bonus, and 25 XP for each previously unrecorded optional objective. Failures/aborts grant no completion XP. Completing the campaign earns **Signal Restored**, including its profile title.
- Campaign progress is stored inside profile schema **4**, preserving earlier career/equipment data. Checkpoint worlds are not serialized.

See **[PHASE9.md](PHASE9.md)** for the full mission table, architecture and file inventory, checkpoint/rating/reward policies, executed test results, and remaining manual checks. The automated suite exercises all ten objective sequences, but these checks are not graphical or difficulty-balancing playthroughs.

## Current map catalog

| Map | Layout and combat identity | Verticality | Active metadata |
|---|---|---|---|
| MODERN CITY (`modern-city`) | Neon avenue, sidewalks, commercial/residential blocks, park, two accessible interiors, and vehicles | Mostly ground-level with connected interior and alley routes | 10 navigation nodes, 7 cover points, 4 NPC spawns, 3 ammo pickups, 3 targets |
| INDUSTRIAL FACILITY (`industrial-facility`) | Cargo-container lanes, loading bay, exposed long lane, flank route | Loading ramp and raised platform | 11 navigation nodes, 7 cover points, 4 NPC spawns, 3 ammo pickups, 3 targets |
| JUNGLE FRONTIER (`jungle-forest`) | Dense trees, rocks, forest trails, cabin interior, stream crossing, and outpost | Bridge crossing and varied natural cover | 10 navigation nodes, 6 cover points, 4 NPC spawns, 3 ammo pickups, 3 targets |
| SCI-FI FACILITY (`sci-fi-facility`) | Lower arena, exposed bridges, sheltered cover, layered sightlines | Two upper platforms and two supported ramps | 12 navigation nodes, 6 cover points, 4 NPC spawns, 3 ammo pickups, 3 targets |
| FANTASY RUINS (`fantasy-ruins`) | Castle gate, village houses, market square, ruined wall, towers, bridge, and rune crystal | Towers, castle walls, and bridge crossing | 9 navigation nodes, 6 cover points, 4 NPC spawns, 3 ammo pickups, 3 targets |

Each map also has one health pickup and one frag-charge pickup. The match HUD includes a live minimap only while the application is in `PLAYING`. Its route lines, cover nodes, map bounds, player marker, yaw arrow, and NPC markers derive from the active map instance. Ordinary enemy markers require visibility; the equipped sensor pulse temporarily reveals nearby hostile NPCs even through cover or smoke.

## Phase 05 character and loadout catalog

| Operative | Visual identity | Supported appearance | NPC use |
|---|---|---|---|
| VANGUARD | Balanced tactical armor with cyan identification | Two palettes, visor/helmet, standard/reinforced outfit, shoulder plate | Rifleman |
| VOLT | Angular lightweight specialist with circuitry | Two palettes, visor variants, standard/pulse outfit, back cell | Scout and Flanker |
| BASTION | Broad reinforced graphite armor with orange accents | Two palettes, helmet variants, standard/bulwark outfit, shoulder/back accessories | Heavy |
| GHOSTLINE | Narrow precision operative with cool visor | Two palettes, visor/hooded visor, standard/longcoat outfit, shoulder plate | Sniper |
| CIRCUIT | Robotic synthetic training unit with sensor core | Two palettes, sensor variants, standard/industrial outfit, back cell | Defender |

Loadouts use the authoritative Phase 02 weapon catalog with one primary and one secondary slot. The initial cosmetic skin catalog contains Standard Issue, Neon Circuit, Sandstorm, Arctic, and Dark Carbon. Skin application changes only owned presentation materials; damage, cadence, ammunition, spread, recoil, and range remain definition data.

Character, appearance, loadout, and skin preferences are stored under the versioned `neon-strike.player-preferences` local-storage key. Invalid or obsolete values fall back to VANGUARD and the default assault-rifle/pistol configuration.

## Weapon and combat architecture

Weapon definitions are immutable catalog data. Each equipped weapon gets an independent `WeaponRuntime`, while `WeaponController` owns input, firing cadence, pellet/burst behavior, switching, recoil, presentation, and hit resolution. `HitDetection` combines Three.js target-region intersections with a Rapier world ray query so walls block target damage. `DamageSystem` validates falloff and critical multipliers before calling the shared `Damageable` contract. Combat events drive hit markers, target feedback, HUD messages, audio, and practice statistics without allowing presentation effects to apply damage.

## Phase 06 gameplay rules

| Mode | Rules | Resolution |
|---|---|---|
| FREE-FOR-ALL | Player and NPCs are independent participants; NPCs select visible valid rivals and respawn when enabled. | First participant to the elimination limit, or highest score at timeout; equal scores draw. |
| TEAM DEATHMATCH | Player-team and enemy-team NPCs use stable team IDs, allied bots avoid allied targets, and friendly fire is rejected by `DamageSystem`. | First team to the elimination limit, or higher team score at timeout; equal scores draw. |
| DOMINATION | Three map-authored points capture over fixed simulation time, pause while contested, and award periodic team score while owned. | First team to the control score limit, or higher score at timeout; equal scores draw. |
| ELIMINATION / SURVIVAL | Hostile NPCs are cleared in configured rounds with a countdown/intermission and no NPC respawns inside a round. | Clear every configured round for victory; player elimination causes defeat. |
| TRAINING RANGE | No competitive NPC roster or score; existing map targets, weapons, pickups, movement, and reset controls remain available. | Practice ends when the player returns to setup/menu. |

The match session is transient. It owns the countdown, active/intermission/paused/completed phases, fixed-step elapsed time, participants, team score, objective states, rounds, attribution, and results snapshot. Application state still owns menu, loading, playing, pause, and results presentation. A completed session rejects late score/elimination/objective events.

Default controls:

- `W/A/S/D`: move.
- `Shift`: sprint.
- `Space`: jump.
- Left mouse: fire.
- Right mouse: aim down sights where supported.
- `R`: reload.
- `1`: A-17 Pulse Rifle.
- `2`: K-4 Sidekick.
- `Q` or mouse wheel: cycle the development weapon catalog.
- `G`: release the equipped tactical throwable.
- `H`: use the equipped recovery, ammo, or sensor utility.
- `E`: interact with the indicated door or switch; resource pickups collect automatically on approach.
- `Escape`: pause and release pointer lock.

Starting weapon catalog:

| Weapon | Mode | Damage | Interval | Magazine | Reserve | Reload | Range | Special behavior |
|---|---|---:|---:|---:|---:|---:|---:|---|
| A-17 Pulse Rifle | Automatic | 18 | 0.10 s | 30 | 120 | 1.8 s | 100 | Balanced sustained fire and ADS |
| VX-9 Sting | Automatic | 11 | 0.06 s | 36 | 144 | 1.5 s | 65 | Fast close-range fire with stronger spread growth |
| BR-8 Scattercaster | Pellet | 9 × 10 | 0.80 s | 8 | 48 | 2.2 s | 35 | Ten independently resolved pellets |
| L-90 Longwatch | Semiautomatic | 90 | 1.10 s | 5 | 25 | 2.4 s | 180 | High-damage precision ADS |
| K-4 Sidekick | Semiautomatic | 24 | 0.25 s | 12 | 72 | 1.25 s | 80 | Responsive secondary weapon |
| BR-3 Triad | Burst | 16 × 3 | 0.07 s burst interval | 24 | 96 | 1.9 s | 110 | Three-round bursts with recovery |
| E-77 Arc Lance | Energy | 30 | 0.22 s | 20 | 80 | 1.7 s | 120 | Luminous energy pulse behavior |

## Phase 08 tactical equipment

Choose one **tactical** and one **utility** item in **Configure Character & Loadout**, then save the configuration. Defaults are frag grenade and field recovery. HUD slots show the binding, charges, readiness, cooldown, and recovery progress. Held keys do not repeat equipment use.

| Item / stable ID | Slot | Starting / maximum charges | Behavior |
|---|---|---:|---|
| Frag grenade / `frag-grenade` | Tactical | 2 / 2 | 1.4s fuse; 4.5m blast radius; up to 95 damage, falling linearly to zero at the edge; 0.35s use cooldown. |
| Smoke grenade / `smoke-grenade` | Tactical | 2 / 2 | 0.7s fuse; 5.5m spherical sight-obstruction field for 8s; 0.35s cooldown. Blocks NPC line of sight and ordinary enemy minimap visibility. |
| Flash device / `flash-device` | Tactical | 1 / 1 | 0.8s fuse; 6m radius; up to 2.2s disorientation, reduced by distance and facing; 0.35s cooldown. Cover blocks exposure. |
| Field recovery / `med-kit` | Utility | 1 / 1 | Restores up to 38 HP after 1.2s uninterrupted recovery; 1.2s cooldown after completion. |
| Ammo pack / `ammo-pack` | Utility | 1 / 1 | Adds up to 35 reserve rounds **per weapon** in the existing seven-weapon development inventory, capped by each weapon definition; 1.2s cooldown. Does not fill magazines. |
| Sensor pulse / `sensor-pulse` | Utility | 1 / 1 | Reveals hostile NPCs detected within 28m for 6s on the existing minimap; 2s cooldown. Death, expiry, or match/round cleanup removes the reveal. |

### Simulation, damage, and resource rules

- All six items work in all five modes. Selection is pre-match; changing saved equipment does not refill a running match.
- Throws release immediately along the camera direction. A 0.13m swept sphere checks the release path and subsequent motion against the shared world. Blocked releases do not spend a charge. Movement uses 120Hz internal substeps, 13m/s initial speed, gravity, and damped bounces; it does not create a second physics world or render loop.
- Fuses, cooldowns, fields, and pickup respawns advance only during active simulation. Pause freezes released grenades. Damage, pause, or death cancels unfinished recovery without consuming its charge; already released grenades remain live after owner death while the match is active.
- Blasts use distance falloff and a cover ray to each target's representative point. Exposure is resolved before any prop is removed. Damage, defeat attribution, team filtering, score, and results pass through the existing `DamageSystem` and `MatchSession`. Frag self-damage is allowed; allied damage is blocked. Flash also excludes allies but can affect its owner; smoke obstructs all teams.
- Equipment charges persist through player/NPC respawns and Survival rounds. Round transitions clear deployed projectiles, smoke, flash, and sensor effects. Pickups, destroyed props, and switch/door state persist between rounds. New matches reset these world resources; Training Range's pause-menu reset also restores them.
- Full-health recovery and a completely full reserve inventory reject use without spending a charge. Health never exceeds maximum; defeated players cannot heal, collect, interact, or deploy equipment. Pickup respawns and NPC door movement continue while a player awaits respawn.
- Active presentation is bounded to 12 projectiles, 4 smoke fields, and 48 transient effects. Deploying a fifth smoke field replaces the oldest. Match teardown disposes temporary geometry/materials and clears match-owned colliders, statuses, and prompts; application disposal also releases long-lived listeners and shared resources.

### Pickups and authored world objects

Pickups collect automatically within 1.4m when unobstructed and useful. Cyan pickups restore reserve ammunition using existing amounts/capacities; green pickups restore up to 28 HP and respawn after 12s; orange pickups restore one equipped frag charge and respawn after 16s. A frag pickup does not refill smoke, flash, or utility slots. Unneeded pickups remain available. Prompts appear within 2.5m when they can help.

| Map | Interactions | Designated destructible |
|---|---|---|
| Modern City | `city-house-door`: opening/closing hinged door with matching collider; `city-house-control`: linked door control; `city-market-console`: market beacon light | `city-crate-alley`, 80 HP |
| Industrial Facility | `industrial-loading-switch`: loading signal light | `industrial-crate-west`, 95 HP |
| Jungle Frontier | `forest-outpost-switch`: outpost light | `forest-supply-crate`, 80 HP |
| Sci-Fi Facility | `sci-fi-terminal`: facility floodlight | `sci-fi-panel`, 90 HP |
| Fantasy Ruins | `fantasy-gate-switch`: gate lantern | `fantasy-timber-crate`, 80 HP |

Interaction prompts require range, facing, and unobstructed sight. Door movement waits for occupied passages; nearby NPCs can request opening. The other panels toggle actual local illumination. Designated props receive normal weapon/explosion damage, disappear once at zero HP, and release their solid collider; ordinary map structures remain intact. Breaking a prop is not a combatant elimination.

Rifleman and Defender NPCs receive one frag per match; Scouts receive one smoke for use below 45% health. Decisions retain ordinary perception/reaction gates. Frag candidates use the same trajectory simulator, a visible target 8–14m away horizontally, and self/ally landing-clearance checks. Other archetypes retain weapon-only behavior. Smoke interrupts sight acquisition; flash temporarily suppresses acquisition and combat targeting.

### Phase 7 progression and save compatibility

`MatchCombatTracker` captures equipment uses, hostile explosive damage/eliminations, useful resource collections, and designated prop destruction. Tactical kills affect normal match results but do not add weapon shots, hits, or mastery. The killing hit is aggregated before completion can finalize a match.

Completed non-Practice matches commit these counters through the existing progression transaction. Abandoned matches and Practice award no career progress. Three one-time achievements were added: `blast-confirmed` (3 explosive eliminations, 100 XP), `field-supplies` (10 useful pickups, 75 XP), and `breach-work` (5 designated props, 75 XP). The permanent `permanent-blast-drill` challenge awards 125 XP for 5 explosive eliminations. Gadget activation and light toggles do not directly grant XP.

Preferences migrate from schema 1 to 2 under the existing `neon-strike.player-preferences` key; previous weapons, skins, character, and appearance are preserved while missing/obsolete equipment falls back to valid defaults. Career profiles migrate from schema 2 to 3 using the existing profile/backup storage. New tactical counters start at zero; XP, match history, entitlements, and existing challenge/mastery progress are preserved.

### Automated coverage and browser validation

`TacticalEquipment.test.ts`, `TacticalIntegration.test.ts`, and `TacticalProgression.test.ts` cover finite resources, real Rapier projectile sweeps/bounces, release obstruction, blast cover/team rules, recovery/resupply, smoke perception, flash/recon expiry, lifecycle guards, actual NPC decisions, world objects, five-map placement/route regressions, and all-five-mode progression integration. Input and persistence regressions cover the new bindings and save migrations.

Browser visual, Pointer Lock, and audio validation remains a manual task; it was not performed in the development environment. In addition to the controller checklist below:

1. Select/save each tactical and utility item, reload, and verify the HUD and restored selections.
2. Throw upward, horizontally, downward, and near walls; pause mid-flight and verify motion/fuse resume without extra deployment.
3. Compare exposed and covered blast targets; verify self-damage, allied protection, kill feed, score, and completion on the final elimination.
4. Use smoke and flash near NPCs; compare visible fields, perception, and bounded overlays. Trigger a sensor and observe hidden-enemy reveal and expiry.
5. Use recovery while injured, interrupt it with damage/pause, and compare charges; use ammo after firing/reloading and approach full/needed resource pickups.
6. Open/close the City house door from both sides, stand in its passage, and observe NPC requests. Toggle each map's light and destroy its designated prop.
7. Repeat death, Survival round changes, Practice reset, results, rematch, and map switching; check charges, cleanup, and prompts.
8. Complete a non-Practice match, reload the career profile, and verify tactical counters/rewards were committed once without grenade weapon-mastery gains.

## Deferred scope

- Ranked play, online accounts, server-verified challenge rotation, and network synchronization remain deferred.
- Multiplayer, backend services, network replication, and remote accounts remain out of scope.
- Advanced movement such as crouching and sliding remains deferred.

## Manual controller validation

1. Run `npm run dev` and open the Vite URL in a desktop browser with WebGL, Web Audio, and Pointer Lock support.
2. Select each of the five modes, choose a map, review the live pre-match summary, and enter the match; accept browser pointer capture.
3. Verify the countdown prevents movement/firing/AI damage until it reaches zero, then verify mouse-look, `W/A/S/D`, `Shift`, and `Space`.
4. In Free-for-All, eliminate NPCs, observe the kill feed/score/timer, wait for a respawn, and verify timeout/score-limit results.
5. In Team Deathmatch, verify allied/enemy team rows, allied NPC behavior, enemy targeting, team score, and no friendly-fire damage.
6. In Domination, enter each control zone, observe capture progress, contesting, world rings/labels, passive score ticks, objective HUD, and minimap markers.
7. In Survival, clear each round, verify intermission/countdown transitions, health/ammo reset behavior, and final victory/defeat results.
8. In Training Range, fire the actual configured weapons at the map targets, collect ammo, and verify no competitive score/result is shown.
9. Fire the default rifle at a target and verify ammunition, tracer, muzzle flash, hit marker, health response, and damage feedback.
10. Aim at a target through a wall and verify that no target damage is applied.
11. Use `R`, `1`, `2`, `Q`, and the mouse wheel to verify reloads, weapon switching, ammunition separation, and distinct weapon presentation.
12. Test the shotgun critical/body regions, burst rifle cadence, sniper ADS, pistol semiautomatic behavior, and energy rifle effects.
13. Collect a cyan ammunition pickup and verify that reserve ammunition increases only once before respawn.
14. Press `Escape` or use **Pause**, then resume through the pause menu and verify firing and pointer capture are restored without catch-up shots.
15. Use the pause-menu sliders to change sensitivity and field of view; toggle head bob.
16. Enable development diagnostics from the gameplay HUD and inspect player state, position, velocity, pointer lock, and renderer metrics.
17. Observe NPC perception, navigation, different ranges, and wall occlusion; verify hidden enemies do not appear on the minimap unless temporarily sensor-revealed.
18. Shoot NPC bodies/heads, verify shared damage/defeat feedback, kill attribution, score exactly once, and supported respawns.
19. Verify player defeat, respawn-enabled modes, one-life Survival defeat, and pause/resume freezing of NPCs, objectives, timers, and damage.
20. Return to setup, select a different map, and verify new collision, lighting, pickups, objectives, targets, NPC spawns, navigation, cover, and minimap data.
21. Repeat transitions through all five maps and confirm old geometry, NPCs, paths, pickups, objectives, targets, timers, scores, and markers do not remain active.
22. Open **Configure Character & Loadout**, select each operative, change palettes and variants, and inspect the isolated 3D preview.
23. Configure a primary and secondary weapon, apply different skins, preview a weapon, save the configuration, and verify the actual first-person model and slot switching.
24. Reload the browser and verify the saved operative, appearance, weapons, and skins are restored.
25. Open Career Profile, Challenges, Achievements, Weapon Mastery, and Collection from setup; verify the level bar, UTC challenge period, owned rewards, and per-weapon counters are populated from the local profile.
26. Complete a non-practice match, inspect the XP breakdown and unlocks in results, reopen the results path if available, and verify the same match does not award a second time.
27. Reload the browser and verify career XP, match history, challenge progress, mastery, entitlements, and equipped title/badge state persist.

## Known limitations

- Browser WebGL rendering requires a compatible desktop browser and graphics environment.
- Browser automation is not configured in this foundation, so Pointer Lock, visual controller behavior, weapon presentation, and audio should be manually checked with the development server.
- Rapier is loaded as a deferred browser chunk; its compatibility build is approximately 2 MB before compression and is reported by Vite as a large chunk. This keeps the initial application chunk smaller while preserving a validated kinematic controller API.
- The player and NPC colliders are standing capsules. Crouching, sliding, dynamic bodies, and advanced bunny-hop mechanics are deferred.
- The five procedural maps use explicit simplified box colliders aligned to their solid structures; arbitrary mesh collision conversion is not implemented yet.
- The current map transition path is synchronous because all Phase 04 geometry is procedural and locally generated. It still exposes explicit lifecycle states and rejects re-entrant transitions; asynchronous asset cancellation is deferred until external assets are introduced.
- Browser integration tests for WebGL rendering, Pointer Lock, visual traversal, and audio were not run in the development environment because Chromium/Playwright is unavailable.
- Phase 6 match preferences are currently session-local; character, appearance, loadout, skin, sensitivity, field of view, and head-bob preferences retain the existing persistence behavior.
- Objective bot routing attaches validated ground approach nodes to the authored map navigation; complex elevated traversal remains dependent on each map's authored graph and needs manual visual traversal.
- Character and weapon previews are procedural local geometry; no external rigged character assets or full skeletal animation library is required.
- Character customization currently changes palettes, outfit/head variants, supported accessories, and first-person cosmetic accents. It does not change gameplay statistics or collision dimensions.
- Save preferences use browser local storage when available; storage failures preserve the active configuration for the current session.
- Weapon audio uses local Web Audio tones as a dependency-free fallback rather than final production assets.
- Tactical visuals are procedural meshes and bounded pulses. Smoke uses a spherical visibility approximation; blast protection uses a single representative-point ray per target, not partial-body exposure sampling.
- Throwables do not have skeletal hand animations, a trajectory preview, or rigid-body interactions with actors. Flash affects NPC targeting and a restrained player overlay, not camera control.
- Phase 8 supplies one actual City door and one destructible on each map; light panels do not implement security terminals or opening castle gates. Dynamic navigation rebuilding, structural destruction, deployable cover, and NPC healing/resupply are not implemented.
- Equipment resources are finite per match, but the authored frag pickups respawn. Smoke, flash, and utility charges have no map refill; gear selection remains starter-accessible and does not change weapon balance.
