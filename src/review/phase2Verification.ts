import { goldenReplayPackV001 } from './goldenReplayPack';
import {
  computeCompositeScoreV2,
  defaultWeightPolicyV2,
  rankCandidatesDeterministically,
  selectBestKnownDeterministically,
} from './scorer';

export interface Phase2VerificationReport {
  packId: string;
  policyId: string;
  reproducibilityPass: boolean;
  deterministicSelectionPass: boolean;
  shotsChecked: number;
  scoreMismatches: number;
  bestKnownMismatches: number;
  runA: Array<{ shotId: string; ranked: Array<{ candidateId: string; score: number }>; bestKnown: string }>;
  runB: Array<{ shotId: string; ranked: Array<{ candidateId: string; score: number }>; bestKnown: string }>;
}

const runOnce = () =>
  goldenReplayPackV001.shots.map((shot) => {
    const ranked = rankCandidatesDeterministically(shot.candidates, defaultWeightPolicyV2).map((item) => ({
      candidateId: item.candidateId,
      score: item.snapshot.compositeScore,
    }));

    const bestKnown = selectBestKnownDeterministically(shot.candidates, defaultWeightPolicyV2)?.candidateId;

    return {
      shotId: shot.shotId,
      ranked,
      bestKnown: bestKnown ?? '',
    };
  });

export const runPhase2Verification = (): Phase2VerificationReport => {
  const runA = runOnce();
  const runB = runOnce();

  let scoreMismatches = 0;
  let bestKnownMismatches = 0;

  runA.forEach((shotA, index) => {
    const shotB = runB[index];
    shotA.ranked.forEach((candidate, candidateIndex) => {
      const compare = shotB.ranked[candidateIndex];
      if (!compare || compare.candidateId !== candidate.candidateId || compare.score !== candidate.score) {
        scoreMismatches += 1;
      }
    });

    const expected = goldenReplayPackV001.shots[index]?.expectedBestKnownCandidateId;
    if (shotA.bestKnown !== shotB.bestKnown || shotA.bestKnown !== expected) {
      bestKnownMismatches += 1;
    }
  });

  return {
    packId: goldenReplayPackV001.packId,
    policyId: defaultWeightPolicyV2.policyId,
    reproducibilityPass: scoreMismatches === 0,
    deterministicSelectionPass: bestKnownMismatches === 0,
    shotsChecked: goldenReplayPackV001.shots.length,
    scoreMismatches,
    bestKnownMismatches,
    runA,
    runB,
  };
};

export const sampleScoreBreakdownSnapshot = () => {
  const shot = goldenReplayPackV001.shots[0];
  const candidate = shot.candidates[0];
  return {
    shotId: shot.shotId,
    candidateId: candidate.candidateId,
    snapshot: computeCompositeScoreV2(candidate.input, defaultWeightPolicyV2),
  };
};
