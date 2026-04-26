import type { RenderBridgeJob } from '../bridge/renderBridge';

export interface PromptHistoryEntry {
  id: string;
  sceneId: string;
  engine: RenderBridgeJob['engine'];
  compiledPrompt: string;
  payload: RenderBridgeJob['payload'];
  seed: number;
  timestamp: number;
  status: 'queued' | 'rendering' | 'completed' | 'failed';
  result?: string[];
  error?: string;
}

const history: PromptHistoryEntry[] = [];

export const appendPromptHistory = (entry: PromptHistoryEntry): PromptHistoryEntry => {
  history.unshift(entry);
  return entry;
};

export const updatePromptHistory = (
  id: string,
  patch: Partial<Pick<PromptHistoryEntry, 'status' | 'result' | 'error'>>
): PromptHistoryEntry | undefined => {
  const index = history.findIndex((item) => item.id === id);
  if (index < 0) return undefined;

  const next = { ...history[index], ...patch };
  history[index] = next;
  return next;
};

export const listPromptHistory = (): PromptHistoryEntry[] => [...history];
