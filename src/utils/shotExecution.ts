import type { SceneGraphNode, ShotRuntimeState } from '../types/graph';

export interface ShotRuntimeMeta {
  state: ShotRuntimeState;
  progress: number;
  stage: string;
  lastAction: string;
}

export interface ShotSequenceItem {
  id: string;
  title: string;
  order: number;
  state: ShotRuntimeState;
  progress: number;
  stage: string;
  lastAction: string;
  isCurrent: boolean;
}

const shotWeight = (title: string) => {
  const m = title.match(/shot\s*(\d+)/i);
  if (m) return Number(m[1]);
  return Number.MAX_SAFE_INTEGER;
};

export const sortShotsInSequence = (shots: SceneGraphNode[]) =>
  [...shots].sort((a, b) => {
    const w = shotWeight(a.title) - shotWeight(b.title);
    if (w !== 0) return w;
    if (a.position.y !== b.position.y) return a.position.y - b.position.y;
    return a.position.x - b.position.x;
  });

export const getCurrentShotIndex = (shots: ShotSequenceItem[]) => {
  const forced = shots.findIndex((s) => s.isCurrent);
  if (forced >= 0) return forced;
  const active = shots.findIndex((s) => ['active', 'compiling', 'routed', 'rendering', 'review'].includes(s.state));
  if (active >= 0) return active;
  const waiting = shots.findIndex((s) => s.state === 'waiting');
  if (waiting >= 0) return waiting;
  return -1;
};

export const nextShotState = (state: ShotRuntimeState): ShotRuntimeState => {
  if (state === 'completed' || state === 'skipped') return state;
  return 'active';
};
