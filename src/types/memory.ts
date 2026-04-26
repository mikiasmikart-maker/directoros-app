export type PrimitiveValue = string | number | boolean;

export type MemoryCategory = 'character' | 'product' | 'environment' | 'lighting' | 'camera';

export type MemorySourceType =
  | 'story-bible'
  | 'brand-guide'
  | 'location-scout'
  | 'cinema-reference'
  | 'director-note';

export interface CharacterMemoryParameters {
  archetype: string;
  wardrobe: string;
  emotionalTone: string;
  movementStyle: string;
}

export interface ProductMemoryParameters {
  productName: string;
  material: string;
  finish: string;
  heroFeature: string;
}

export interface EnvironmentMemoryParameters {
  location: string;
  timeOfDay: string;
  weather: string;
  atmosphere: string;
}

export interface LightingMemoryParameters {
  setup: string;
  keyLight: string;
  contrast: string;
  palette: string;
}

export interface CameraMemoryParameters {
  lens: string;
  framing: string;
  movement: string;
  shutterStyle: string;
}

export interface MemoryParametersByCategory {
  character: CharacterMemoryParameters;
  product: ProductMemoryParameters;
  environment: EnvironmentMemoryParameters;
  lighting: LightingMemoryParameters;
  camera: CameraMemoryParameters;
}

export type MemoryProfile<C extends MemoryCategory = MemoryCategory> = {
  id: string;
  name: string;
  category: C;
  summary: string;
  tags?: string[];
  sourceType: MemorySourceType;
  parameters: MemoryParametersByCategory[C];
};

export type SceneMemoryBindings = Partial<Record<MemoryCategory, string>>;

export interface SceneLocalOverrides {
  summary?: string;
  parameters?: Record<string, PrimitiveValue>;
}
