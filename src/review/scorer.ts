export interface CompositeScoreInput {
  technicalQuality: number;
  promptStyleAdherence: number;
  continuityMatch: number;
  motionStability: number;
  operatorConfidence: number;
  artifactSeverity: number;
}

export interface CompositeScoreWeights {
  technicalQuality: number;
  promptStyleAdherence: number;
  continuityMatch: number;
  motionStability: number;
  operatorConfidence: number;
  artifactSeverityPenalty: number;
}

export interface ScoreBreakdownSnapshot {
  scorerVersion: 'composite_score_v2';
  policyId: string;
  policyHash: string;
  normalized: CompositeScoreInput;
  weighted: {
    technicalQuality: number;
    promptStyleAdherence: number;
    continuityMatch: number;
    motionStability: number;
    operatorConfidence: number;
    artifactPenalty: number;
  };
  compositeScore: number;
}

export interface ScoredCandidate {
  candidateId: string;
  input: CompositeScoreInput;
  snapshot: ScoreBreakdownSnapshot;
}

export interface WeightPolicy {
  policyId: string;
  policyHash: string;
  weights: CompositeScoreWeights;
}

export const defaultWeightPolicyV2: WeightPolicy = {
  policyId: 'm4_weight_policy_v2_0',
  policyHash: 'sha256:m4_weight_policy_v2_0_static_hash',
  weights: {
    technicalQuality: 0.24,
    promptStyleAdherence: 0.22,
    continuityMatch: 0.2,
    motionStability: 0.16,
    operatorConfidence: 0.3,
    artifactSeverityPenalty: 0.12,
  },
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const normalize4 = (value: number) => Number(clamp01(value).toFixed(4));

export const computeCompositeScoreV2 = (
  input: CompositeScoreInput,
  policy: WeightPolicy = defaultWeightPolicyV2
): ScoreBreakdownSnapshot => {
  const normalized: CompositeScoreInput = {
    technicalQuality: normalize4(input.technicalQuality),
    promptStyleAdherence: normalize4(input.promptStyleAdherence),
    continuityMatch: normalize4(input.continuityMatch),
    motionStability: normalize4(input.motionStability),
    operatorConfidence: normalize4(input.operatorConfidence),
    artifactSeverity: normalize4(input.artifactSeverity),
  };

  const weighted = {
    technicalQuality: Number((policy.weights.technicalQuality * normalized.technicalQuality).toFixed(6)),
    promptStyleAdherence: Number((policy.weights.promptStyleAdherence * normalized.promptStyleAdherence).toFixed(6)),
    continuityMatch: Number((policy.weights.continuityMatch * normalized.continuityMatch).toFixed(6)),
    motionStability: Number((policy.weights.motionStability * normalized.motionStability).toFixed(6)),
    operatorConfidence: Number((policy.weights.operatorConfidence * normalized.operatorConfidence).toFixed(6)),
    artifactPenalty: Number((policy.weights.artifactSeverityPenalty * normalized.artifactSeverity).toFixed(6)),
  };

  const raw =
    weighted.technicalQuality +
    weighted.promptStyleAdherence +
    weighted.continuityMatch +
    weighted.motionStability +
    weighted.operatorConfidence -
    weighted.artifactPenalty;

  return {
    scorerVersion: 'composite_score_v2',
    policyId: policy.policyId,
    policyHash: policy.policyHash,
    normalized,
    weighted,
    compositeScore: Number(clamp01(raw).toFixed(4)),
  };
};

export const rankCandidatesDeterministically = (
  candidates: Array<{ candidateId: string; input: CompositeScoreInput }>,
  policy: WeightPolicy = defaultWeightPolicyV2
): ScoredCandidate[] => {
  const scored = candidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    input: candidate.input,
    snapshot: computeCompositeScoreV2(candidate.input, policy),
  }));

  scored.sort((a, b) => {
    if (b.snapshot.compositeScore !== a.snapshot.compositeScore) {
      return b.snapshot.compositeScore - a.snapshot.compositeScore;
    }
    return a.candidateId.localeCompare(b.candidateId);
  });

  return scored;
};

export const selectBestKnownDeterministically = (
  candidates: Array<{ candidateId: string; input: CompositeScoreInput }>,
  policy: WeightPolicy = defaultWeightPolicyV2
) => rankCandidatesDeterministically(candidates, policy)[0];
