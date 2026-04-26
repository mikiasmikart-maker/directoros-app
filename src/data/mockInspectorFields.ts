import type { InspectorField } from '../models/directoros';

export const baseInspectorFields: InspectorField[] = [
  { key: 'emotionalTone', label: 'Emotional Tone', type: 'textarea', placeholder: 'Describe the feeling this shot should leave behind', helperText: 'Sets the emotional read the shot should carry on screen.', group: 'style' },
  { key: 'lens', label: 'Lens Language', type: 'select', options: ['24mm', '35mm', '50mm', '85mm'], helperText: 'Choose the framing character that best fits the moment.', group: 'camera' },
  { key: 'duration', label: 'Shot Duration', type: 'number', min: 1, max: 30, step: 1, placeholder: 'Seconds', helperText: 'Define how long this beat should hold before the cut.', group: 'shot' },
  { key: 'movement', label: 'Camera Movement', type: 'select', options: ['locked', 'push-in', 'pull-back', 'pan', 'tilt', 'orbit', 'handheld'], helperText: 'Direct the dominant movement language for this shot.', group: 'motion' },
  { key: 'stabilization', label: 'Motion Stability Assist', type: 'toggle', helperText: 'Use stabilization guidance when the move should feel controlled.', group: 'motion' },
];


