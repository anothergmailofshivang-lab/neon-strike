import { describe, expect, it, vi } from 'vitest';
import { getMission } from '../src/campaign/CampaignCatalog';
import { MissionSession } from '../src/campaign/MissionSession';
import type { MissionDefinition } from '../src/campaign/CampaignTypes';

const position = (x = 0, y = 0, z = 0) => ({ x, y, z });
function active(id = 'dead-air') { const session = new MissionSession(getMission(id), 'normal'); session.prepare(); session.activate(); return session; }
function regionMission(): MissionDefinition {
  return { ...getMission('dead-air'), encounters: [], objects: [], checkpoints: [], objectives: [
    { id: 'reach', title: 'Reach', kind: 'reach', requires: [], position: [10, 0, 0], radius: 2 },
    { id: 'hold', title: 'Hold', kind: 'defend', requires: ['reach'], position: [10, 0, 0], radius: 2, duration: 3 },
    { id: 'optional', title: 'Optional', kind: 'reach', optional: true, requires: [], position: [-10, 0, 0], radius: 2, timeout: 2 },
    { id: 'extract', title: 'Extract', kind: 'extract', requires: ['hold'], position: [0, 0, 0], radius: 2, duration: 2 },
  ] };
}
const tick = (session: MissionSession, seconds: number, point = position(), rate = 60) => { for (let i = 0; i < seconds * rate; i++) session.update(1 / rate, point, []); };

describe('mission authority and objectives', () => {
  it('prepares, activates once, freezes pause and retains its previous phase', () => {
    const session = new MissionSession(getMission('dead-air'), 'hard');
    session.activate(); expect(session.phase).toBe('preparing'); session.prepare(); session.pause(true); session.activate(); expect(session.phase).toBe('paused');
    session.pause(false); expect(session.phase).toBe('countdown'); session.activate(); session.activate();
    tick(session, 1); session.pause(true); tick(session, 5); expect(session.snapshot().statistics.seconds).toBeCloseTo(1);
    session.pause(false); tick(session, 1); expect(session.snapshot().statistics.seconds).toBeCloseTo(2);
  });
  it('counts only registered encounter members once and requires a real interaction event', () => {
    const session = active(); expect(session.interact('trace')).toBe(false); expect(session.getReadyEncounters()).toEqual([]);
    session.update(0.1, position(0, 0, 9), []);
    expect(session.getReadyEncounters()).toEqual(['relay-guards']);
    expect(session.startEncounter('relay-guards', ['a'])).toBe(false);
    expect(session.startEncounter('relay-guards', ['a', 'b'])).toBe(true);
    expect(session.startEncounter('relay-guards', ['a', 'b'])).toBe(false);
    session.defeated('unrelated'); session.defeated('a'); session.defeated('a');
    expect(session.isCompleted('guards')).toBe(false); session.defeated('b'); expect(session.isCompleted('guards')).toBe(true);
    expect(session.snapshot().statistics.eliminations).toBe(2); expect(session.checkpoint?.checkpointId).toBe('secured-stage');
    expect(session.interact('trace')).toBe(false); expect(session.interact('market-reader')).toBe(true); expect(session.interact('market-reader')).toBe(false);
    expect(session.interact('trace')).toBe(true); expect(session.phase).toBe('active');
  });
  it('requires positions, pauses contested defense, and allows optional expiry without blocking extraction', () => {
    const session = new MissionSession(regionMission(), 'normal'); session.prepare(); session.activate();
    tick(session, 1, position(0)); expect(session.isCompleted('reach')).toBe(false);
    session.update(0.1, position(10), []); tick(session, 2, position(10));
    const before = session.snapshot().objectives.find((o) => o.id === 'hold')!.progress;
    for (let i = 0; i < 60; i++) session.update(1 / 60, position(10), [position(10)]);
    expect(session.snapshot().objectives.find((o) => o.id === 'hold')!.progress).toBe(before);
    tick(session, 2, position(10)); expect(session.isCompleted('hold')).toBe(true);
    expect(session.snapshot().objectives.find((o) => o.id === 'optional')?.state).toBe('failed');
    tick(session, 2, position()); expect(session.result?.outcome).toBe('success'); expect(session.result?.rating).toBe('bronze');
  });
  it('extraction resets outside/contested, freezes during pause, and resolves exactly once', () => {
    const definition = regionMission(); definition.objectives = [definition.objectives[3]]; definition.objectives[0].requires = [];
    const session = new MissionSession(definition, 'normal'), listener = vi.fn(); session.subscribe(listener); session.prepare(); session.activate();
    tick(session, 1); tick(session, 0.1, position(10)); expect(session.snapshot().objectives[0].progress).toBe(0);
    tick(session, 1); session.pause(true); tick(session, 5); expect(session.phase).toBe('paused'); session.pause(false);
    session.update(0.1, position(), [position()]); expect(session.snapshot().objectives[0].progress).toBe(0);
    tick(session, 2); expect(session.phase).toBe('success'); session.defeated('player'); session.fail('late failure'); tick(session, 5);
    expect(listener.mock.calls.filter(([event]) => event.type === 'resolved')).toHaveLength(1); expect(session.phase).toBe('success');
  });
  it('failure cannot be overwritten by a delayed interaction or extraction', () => {
    const session = active(); session.damageTaken(100); session.defeated('player'); session.defeated('player'); session.interact('trace'); tick(session, 20, position(2, 0, -14));
    expect(session.result).toMatchObject({ outcome: 'failure', rating: 'none', statistics: { damageTaken: 100 } });
  });
  it('defense is frame-rate independent and clamps tab-sized deltas', () => {
    const run = (rate: number) => { const s = new MissionSession(regionMission(), 'easy'); s.prepare(); s.activate(); tick(s, 2, position(10), rate); return s.snapshot(); };
    expect(run(30).objectives.find((o) => o.id === 'hold')?.progress).toBeCloseTo(run(60).objectives.find((o) => o.id === 'hold')!.progress, 1);
    const session = active('breaker-window'); session.interact('transmitter'); session.update(300, position(0, 0, -4), []);
    expect(session.snapshot().statistics.seconds).toBe(0.25); expect(session.isCompleted('hold')).toBe(false);
  });
  it('mandatory time limits fail and safe checkpoint restoration preserves identity without old events', () => {
    const original = active('breaker-window'); original.interact('transmitter'); const checkpoint = original.checkpoint!;
    tick(original, 121, position(20)); expect(original.result?.outcome).toBe('failure');
    const restored = new MissionSession(original.definition, 'normal', original.sessionId, { checkpoint, carry: original.snapshot().statistics });
    restored.prepare(); restored.activate(); expect(restored.isCompleted('shutdown')).toBe(true); expect(restored.getReadyEncounters()).toEqual(['response']);
    expect(restored.snapshot().statistics.retries).toBe(1); expect(restored.sessionId).toBe(original.sessionId);
    original.defeated('player'); expect(restored.phase).toBe('active');
    expect(() => new MissionSession(original.definition, 'normal', 'wrong-id', { checkpoint, carry: original.snapshot().statistics })).toThrow(/checkpoint/);
  });
  it('abort locks progress and a full restart uses a fresh run ID', () => {
    const original = active(); original.abort(); expect(original.phase).toBe('aborted'); original.activate(); expect(original.interact('market-reader')).toBe(false);
    const next = active(); expect(next.sessionId).not.toBe(original.sessionId); expect(next.snapshot().objectives.some((o) => o.state === 'completed')).toBe(false);
  });
});
