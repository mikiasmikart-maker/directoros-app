import type { SceneNode } from '../models/directoros';
import type { DeliveryRegistryItem, SequenceReadiness } from '../review/types';

export interface DeliveryManifest {
  sequence: {
    id: string;
    name: string;
  };
  metadata: {
    generatedAt: number;
    sealedAt?: number;
    operator: string;
  };
  summary: {
    totalShots: number;
    finalizedShots: number;
  };
  shots: Array<{
    shotId: string;
    label: string;
    order: number;
    status: 'finalized' | 'missing';
    resolution?: {
      jobId: string;
      outputPath: string;
      engine: string;
      quality: string;
      finalizedAt: number;
      authority: string;
    };
  }>;
  outputs: Array<{
    id: string;
    shotId: string;
    path: string;
    specs: string;
    finalizedAt: number;
    authority: string;
  }>;
}

export const buildDeliveryManifest = (
  scene: SceneNode | undefined,
  seal: { sealedAt: number; sealedByLabel: string; sealedShotCount: number } | undefined,
  registryItems: DeliveryRegistryItem[],
  readiness: SequenceReadiness,
  shotQueue: Array<{ id: string; title: string; order: number }>
): DeliveryManifest | null => {
  if (!scene || !seal) return null;

  const registryMap = new Map(registryItems.map(item => [item.shotId, item]));

  const shots = shotQueue.map(shot => {
    const registryItem = registryMap.get(shot.id);
    const finalizedTime = registryItem ? new Date(registryItem.timestamp).getTime() : undefined;

    return {
      shotId: shot.id,
      label: shot.title,
      order: shot.order,
      status: (registryItem ? 'finalized' : 'missing') as 'finalized' | 'missing',
      resolution: registryItem ? {
        jobId: registryItem.id,
        outputPath: registryItem.path,
        engine: registryItem.specs.split(' • ')[1] || 'unknown',
        quality: registryItem.specs.split(' • ')[0] || 'standard',
        finalizedAt: isNaN(finalizedTime!) ? Date.now() : finalizedTime!,
        authority: registryItem.actor
      } : undefined
    };
  });

  const outputs = registryItems.map(item => {
    const finalizedTime = new Date(item.timestamp).getTime();
    return {
      id: item.id,
      shotId: item.shotId,
      path: item.path,
      specs: item.specs,
      finalizedAt: isNaN(finalizedTime) ? Date.now() : finalizedTime,
      authority: item.actor
    };
  });

  return {
    sequence: {
      id: scene.id,
      name: scene.name
    },
    metadata: {
      generatedAt: Date.now(),
      sealedAt: seal.sealedAt,
      operator: seal.sealedByLabel
    },
    summary: {
      totalShots: readiness.totalCount,
      finalizedShots: readiness.finalizedCount
    },
    shots,
    outputs
  };
};
