import type { MemoryProfile } from '../types/memory';

export const memoryProfiles: MemoryProfile[] = [
  {
    id: 'mem-char-ethiopian-protagonist',
    name: 'Ethiopian Urban Protagonist',
    category: 'character',
    summary: 'Grounded lead with calm confidence and subtle expressive reactions.',
    tags: ['hero', 'urban', 'authentic'],
    sourceType: 'story-bible',
    parameters: {
      archetype: 'resilient observer',
      wardrobe: 'earth-tone layered streetwear',
      emotionalTone: 'hopeful focus',
      movementStyle: 'measured natural walk',
    },
  },
  {
    id: 'mem-product-coffee-pack',
    name: 'Specialty Coffee Hero Product',
    category: 'product',
    summary: 'Hero product profile for artisan Ethiopian coffee branding shots.',
    tags: ['coffee', 'packaging'],
    sourceType: 'brand-guide',
    parameters: {
      productName: 'single-origin coffee pack',
      material: 'matte kraft pouch',
      finish: 'foil-stamped gold details',
      heroFeature: 'origin seal and typography',
    },
  },
  {
    id: 'mem-env-addis-morning',
    name: 'Addis Early Morning District',
    category: 'environment',
    summary: 'Soft urban dawn atmosphere with active street life.',
    tags: ['addis', 'dawn', 'city'],
    sourceType: 'location-scout',
    parameters: {
      location: 'addis ababa inner streets',
      timeOfDay: 'golden dawn',
      weather: 'light haze',
      atmosphere: 'calm build-up before rush',
    },
  },
  {
    id: 'mem-light-soft-contrast',
    name: 'Soft Contrast Cinematic Lighting',
    category: 'lighting',
    summary: 'Directional warm key with controlled shadow falloff.',
    tags: ['cinematic', 'warm'],
    sourceType: 'cinema-reference',
    parameters: {
      setup: 'single key with passive fill',
      keyLight: '45-degree warm key',
      contrast: 'medium-soft',
      palette: 'amber highlights / teal shadows',
    },
  },
  {
    id: 'mem-cam-dolly-language',
    name: 'DirectorOS Dolly Language',
    category: 'camera',
    summary: 'Steady cinematic camera language prioritizing confident push-ins.',
    tags: ['dolly', 'cinematic'],
    sourceType: 'director-note',
    parameters: {
      lens: '35mm',
      framing: 'medium-wide to medium',
      movement: 'slow dolly-in',
      shutterStyle: 'natural motion blur 180deg',
    },
  },
];

export const memoryProfilesById = Object.fromEntries(memoryProfiles.map((profile) => [profile.id, profile]));
