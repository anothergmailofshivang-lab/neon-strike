# NEON STRIKE

NEON STRIKE is an original browser-based single-player 3D FPS in development. Phase 05 extends the Phase 00–04 foundation with five selectable operatives, procedural character previews, appearance customization, primary/secondary loadouts, weapon skins, NPC visual variants, and versioned local preferences.

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
- `src/world/MapValidation.ts` — structural, spawn-support, navigation, cover, pickup, and training-target validation.
- `src/world/maps/` — distinct Neon Yard, Dustline Depot, and Skybridge procedural builders and catalog.
- `src/world/geometry/` — reusable map geometry, material, lighting, floor, boundary, ramp, rail, and trim helpers.
- `src/navigation/NavigationGraph.ts` / `src/navigation/AStarPathfinder.ts` — tagged practice navigation graph and deterministic A* routes.
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
- `src/targets/TargetDummy.ts` / `src/targets/TargetRange.ts` — reusable health-bearing practice targets with body and critical regions.
- `src/player/PlayerHealth.ts` — player-side `Damageable` health target used by NPC fire.
- `src/effects/CombatEffects.ts` — bounded muzzle/tracer/impact presentation effects.
- `src/audio/WeaponAudio.ts` — lightweight local Web Audio weapon and reload feedback.
- `src/ui/AppShell.ts` — state-driven startup, pause, settings, combat HUD, crosshair, hit marker, and combat messages.
- `src/styles/main.css` — full-window layout and restrained neon-industrial visual styling.

## Current feature status

Phase 05 is implemented: the main menu opens a functional operative and loadout screen containing Vanguard, Volt, Bastion, Ghostline, and Circuit. Each character has a distinct procedural silhouette, two validated palettes, outfit/head variants, and compatible accessory slots. The selected character is rendered in an isolated 3D preview, while a preview action displays the selected weapon skin through the same procedural weapon model family used in first-person. Primary and secondary weapons are validated against the existing seven-weapon catalog, `1`/`2` switch the configured slots, `Q` and the mouse wheel retain development access to the full catalog, and skins change materials only. The selected appearance drives first-person forearm accents and NPC archetype visual variants without changing collision, health, movement, AI, or weapon statistics. Preferences persist through schema-versioned local storage with safe fallback behavior. Multiplayer, progression, crouching, and sliding remain deferred.

## Phase 04 map catalog

| Map | Layout and combat identity | Verticality | Active metadata |
|---|---|---|---|
| NEON YARD (`neon-yard`) | Compact central training block, side loops, short/medium lanes | West ramp and upper training platform | 10 navigation nodes, 6 cover points, 4 NPC spawns, 3 ammo pickups, 3 targets |
| DUSTLINE DEPOT (`dustline-depot`) | Cargo-container lanes, loading bay, exposed long lane, flank route | Loading ramp and raised platform | 11 navigation nodes, 7 cover points, 4 NPC spawns, 3 ammo pickups, 3 targets |
| SKYBRIDGE (`skybridge`) | Lower arena, exposed bridges, sheltered cover, layered sightlines | Two upper platforms and two supported ramps | 12 navigation nodes, 6 cover points, 4 NPC spawns, 3 ammo pickups, 3 targets |

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

## Upcoming implementation

- Phase 06: progression, XP, unlocks, achievements, and availability rules.
- Later phases: game modes, audio, effects, polish, and optimization.

## Manual controller validation

1. Run `npm run dev` and open the Vite URL in a desktop browser with WebGL, Web Audio, and Pointer Lock support.
2. Select NEON YARD, DUSTLINE DEPOT, or SKYBRIDGE and click the selected **Enter** button; accept the browser's pointer capture.
3. Verify mouse-look, `W/A/S/D`, `Shift`, and `Space` in the arena.
4. Fire the default rifle at a target and verify ammunition, tracer, muzzle flash, hit marker, health response, and damage feedback.
5. Aim at a target through a wall and verify that no target damage is applied.
6. Use `R`, `1`, `2`, `Q`, and the mouse wheel to verify reloads, weapon switching, ammunition separation, and distinct weapon presentation.
7. Test the shotgun critical/body regions, burst rifle cadence, sniper ADS, pistol semiautomatic behavior, and energy rifle effects.
8. Collect a cyan ammunition pickup and verify that reserve ammunition increases only once before respawn.
9. Press `Escape` or use **Pause**, then resume through the pause menu and verify firing and pointer capture are restored without catch-up shots.
10. Use the pause-menu sliders to change sensitivity and field of view; toggle head bob.
11. Enable development diagnostics from the gameplay HUD and inspect player state, position, velocity, pointer lock, and renderer metrics.
12. Observe the four map NPCs using different ranges and movement profiles; verify they stop detecting/shooting through arena walls.
13. Shoot training targets and NPC bodies/heads, verify shared damage/defeat feedback, then wait for defeated NPCs to respawn.
14. Verify the player can be damaged by NPC fire and can reset the complete encounter from the pause menu.
15. Return to the menu, select a different map, and verify that the new collision, lighting, pickups, targets, NPC spawns, navigation, and cover are active.
16. Repeat transitions through all three maps and confirm that old geometry, NPCs, paths, pickups, and targets do not remain active.
17. Open **Configure Character & Loadout**, select each operative, change palettes and variants, and inspect the isolated 3D preview.
18. Configure a primary and secondary weapon, apply different skins, preview a weapon, save the configuration, and verify the actual first-person model and slot switching.
19. Reload the browser and verify the saved operative, appearance, weapons, and skins are restored.

## Known limitations

- Browser WebGL rendering requires a compatible desktop browser and graphics environment.
- Browser automation is not configured in this foundation, so Pointer Lock, visual controller behavior, weapon presentation, and audio should be manually checked with the development server.
- Rapier is loaded as a deferred browser chunk; its compatibility build is approximately 2 MB before compression and is reported by Vite as a large chunk. This keeps the initial application chunk smaller while preserving a validated kinematic controller API.
- The player and NPC colliders are standing capsules. Crouching, sliding, dynamic bodies, and advanced bunny-hop mechanics are deferred.
- The three procedural maps use explicit simplified box colliders aligned to their solid structures; arbitrary mesh collision conversion is not implemented yet.
- The current map transition path is synchronous because all Phase 04 geometry is procedural and locally generated. It still exposes explicit lifecycle states and rejects re-entrant transitions; asynchronous asset cancellation is deferred until external assets are introduced.
- Browser integration tests for WebGL rendering, Pointer Lock, visual traversal, and audio were not run in the development environment because Chromium/Playwright is unavailable.
- Character and weapon previews are procedural local geometry; no external rigged character assets or full skeletal animation library is required.
- Character customization currently changes palettes, outfit/head variants, supported accessories, and first-person cosmetic accents. It does not change gameplay statistics or collision dimensions.
- Save preferences use browser local storage when available; storage failures preserve the active configuration for the current session.
- Weapon audio uses local Web Audio tones as a dependency-free fallback rather than final production assets.
