import { CAMPAIGN, MISSIONS, getMission } from '../campaign/CampaignCatalog';
import { isMissionUnlocked, recommendedMission } from '../campaign/CampaignProgress';
import type { CampaignDifficulty, CampaignProgress } from '../campaign/CampaignTypes';
import type { PlayerLoadout } from '../loadouts/LoadoutTypes';
import type { MapDefinition } from '../world/MapDefinition';
import { getWeaponDefinition } from '../weapons/WeaponDefinitions';
import { getEquipmentDefinition, normalizeEquipmentId } from '../equipment/EquipmentCatalog';

/** An AppShell-owned menu panel, with no simulation or reward authority. */
export class CampaignPanel {
  public readonly element: HTMLElement;
  private progress!: CampaignProgress;
  private selectedId = MISSIONS[0].id;
  private operative = '';
  private loadout!: PlayerLoadout;
  private difficulty: CampaignDifficulty = 'normal';
  private error = '';
  public constructor(parent: HTMLElement, private readonly maps: readonly MapDefinition[], private readonly callbacks: { deploy: (id: string, difficulty: CampaignDifficulty) => void; back: () => void; customize: () => void }) {
    this.element = document.createElement('section'); this.element.className = 'overlay campaign-overlay'; this.element.hidden = true;
    this.element.setAttribute('role', 'dialog'); this.element.setAttribute('aria-modal', 'true'); this.element.setAttribute('aria-label', 'Carrier Zero campaign');
    parent.appendChild(this.element);
  }
  public show(progress: CampaignProgress, operative: string, loadout: PlayerLoadout, error = ''): void {
    this.progress = progress; this.operative = operative; this.loadout = loadout; this.error = error;
    this.selectedId = progress.selectedMissionId; this.difficulty = progress.difficulty; this.render(); this.element.hidden = false;
    this.element.querySelector<HTMLButtonElement>('[data-mission-selected="true"]')?.focus();
  }
  public setVisible(value: boolean): void { this.element.hidden = !value; }
  private render(): void {
    this.element.replaceChildren();
    const panel = el('div', '', 'interface-panel campaign-panel');
    const completed = MISSIONS.filter((m) => this.progress.records[m.id]?.completedAt).length;
    panel.append(el('p', 'SINGLE-PLAYER OPERATIONS', 'eyebrow'), el('h1', CAMPAIGN.name), el('p', CAMPAIGN.premise, 'lead'),
      el('p', `${completed} / ${MISSIONS.length} COMPLETED · ${Math.round(completed / MISSIONS.length * 100)}% · NEXT: ${recommendedMission(this.progress).name}`, 'career-strip'));
    if (completed === MISSIONS.length) panel.append(el('p', CAMPAIGN.conclusion, 'campaign-conclusion'));
    if (this.error) { const error = el('p', this.error, 'status-message campaign-error'); error.setAttribute('role', 'alert'); panel.append(error); }
    const layout = el('div', '', 'campaign-layout'), list = el('div', '', 'campaign-missions');
    for (const [index, mission] of MISSIONS.entries()) {
      const available = isMissionUnlocked(this.progress, mission), record = this.progress.records[mission.id];
      const card = button('', () => { this.selectedId = mission.id; this.render(); this.element.querySelector<HTMLElement>('.campaign-briefing')?.focus(); }, 'campaign-card');
      card.disabled = !available; card.dataset.missionId = mission.id; card.dataset.missionSelected = String(mission.id === this.selectedId);
      card.setAttribute('aria-pressed', String(mission.id === this.selectedId));
      card.append(el('small', `${String(index + 1).padStart(2, '0')} · ${mission.chapter}`), el('strong', mission.name),
        el('span', `${this.maps.find((m) => m.id === mission.mapId)?.displayName ?? mission.mapId} · ${record?.completedAt ? 'COMPLETED / REPLAY' : available ? 'AVAILABLE' : 'LOCKED'}`),
        el('small', record?.best ? `BEST ${record.best.rating.toUpperCase()} · OPTIONAL ${record.optionalObjectives.length}/${mission.objectives.filter((o) => o.optional).length}` : available ? mission.summary : `Complete ${getMission(mission.requires[0]).name}`));
      list.append(card);
    }
    const mission = getMission(this.selectedId), detail = el('section', '', 'campaign-briefing'); detail.tabIndex = -1;
    detail.append(el('p', mission.chapter, 'eyebrow'), el('h2', mission.name), el('p', this.maps.find((m) => m.id === mission.mapId)?.displayName ?? mission.mapId, 'campaign-location'), el('p', mission.briefing));
    const objectives = el('ol');
    for (const objective of mission.objectives.filter((o) => !o.optional)) objectives.append(el('li', objective.title));
    detail.append(objectives, el('p', mission.objectives.filter((o) => o.optional).map((o) => o.title).join(' · '), 'campaign-optional'), el('p', `SUGGESTED: ${mission.suggestedEquipment}`));
    detail.append(el('p', `${this.operative} · ${getWeaponDefinition(this.loadout.primaryWeaponId).displayName} / ${getWeaponDefinition(this.loadout.secondaryWeaponId).displayName} · ${getEquipmentDefinition(normalizeEquipmentId(this.loadout.tacticalEquipmentId, 'tactical')).displayName} / ${getEquipmentDefinition(normalizeEquipmentId(this.loadout.utilityEquipmentId, 'utility')).displayName}`, 'setup-summary'));
    const label = el('label', 'Difficulty '), select = document.createElement('select'); select.setAttribute('aria-label', 'Campaign difficulty');
    for (const id of ['easy', 'normal', 'hard', 'expert'] as const) { const option = el('option', id.toUpperCase()); option.value = id; select.append(option); }
    select.value = this.difficulty; select.addEventListener('change', () => { this.difficulty = select.value as CampaignDifficulty; }); label.append(select); detail.append(label);
    detail.append(el('p', 'Checkpoint recovery is in-session only: a milestone saves when all currently spawned hostiles are defeated. Retry rebuilds with full starting health, ammo, and equipment on every difficulty. Leaving or reloading discards the checkpoint.', 'progression-note'));
    detail.append(el('p', `RATING: Bronze = extract; Silver = all optional records; Gold = Silver, no retry, ≤100 damage; Elite = Gold, ≤40 damage${mission.timeGoal ? ` and ≤${mission.timeGoal}s` : ''}. Exact best-record ties retain the earlier result.`, 'progression-note'));
    const last = [...this.progress.recentResults].reverse().find((r) => r.missionId === mission.id);
    const best = this.progress.records[mission.id]?.best;
    if (best) detail.append(el('p', `BEST: ${best.rating.toUpperCase()} · ${best.difficulty.toUpperCase()} · ${Math.round(best.statistics.seconds)}s · ${Math.round(best.statistics.damageTaken)} damage · ${best.statistics.retries} retries`, 'progression-note'));
    if (last) detail.append(el('p', `LAST RUN: ${last.outcome.toUpperCase()} · ${last.reason}`, 'progression-note'));
    const deploy = button('Deploy', () => this.callbacks.deploy(mission.id, this.difficulty), 'primary-button'); deploy.disabled = !isMissionUnlocked(this.progress, mission); deploy.dataset.action = 'deploy';
    detail.append(deploy, button('Configure Character & Loadout', this.callbacks.customize, 'secondary-button'), button('Back to Arena Setup', this.callbacks.back, 'secondary-button'));
    layout.append(list, detail); panel.append(layout); this.element.append(panel);
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; }
export function button(text: string, action: () => void, className = 'secondary-button'): HTMLButtonElement { const node = el('button', text, className); node.type = 'button'; node.addEventListener('click', action); return node; }
