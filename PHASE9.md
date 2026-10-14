# Phase 9 — Carrier Zero implementation report

## A. Existing architecture audit

The Phase 8 baseline contained one `GameApp`, Three.js rendering, a fixed-step loop, shared Rapier collision, player/weapon/equipment systems, local NPC controllers, five maps, and five arena modes. `MatchSession` owned arena countdown, scoring, round resolution and results. `ObjectiveManager` implemented genuine control-point capture. `InteractionManager` owned E-key proximity/facing/cover checks, a City door and local light switches. Phase 7 profile transactions, mastery, achievements, challenges and recoverable local storage were already present. No campaign existed.

The baseline passed **32 files / 92 tests** and the production build. Two dependencies were extended: externally directed match resolution, and staged NPC creation through the existing manager. The campaign also uses a collision-validated ground navigation graph because several legacy authored graph links cross solid geometry. Arena navigation remains map-authored.

## B. Phase 9 files

### Added

| File | Responsibility |
|---|---|
| `src/campaign/CampaignTypes.ts` | Definition, runtime, checkpoint, result and persistent-record contracts |
| `src/campaign/CampaignCatalog.ts` | Original premise, ten operations, briefings/debriefings, objectives, world objects, rosters, checkpoints and reward amounts |
| `src/campaign/MissionValidation.ts` | Stable IDs, dependency/unlock DAGs, extraction route, supported objectives, roster/reward bounds and reference validation |
| `src/campaign/MissionWorld.ts` | Real-world support/clearance checks, spawn resolution and connected ground routes; invalid placements fail launch |
| `src/campaign/MissionSession.ts` | Mission lifecycle, objective dependencies, encounter membership, timers, terminal events, extraction and safe milestone state |
| `src/campaign/MissionRuntime.ts` | Existing NPC, combat, capture and interaction adapters; disposable objects/markers and listener ownership |
| `src/campaign/MissionResult.ts` | Transparent rating and deterministic best-record comparison |
| `src/campaign/CampaignProgress.ts` | Campaign normalization, derived unlocks, recommendations, result validation and draft record updates |
| `src/ui/CampaignPanel.ts` | AppShell-owned selection, briefing, difficulty/loadout display and deployment controls |
| `tests/CampaignCatalog.test.ts` | Catalog rejection cases and real-physics placement/connectivity checks for every mission |
| `tests/MissionSession.test.ts` | Lifecycle, dependencies, encounters, timers, extraction, failure, abort and checkpoint validation |
| `tests/CampaignIntegration.test.ts` | Scripted completion of all ten real-world objective/encounter/interaction sequences and campaign reward chain |
| `tests/CampaignProgression.test.ts` | Ratings, replays, unlocks, migrations, corrupt records, storage errors and transaction idempotency |
| `tests/CampaignUI.test.ts` | Happy DOM tests of actual GameApp/AppShell deployment, retries, results, pause/abort and failed-load recovery |
| `PHASE9.md` | This implementation report and validation boundaries |

### Modified

| Files | Responsibility |
|---|---|
| `src/app/GameApp.ts` | Shared deployment/update/results lifecycle, mission subscriptions, checkpoint rebuild, abort and arena-setting restoration |
| `src/ai/NPCManager.ts` | Bounded staged rosters using normal controllers and shared registries |
| `src/match/MatchSession.ts` | External resolution authority and preparing-state checkpoint statistics restoration |
| `src/match/ObjectiveManager.ts` | Mission-configured points, active-point filtering, restored ownership and disabled passive arena score during missions |
| `src/tactical/InteractionManager.ts` | Generic mission target registration through the same E-key detector; explicit door opening |
| `src/progression/MatchCombatTracker.ts` | Checkpoint combat snapshot/restore, including per-run prop-credit deduplication |
| `src/progression/ProgressionTypes.ts` | Profile schema 4, campaign section, mission history metadata and persistence result status |
| `src/progression/ProfileService.ts` | Initialize/normalize campaign data while retaining the existing profile |
| `src/progression/ProgressionMigrations.ts` | Profile 3→4 migration |
| `src/progression/ProgressionService.ts` | Atomic campaign records plus existing XP/mastery/challenge/achievement processing |
| `src/progression/ChallengeService.ts` | Ordinary gameplay contributions remain eligible; campaign runs do not impersonate arena-mode-specific challenges |
| `src/progression/AchievementCatalog.ts`, `src/progression/AchievementService.ts` | Signal Restored achievement from actual successful mission records |
| `src/progression/RewardCatalog.ts` | Earnable Signal Restored profile title |
| `src/ui/AppShell.ts` | Campaign entry, live tracker, outcome-specific debriefs, checkpoint/replay/next-operation actions and mission-aware history |
| `src/ui/Minimap.ts` | Mandatory/optional/extraction symbols; dense AI navigation grid is not rendered as a fake route overlay |
| `src/styles/main.css` | Operations-console layout, focus/disabled states, bounded scrollable results, tracker and reliable hidden controls |
| `package.json`, `package-lock.json` | Happy DOM development dependency for UI integration tests |
| `README.md` | Campaign launch instructions, resource/retry semantics and report link |

The workspace already contained uncommitted Phase 7/8 changes. The inventory above describes Phase 9 additions/edits, not every difference from the repository's last commit.

## C. Mission architecture

Definitions, active state and persistent progress are separate. A `MissionSession` uses `preparing → countdown → active → success/failure/aborted`; pause remembers active/countdown. Briefings and selections are existing main-menu presentation, not a parallel application state machine. The match owns the shared countdown, participant statistics and combat gating; an externally directed mission owns its result conditions. The internal match configuration uses one-life Survival settings, but automatic Survival victory and Survival-specific career rewards/challenges are disabled for mission runs.

Objectives have stable IDs and explicit prerequisite graphs. Supported runtime kinds are reach, escape, eliminate, secure, capture, interact, recover, activate, defend, survive and extract. Mandatory/optional status and optional deadlines are data. Sequences are dependency graphs; designated encounter completion is the eliminate condition. An extraction route must depend on every mandatory objective. Objective changes emit typed events; HUD refresh does not award anything.

Before launch, references and dependencies are validated. On the real loaded map, every spawn, checkpoint, objective, item approach and encounter destination must have supporting ground, capsule clearance and a connected route. All current mission routes are ground-level. The graph uses bounded 2m cells and checked edges; it does not assume the legacy graph crosses walls safely. No extra Rapier world or render loop is introduced.

## D. Implemented campaign content

Carrier Zero follows a stolen authorization signal that is commanding local security units. Evidence leads from city manifests through an industrial supplier and forest listening post to a research installation. Its remaining carrier is contained inside **Old Guard**, a historical combat simulation represented by the existing Fantasy Ruins map and normal armed NPCs.

All operations use the selected operative/loadout and existing Easy/Normal/Hard/Expert AI tuning. Suggested gear does not change saved selections or combat values. Durations have not been measured through manual playthroughs, so no estimated playtime is advertised.

| # / stable ID | Map | Mandatory sequence | Optional objective | Success condition |
|---|---|---|---|---|
| 1. **Dead Air** / `dead-air` | Modern City | Reach market approach → clear 2 relay guards → enable market reader → recover trace cartridge | Recover park recorder | Reach north avenue extraction and hold 3s |
| 2. **Perimeter Receipt** / `perimeter-receipt` | Modern City | Capture park beacon → authorize residence access/open real door → recover perimeter manifest | Recover café-side record | Reach south extraction and hold 3s; patrol elimination is not mandatory |
| 3. **Cold Ledger** / `cold-ledger` | Industrial Facility | Reach west loading lane → clear 2 shipping guards → recover ledger on loading apron | Recover north-lane consignment tag | Reach west service extraction and hold 3s |
| 4. **Breaker Window** / `breaker-window` | Industrial Facility | Disable transmitter → defend apron for 20 uncontested seconds and defeat 3 response NPCs within 120s | Recover backup tag | Reach west extraction and hold 5s |
| 5. **Green Trace** / `green-trace` | Jungle Frontier | Reach cabin approach → recover field recorder → secure stream bank for 8 consecutive uncontested seconds | Recover outpost log | Reach south trail extraction and hold 3s; search-patrol elimination is not mandatory |
| 6. **Carrier Hold** / `carrier-hold` | Jungle Frontier | Enable clearing relay → defend 25 uncontested seconds and defeat 3 assault NPCs → recover transmission cartridge | Recover north-trail bearing | Reach stream-bank extraction and hold 3s |
| 7. **Glass Witness** / `glass-witness` | Sci-Fi Facility | Capture lower west court → recover signing sample → defeat 2 interceptors | Recover lower-hall audit record | Reach lower east-court extraction and hold 3s |
| 8. **Black Circuit** / `black-circuit` | Sci-Fi Facility | Disable lower uplink → disable west return link → survive 12s and defeat 2 responders → leave west isolation radius | Recover checksum recorder | Reach south extraction and hold 3s |
| 9. **Archive Keep** / `archive-keep` | Fantasy Ruins | Capture gate-side point → recover archive key → defeat 2 sentinels | Recover western annotation | Reach market extraction and hold 3s |
| 10. **Last Carrier** / `last-carrier` | Fantasy Ruins | Reach western ruins → enable maintenance → defeat 2 guards → retire carrier node → defeat final 3-NPC group | Recover integrity record | Reach south extraction and hold 5s; then show campaign conclusion |

The intact Fantasy north wall is traversed around its outside lanes, not through a fictional gate opening. Industrial objectives use the accessible apron/lanes, not the solid loading-bay mesh's nonexistent interior. The Sci-Fi operations use its connected lower courts rather than unsupported upper traversal.

## E. NPC encounter integration

Encounters instantiate normal `NPCController`s through `NPCManager`, using existing archetypes, weapons, perception, difficulty, navigation and tactical equipment. Spawn IDs resolve to real map metadata. Each encounter has an explicit inactive/ready/active/completed/cancelled state and an exact member set. Real defeat events remove eligible members once; unrelated props/NPCs do not complete the encounter.

Groups activate on objective progress. A group waits if its entrance is within 5m of the player or overlaps another living NPC; it never falls back to world origin. Each group has at most four members, every current operation has at most five total NPCs, and the runtime limit is eight. NPCs have no mission respawns. Their destination is the authored region, not hidden player information.

Runtime entity IDs contain a fresh attempt token. Teardown removes the combat subscription and shared NPC registrations. Mission damage policy rejects old, unregistered sources, preventing an earlier run's NPC from damaging a new run.

## F. Interactions and extraction

Mission terminals and items are real disposable meshes registered with Phase 8 `InteractionManager`. The same **E** input, range, facing and cover checks apply. A future/completed objective cannot activate its item. Collection hides the item immediately and removes its prompt eligibility; duplicate collection is rejected.

The catalog lists every object with a stable ID and position. Terminal actions change actual terminal illumination/state and activate explicit successors: recovery availability, an encounter, extraction, or the City residence door. Shutdown consoles begin lit and turn off; enabled consoles turn on. The City access panel requests the existing solid door to open, retaining occupancy safeguards.

Extraction is a real region objective. It appears only after required stages. The living player must stay in its radius for 3 or 5 simulation seconds with no hostile in that region. Leaving or contesting resets extraction progress; pause freezes it. Completion locks objective updates and resolves the shared match once. Optional records can be skipped.

World rings use depth testing; active mandatory, optional and extraction targets also appear on the existing minimap. Hidden enemies retain existing visibility/sensor rules. No fabricated route line or all-enemy reveal is added.

## G. Checkpoints, failure and restart

Each operation declares one checkpoint milestone. It is captured only if every currently active encounter has been cleared at that milestone. For example, bypassing the Perimeter Receipt patrol can mean no checkpoint is earned. The HUD reports a checkpoint only when it actually exists.

Checkpoint state is **memory-only** and retains the same mission run ID. It contains the validated checkpoint ID, completed objective/encounter IDs, and a separate plain combat-statistics snapshot. Retry constructs a new attempt, loads a clean map, restores durable mission item/terminal/capture state, keeps completed encounters removed, and rebuilds remaining encounters. Old projectiles, statuses, NPCs, markers, interactions and timers are cleared. Health, weapon ammunition, and equipment return to their normal starting values on all difficulties; ordinary pickups, doors and props reset, except explicit durable mission door actions are reapplied.

Career/mastery events since the checkpoint are rolled back on retry. Already credited prop IDs are retained to prevent the reset crate from earning duplicate destruction credit. Total mission time, received damage, hostile defeats and retry count remain cumulative for run performance; these can therefore differ from the surviving branch's career combat totals.

Player elimination and mandatory objective timeout cause failure. Encounter creation errors also produce a real failure reason. A failed debrief offers checkpoint retry only when a valid snapshot exists, plus full restart/exit. Failure is recorded when the player restarts or leaves; checkpoint continuation keeps the run open and grants no failure reward. A browser reload discards an unfinished/provisionally failed run and its checkpoint.

Full restart receives a new run ID. Confirmed abort records an abort without completion rewards. Existing successful records/unlocks survive failures, aborts and replays. Leaving restores arena settings and uses the normal application teardown.

## H. Results and progression

### Ratings

- **Bronze:** successfully complete mandatory objectives and extract.
- **Silver:** Bronze plus all optional records.
- **Gold:** Silver, zero checkpoint retries and no more than 100 run damage.
- **Elite:** Gold, no more than 40 run damage; **Breaker Window** additionally requires completion within its disclosed 240s goal.
- Failure/abort: **none**.

Other missions do not value speed. Accuracy is not used or advertised in campaign ratings. Best records compare rating, optional count, fewer retries, less damage, then time only for the timed mission. Exact ties retain the earlier verified result and its recorded difficulty; difficulty has no hidden rating multiplier.

### Rewards and records

`ProgressionService.finalizeMission()` validates mission/result/session/map/difficulty consistency, then uses the same profile draft transaction as ordinary XP, mastery, achievements and challenges. Successful runs retain ordinary completion/result/combat contributions. First-completion bonuses are 200/200/225/225/250/250/275/275/300/400 XP in sequence. A previously unrecorded optional objective grants 25 XP once for that mission. Replays can earn normal successful-run rewards, but not repeat first-completion or previously owned optional bonuses.

**Signal Restored** evaluates ten successful mission records through the existing achievement service: 500 XP and `title:signal-restored`. Campaign milestones and recommendations derive from successful records. Campaign runs do not increment Survival rounds or mode-specific arena challenges merely because they reuse the one-life match configuration.

Failure and abort receive no completion XP, mastery or gameplay challenge reward. Their campaign attempt record is still retained according to the failure policy above. Reopening results is presentation-only. Duplicate transaction handling is tested both in memory and after save reload. Permanent completion/optional ownership remains separate from bounded recent-run ledgers.

## I. Save compatibility

Profile schema **3→4** initializes a `campaign` section with its own schema version 1. Existing profile/backup keys remain `neon-strike.player-profile` and `neon-strike.player-profile.backup`. Phase 5/8 preferences remain in their existing separate key/schema.

Campaign data contains selected mission/difficulty, per-mission completion/best/optional/attempt records, milestones, at most 20 recent results and 100 recent processed-run IDs. Unlocks are derived rather than maintaining a contradictory second list. New missions are initialized from the catalog. Removed/unknown mission records are ignored independently; valid unrelated career and campaign progress remains intact. Bad timestamps/statistics/dependency records are rejected or normalized, and ratings are recomputed from supported fields.

Existing recoverable JSON storage handles corrupt primary data and backup fallback. Storage failure preserves current-session state/idempotency; the mission result reports when local persistence was unavailable. No checkpoint transforms, live scene, NPC positions, projectiles or raw object references are serialized.

## J. Executed verification

Final Phase 9 code verification:

| Command/check | Actual result |
|---|---|
| Baseline `npm test` | 32 files, 92 tests passed |
| Baseline `npm run build` | Passed |
| Focused catalog, objective, world integration, progression and DOM checks | Passed after fixing discovered issues |
| `npm run typecheck` | Passed |
| Final `npm test` | **37 files, 135 tests passed** |
| Final `npm run build` | Passed; includes `tsc --noEmit` and Vite production bundling |
| `git diff --check` | Passed |
| Lint | No lint script is configured |
| Browser executable discovery | No Chromium/Chrome executable found |
| Graphical browser/Web Audio/real Pointer Lock checks | **Not performed** |

The ten world integration cases use real Rapier maps, actual NPC controllers and damage events, actual interaction detection/item changes, the shared capture system, extraction and the complete unlock/reward chain. They script actor positions and combat hits; they are **not ten human playthroughs or difficulty-balancing tests**.

Happy DOM checks run actual `GameApp` and `AppShell` code with real physics and NPC/damage services. Only GPU rendering, browser pointer capture and the wall-clock loop scheduler are adapted. These verify disabled locks, selected difficulty/map deployment, pause/resume, abort, old-source rejection, real checkpoint restoration, prop-credit deduplication, debrief/reward idempotency, next-operation navigation and failed-load recovery. They do not verify pixels, audio, real capture permissions, or CSS layout in a graphical browser.

Regression coverage includes movement, camera math, collisions, weapons, equipment, NPC combat/navigation, all maps, arena modes, progression, persistence, cosmetics and minimap. Vite still reports the existing approximately 2 MB uncompressed Rapier compatibility chunk warning.

## K. Limitations and remaining manual checks

- Graphical presentation, audio, real browser capture, practical mission duration, and difficulty balance require manual playthroughs. Automated routes and objective sequences are validated; human traversal/combat quality is not claimed.
- Checkpoints are in-session only and only captured at quiet milestones. There is no exact live-world resume across reload.
- All campaign objectives are ground-level. Elevated map routes remain available as ordinary geometry but are not required campaign routes. There are no cinematics, vehicles, stealth scoring, hacking minigames, protected-object missions, or structural demolition objectives.
- Mission objects are procedural terminals/items and rings; there are no bespoke animated story assets or voiced dialogue. Terminal state affects explicit mission dependencies and local lights/door behavior, not an invented global security simulation.
- Spawn validation and grid construction are bounded but synchronous at deployment. Mission HUD uses compact text/progress plus world/minimap markers, not a screen-space route-arrow system.
- Optional evidence affects records, rewards and ratings; it does not branch the canonical story. Replay leaves already completed story milestones intact.

For manual verification, launch `npm run dev`: play each operation in order, test G/H/E with your chosen loadout, check capture/defense contesting and interrupted extraction, fail after a checkpoint and compare restored state, restart/abort several times, complete/replay an operation and reload the browser, then return to each arena mode. Confirm the final mission requires its final defense group and physical extraction before the campaign conclusion appears.
