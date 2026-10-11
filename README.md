# NEON STRIKE

NEON STRIKE is an original browser-based single-player 3D FPS in development. The current foundation includes five selectable operatives, procedural character previews, appearance customization, primary/secondary loadouts, weapon skins, NPC visual variants, five distinct combat maps, a live match-only minimap, and versioned local preferences.

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

Run the deterministic unit tests:

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
- `src/app/GameConfig.ts` — typed foundational configuration and validation.
- `src/app/GameState.ts` — explicit application states and legal transitions.
- `src/engine/Renderer.ts` — one Three.js WebGL renderer, sizing, render calls, and disposal.
- `src/engine/SceneManager.ts` — shared scene and observation-camera ownership; MapManager owns active map roots and environment lighting.
- `src/engine/GameLoop.ts` — bounded fixed-step simulation scheduling and render scheduling.
- `src/engine/InputManager.ts` — centralized keyboard held/pressed/released state and reset behavior.
- `src/engine/AppLifecycle.ts` — document visibility lifecycle subscription.
- `src/engine/Diagnostics.ts` — development performance and runtime diagnostics overlay.
- `src/world/PracticeArena.ts` — reusable procedural ground, boundaries, obstacles, platforms, landmarks, and materials.
- `src/physics/CollisionWorld.ts` — Rapier 3D static arena colliders and kinematic capsule movement adapter.
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
- `src/loadouts/LoadoutManager.ts` / `src/loadouts/LoadoutValidator.ts` — primary/secondary slot validation over the authoritative weapon catalog.
- `src/persistence/SaveManager.ts` / `src/persistence/SaveSchema.ts` / `src/persistence/SaveMigrations.ts` — versioned local character, appearance, loadout, and skin preferences.
- `src/weapons/RecoilController.ts` — weapon-specific camera recoil and recovery.
- `src/weapons/AmmoPickupSystem.ts` — bounded practice ammunition pickups.
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
- `src/ui/Minimap.ts` — map-data-driven live minimap using active navigation topology, player position/yaw, and only currently visible NPC markers.
- `src/styles/main.css` — full-window layout and restrained neon-industrial visual styling.

## Current feature status

The main menu now opens a real Phase 6 match setup flow. It presents Free-for-All, Team Deathmatch, Domination, Elimination/Survival, and Training Range, then applies the selected mode, map, difficulty, duration, score limit, NPC population, rounds, operative, and loadout to one authoritative match session. The player receives a real countdown before combat. Free-for-All uses independent NPC factions and a shared elimination board; Team Deathmatch uses local allied/enemy teams and authoritative friendly-fire blocking; Domination uses three map-authored control points with capture progress, contesting, passive score ticks, world markers, and minimap state; Survival uses one-life rounds and controlled intermissions; Practice uses the existing real weapon/target systems without a competitive result. All modes share the existing player, weapon, damage, NPC, map, minimap, and fixed-step loop systems. Match results contain actual scores and participant statistics, and Rematch/Change Setup/Main Menu clear transient state.

The grounded movement basis follows the player yaw hierarchy and has regression coverage across all eight cardinal/diagonal headings; pitch remains camera-only. Multiplayer, progression, crouching, and sliding remain deferred.

## Current map catalog

| Map | Layout and combat identity | Verticality | Active metadata |
|---|---|---|---|
| MODERN CITY (`modern-city`) | Neon avenue, sidewalks, commercial/residential blocks, park, two accessible interiors, and vehicles | Mostly ground-level with connected interior and alley routes | 10 navigation nodes, 7 cover points, 4 NPC spawns, 3 ammo pickups, 3 targets |
| INDUSTRIAL FACILITY (`industrial-facility`) | Cargo-container lanes, loading bay, exposed long lane, flank route | Loading ramp and raised platform | 11 navigation nodes, 7 cover points, 4 NPC spawns, 3 ammo pickups, 3 targets |
| JUNGLE FRONTIER (`jungle-forest`) | Dense trees, rocks, forest trails, cabin interior, stream crossing, and outpost | Bridge crossing and varied natural cover | 10 navigation nodes, 6 cover points, 4 NPC spawns, 3 ammo pickups, 3 targets |
| SCI-FI FACILITY (`sci-fi-facility`) | Lower arena, exposed bridges, sheltered cover, layered sightlines | Two upper platforms and two supported ramps | 12 navigation nodes, 6 cover points, 4 NPC spawns, 3 ammo pickups, 3 targets |
| FANTASY RUINS (`fantasy-ruins`) | Castle gate, village houses, market square, ruined wall, towers, bridge, and rune crystal | Towers, castle walls, and bridge crossing | 9 navigation nodes, 6 cover points, 4 NPC spawns, 3 ammo pickups, 3 targets |

The match HUD includes a live minimap only while the application is in `PLAYING`. Its simplified route lines, cover nodes, map bounds, player marker, yaw arrow, and visible-enemy markers are derived from the active map instance; hidden NPCs are not revealed.

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

## Deferred scope

- Progression, XP, unlocks, achievements, economy, ranked play, and availability rules remain deferred.
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
5. Aim at a target through a wall and verify that no target damage is applied.
6. Use `R`, `1`, `2`, `Q`, and the mouse wheel to verify reloads, weapon switching, ammunition separation, and distinct weapon presentation.
7. Test the shotgun critical/body regions, burst rifle cadence, sniper ADS, pistol semiautomatic behavior, and energy rifle effects.
8. Collect a cyan ammunition pickup and verify that reserve ammunition increases only once before respawn.
9. Press `Escape` or use **Pause**, then resume through the pause menu and verify firing and pointer capture are restored without catch-up shots.
10. Use the pause-menu sliders to change sensitivity and field of view; toggle head bob.
11. Enable development diagnostics from the gameplay HUD and inspect player state, position, velocity, pointer lock, and renderer metrics.
12. Observe NPC perception, navigation, different ranges, and wall occlusion; verify hidden enemies do not appear on the minimap.
13. Shoot NPC bodies/heads, verify shared damage/defeat feedback, kill attribution, score exactly once, and supported respawns.
14. Verify player defeat, respawn-enabled modes, one-life Survival defeat, and pause/resume freezing of NPCs, objectives, timers, and damage.
15. Return to setup, select a different map, and verify new collision, lighting, pickups, objectives, targets, NPC spawns, navigation, cover, and minimap data.
16. Repeat transitions through all five maps and confirm old geometry, NPCs, paths, pickups, objectives, targets, timers, scores, and markers do not remain active.
17. Open **Configure Character & Loadout**, select each operative, change palettes and variants, and inspect the isolated 3D preview.
18. Configure a primary and secondary weapon, apply different skins, preview a weapon, save the configuration, and verify the actual first-person model and slot switching.
19. Reload the browser and verify the saved operative, appearance, weapons, and skins are restored.

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
