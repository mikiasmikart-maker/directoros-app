import type { CompositeScoreInput } from './scorer';

export interface GoldenReplayCandidate {
  candidateId: string;
  input: CompositeScoreInput;
}

export interface GoldenReplayShot {
  shotId: string;
  sceneId: string;
  lineageRootJobId: string;
  candidates: GoldenReplayCandidate[];
  expectedBestKnownCandidateId: string;
}

export interface GoldenReplayPack {
  packId: string;
  policyId: string;
  policyHash: string;
  shots: GoldenReplayShot[];
}

export const goldenReplayPackV001: GoldenReplayPack = {
  packId: 'm4_golden_replay_pack_v001',
  policyId: 'm4_weight_policy_v2_0',
  policyHash: 'sha256:m4_weight_policy_v2_0_static_hash',
  shots: [
    {
      shotId: 'shot_012_004',
      sceneId: 'scene_012',
      lineageRootJobId: 'job_root_012_004',
      expectedBestKnownCandidateId: 'job_8f31',
      candidates: [
        {
          candidateId: 'job_8f31',
          input: {
            technicalQuality: 0.86,
            promptStyleAdherence: 0.78,
            continuityMatch: 0.74,
            motionStability: 0.67,
            operatorConfidence: 0.73,
            artifactSeverity: 0.31,
          },
        },
        {
          candidateId: 'job_8f2c',
          input: {
            technicalQuality: 0.81,
            promptStyleAdherence: 0.76,
            continuityMatch: 0.72,
            motionStability: 0.63,
            operatorConfidence: 0.69,
            artifactSeverity: 0.34,
          },
        },
        {
          candidateId: 'job_8eaa',
          input: {
            technicalQuality: 0.74,
            promptStyleAdherence: 0.71,
            continuityMatch: 0.66,
            motionStability: 0.58,
            operatorConfidence: 0.62,
            artifactSeverity: 0.43,
          },
        },
      ],
    },
    {
      shotId: 'shot_012_006',
      sceneId: 'scene_012',
      lineageRootJobId: 'job_root_012_006',
      expectedBestKnownCandidateId: 'job_9b11',
      candidates: [
        {
          candidateId: 'job_9b11',
          input: {
            technicalQuality: 0.88,
            promptStyleAdherence: 0.81,
            continuityMatch: 0.77,
            motionStability: 0.71,
            operatorConfidence: 0.75,
            artifactSeverity: 0.27,
          },
        },
        {
          candidateId: 'job_9b10',
          input: {
            technicalQuality: 0.84,
            promptStyleAdherence: 0.79,
            continuityMatch: 0.75,
            motionStability: 0.68,
            operatorConfidence: 0.72,
            artifactSeverity: 0.33,
          },
        },
      ],
    },
    {
      shotId: 'shot_021_002',
      sceneId: 'scene_021',
      lineageRootJobId: 'job_root_021_002',
      expectedBestKnownCandidateId: 'job_tie_a',
      candidates: [
        {
          candidateId: 'job_tie_a',
          input: {
            technicalQuality: 0.8,
            promptStyleAdherence: 0.8,
            continuityMatch: 0.8,
            motionStability: 0.8,
            operatorConfidence: 0.8,
            artifactSeverity: 0.2,
          },
        },
        {
          candidateId: 'job_tie_b',
          input: {
            technicalQuality: 0.8,
            promptStyleAdherence: 0.8,
            continuityMatch: 0.8,
            motionStability: 0.8,
            operatorConfidence: 0.8,
            artifactSeverity: 0.2,
          },
        },
      ],
    },
  ],
};
