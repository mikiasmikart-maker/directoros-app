import type { AppState } from '../models/directoros';

export const initialAppState: AppState = {
  activePanel: 'scene',
  selectedSceneId: 'scene-001',
  selectedClipId: 'clip-001',
  selectedGraphNodeId: undefined,
  engineTarget: 'auto',
  isDarkMode: true,
};


