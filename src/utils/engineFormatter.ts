import type { EngineTarget } from '../models/directoros';
import type { EnginePayloadBranch, EngineRouteState } from '../types/engine';

interface EngineFormatInput {
  basePrompt: string;
  emphasis?: string;
  motionBehavior?: string;
  routeStrategy?: string;
}

interface EngineFormatOutput {
  promptPrefix: string;
  promptSuffix: string;
  hints: string[];
}

export const formatForEngine = (target: EngineTarget, input: EngineFormatInput): EngineFormatOutput => {
  const effectiveTarget = target === 'auto' ? 'flux' : target;

  switch (effectiveTarget) {
    case 'flux':
      return {
        promptPrefix: 'high-fidelity cinematic still-motion synthesis',
        promptSuffix: [input.emphasis ? `emphasis: ${input.emphasis}` : null, input.motionBehavior].filter(Boolean).join(' | '),
        hints: ['prioritize texture quality', 'strong photographic language', 'balanced color contrast'],
      };
    case 'veo':
      return {
        promptPrefix: 'temporal continuity-first cinematic video direction',
        promptSuffix: [input.emphasis ? `scene intensity: ${input.emphasis}` : null, input.motionBehavior ? `movement: ${input.motionBehavior}` : null]
          .filter(Boolean)
          .join(' | '),
        hints: ['prioritize motion continuity', 'clear action sequencing', 'shot transition awareness'],
      };
    case 'runway':
      return {
        promptPrefix: 'stylized motion-commercial framing',
        promptSuffix: [input.emphasis ? `energy: ${input.emphasis}` : null, input.motionBehavior ? `camera behavior: ${input.motionBehavior}` : null]
          .filter(Boolean)
          .join(' | '),
        hints: ['prioritize visual punch', 'ad-grade composition', 'movement with clear focal subject'],
      };
    case 'comfyui':
      return {
        promptPrefix: 'node-graph workflow driven cinematic synthesis',
        promptSuffix: [input.emphasis ? `weight: ${input.emphasis}` : null, input.motionBehavior ? `motion node: ${input.motionBehavior}` : null]
          .filter(Boolean)
          .join(' | '),
        hints: ['prioritize controllable node workflow', 'emit image sequence metadata', 'preserve prompt token ordering'],
      };
    default:
      return {
        promptPrefix: input.basePrompt,
        promptSuffix: '',
        hints: ['auto routed to default cinematic strategy'],
      };
  }
};

export const buildRouteBranches = (
  route: EngineRouteState,
  basePrompt: string,
  parameters: Record<string, unknown>
): EnginePayloadBranch[] => {
  return route.activeTargets.map((engine) => {
    const format = formatForEngine(engine, { basePrompt, routeStrategy: route.strategy });
    return {
      engine,
      strategy: route.strategy,
      payloadSummary: `${engine.toUpperCase()} branch (${route.strategy.replaceAll('_', ' ')})`,
      promptVariant: [format.promptPrefix, basePrompt, format.promptSuffix].filter(Boolean).join(' | '),
      parameterKeys: Object.keys(parameters),
    };
  });
};
