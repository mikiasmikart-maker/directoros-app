import type { TimelineClip } from '../models/directoros';

export const mockTimelineClips: TimelineClip[] = [
  {
    id: 'clip-001',
    sceneId: 'scene-001',
    start: 0,
    duration: 144,
    label: 'Addis Dawn',
    track: 1,
    emphasis: 'calm',
    overrideNote: 'Hold sunrise for emotional breath before motion picks up.',
    motionBehavior: 'slow cinematic push',
    overrideParams: { pace: 'slow-burn intro' },
  },
  {
    id: 'clip-002',
    sceneId: 'scene-002',
    start: 160,
    duration: 192,
    label: 'Market Energy',
    track: 1,
    emphasis: 'intense',
    overrideNote: 'Punch into rhythm and texture, prioritize movement and micro-details.',
    motionBehavior: 'kinetic handheld drift',
    overrideParams: { pace: 'rhythmic', crowdDensity: 'high' },
  },
];
