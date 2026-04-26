import type { SceneNode } from '../models/directoros';

export const mockScenes: SceneNode[] = [
  {
    id: 'scene-001',
    name: 'Opening - Addis Dawn',
    type: 'scene',
    prompt: 'Cinematic sunrise over Addis skyline, warm haze, slow dolly push.',
    params: { mood: 'hopeful', lens: '35mm', duration: 6 },
    memoryBindings: {
      character: 'mem-char-ethiopian-protagonist',
      environment: 'mem-env-addis-morning',
      lighting: 'mem-light-soft-contrast',
      camera: 'mem-cam-dolly-language',
    },
    localOverrides: {
      summary: 'Anchor the opening in pride, calm momentum, and authentic local detail.',
      parameters: {
        mood: 'uplifting',
      },
    },
    children: ['shot-001'],
  },
  {
    id: 'shot-001',
    name: 'Street Reveal',
    type: 'shot',
    parentId: 'scene-001',
    prompt: 'Reveal city life in soft morning light, people moving naturally.',
    params: { cameraMove: 'dolly-in', speed: 'slow', grain: 0.12 },
  },
  {
    id: 'scene-002',
    name: 'Market Energy',
    type: 'scene',
    prompt: 'Energetic marketplace, rich textiles, rhythmic motion, handheld realism.',
    params: { mood: 'vibrant', lens: '24mm', duration: 8 },
    memoryBindings: {
      character: 'mem-char-ethiopian-protagonist',
      product: 'mem-product-coffee-pack',
      lighting: 'mem-light-soft-contrast',
      camera: 'mem-cam-dolly-language',
    },
    localOverrides: {
      parameters: {
        cameraMove: 'handheld pulse',
      },
    },
    children: ['shot-002'],
  },
  {
    id: 'shot-002',
    name: 'Fabric Motion Closeup',
    type: 'shot',
    parentId: 'scene-002',
    prompt: 'Close-up fabric flowing, macro detail, sunlight highlights.',
    params: { cameraMove: 'handheld', detail: 'high', stabilization: true },
  },
];
