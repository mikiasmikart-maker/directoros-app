import type { SceneNode } from '../models/directoros';

export interface SelectionState {
  selectedScene?: SceneNode;
}

export const selectSceneById = (scenes: SceneNode[], id?: string): SelectionState => ({
  selectedScene: scenes.find((s) => s.id === id),
});


