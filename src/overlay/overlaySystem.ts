export const OVERLAY_STACK = {
  inlineReveal: 10,
  floatingStrip: 20,
  stickyShell: 40,
  backdrop: 60,
  surface: 70,
  commandPanel: 80,
  toast: 90,
} as const;

export type OverlayLayer = keyof typeof OVERLAY_STACK;

export const OVERLAY_MOTION = {
  durationMs: {
    fast: 160,
    standard: 180,
    panel: 200,
  },
  easing: {
    standard: 'cubic-bezier(0.22, 1, 0.36, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  distancePx: {
    fadeUp: 8,
    slide: 16,
  },
} as const;

export type OverlayMotionPrimitive = 'fade' | 'fade-up' | 'slide';

export interface OverlayRegistration {
  id: string;
  layer: OverlayLayer;
  dismissOnEscape?: boolean;
  dismissOnOutsidePress?: boolean;
  onDismiss?: () => void;
}

const overlayStack: OverlayRegistration[] = [];

export const registerOverlay = (registration: OverlayRegistration) => {
  const existingIndex = overlayStack.findIndex((entry) => entry.id === registration.id);
  if (existingIndex >= 0) {
    overlayStack[existingIndex] = registration;
  } else {
    overlayStack.push(registration);
  }

  overlayStack.sort((a, b) => OVERLAY_STACK[a.layer] - OVERLAY_STACK[b.layer]);

  return () => {
    const index = overlayStack.findIndex((entry) => entry.id === registration.id);
    if (index >= 0) overlayStack.splice(index, 1);
  };
};

export const dismissTopmostOverlay = () => {
  for (let index = overlayStack.length - 1; index >= 0; index -= 1) {
    const entry = overlayStack[index];
    if (!entry.dismissOnEscape || !entry.onDismiss) continue;
    entry.onDismiss();
    return true;
  }
  return false;
};

export const getTopmostOverlay = () => overlayStack.at(-1);

export interface FocusRestoreSnapshot {
  restore: () => void;
}

export const captureFocusRestore = (): FocusRestoreSnapshot => {
  const activeElement = typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null;
  return {
    restore: () => {
      activeElement?.focus?.();
    },
  };
};

export const shouldDismissOnOutsidePress = (layerId?: string) => {
  if (!layerId) return false;
  const entry = overlayStack.find((item) => item.id === layerId);
  return Boolean(entry?.dismissOnOutsidePress);
};
