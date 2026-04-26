import type { TimelineClip, TimelineState } from '../models/directoros';
import { mockTimelineClips } from '../data/mockTimeline';
import type { RenderQueueJob } from '../render/jobQueue';
import { resolveFamilyPreviewAuthority } from '../utils/familyPreviewAuthority';
import type { FamilyPreviewAuthorityKind, FamilyPreviewEvidenceRole } from '../utils/familyPreviewAuthority';

export const initialTimelineState: TimelineState = {
  currentFrame: 0,
  fps: 24,
  duration: 480,
  clips: mockTimelineClips,
  isPlaying: false,
  playheadPositionMs: 0,
  sessionStartMs: 0,
  sessionEndMs: 0,
};

export const tickFrame = (state: TimelineState): TimelineState => ({
  ...state,
  currentFrame: state.currentFrame >= state.duration ? 0 : state.currentFrame + 1,
});

/**
 * Resolves the active shot (clip) at a given time t (ms).
 */
export const resolveShotAtTime = (t: number, state: TimelineState): TimelineClip | null => {
  // Simple linear search for now, as clip counts are low.
  // Clips are assumed to have start (frame) and duration (frames).
  // We need to convert t (ms) to frames or use startMs/durationMs if they exist.
  const fps = state.fps || 24;
  const currentFrame = Math.floor((t / 1000) * fps);

  return state.clips.find(clip => {
    // Prefer ms-based bounds if available, fallback to frame-based
    if (clip.startMs !== undefined && clip.durationMs !== undefined) {
      return t >= clip.startMs && t < (clip.startMs + clip.durationMs);
    }
    return currentFrame >= clip.start && currentFrame < (clip.start + clip.duration);
  }) ?? null;
};

/**
 * Resolves the "Current Truth" (Authority) for a given shot.
 * Strict Priority Rule: Approved > Winner > Latest Attempt > Currently Selected.
 * 
 * Correction (Phase 3 Vector B):
 * If a job is explicitly selected AND it belongs to this shot, Operator Intent takes top priority.
 */
export const resolveAuthority = (
  sceneId: string, 
  jobs: RenderQueueJob[], 
  selectedJobId?: string
) => {
  const familyJobs = jobs.filter(j => j.sceneId === sceneId).sort((a, b) => b.createdAt - a.createdAt);
  
  // Phase 3 Correction: Operator Intent Override
  // If a job is explicitly selected AND it belongs to this shot, it takes top priority.
  const selected = selectedJobId ? jobs.find(j => j.id === selectedJobId && j.sceneId === sceneId) : undefined;
  if (selected) {
    return { 
      kind: 'selected_attempt' as FamilyPreviewAuthorityKind, 
      job: selected, 
      role: 'supporting_evidence' as FamilyPreviewEvidenceRole 
    };
  }

  // Note: Approved and Winner status are usually derived from projection state or job metadata.
  const approved = familyJobs.find(j => (j as any).isApproved || j.state === 'completed' && (j as any).authorityKind === 'approved_output');
  const winner = familyJobs.find(j => (j as any).isWinner || j.state === 'completed' && (j as any).authorityKind === 'current_winner');
  const latest = familyJobs.find(j => j.state === 'completed'); // Only completed jobs can be authority for preview

  return resolveFamilyPreviewAuthority({
    approvedOutputJob: approved,
    currentWinnerJob: winner,
    selectedAttemptJob: undefined,
    latestAttemptJob: latest,
  });
};
