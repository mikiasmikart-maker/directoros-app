import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';

import {
  OVERLAY_MOTION,
  OVERLAY_STACK,
  captureFocusRestore,
  registerOverlay,
  shouldDismissOnOutsidePress,
  type OverlayLayer,
  type OverlayMotionPrimitive,
} from './overlaySystem';

interface OverlaySurfaceProps {
  id: string;
  layer: OverlayLayer;
  open: boolean;
  motion?: OverlayMotionPrimitive;
  dismissOnEscape?: boolean;
  dismissOnOutsidePress?: boolean;
  onDismiss?: () => void;
  children: ReactNode;
}

const getMotionStyle = (motion: OverlayMotionPrimitive, reducedMotion: boolean): CSSProperties => {
  if (reducedMotion) {
    return {
      opacity: 1,
      transform: 'none',
      transition: 'none',
    };
  }

  if (motion === 'fade') {
    return {
      opacity: 1,
      transform: 'none',
      transition: `opacity ${OVERLAY_MOTION.durationMs.standard}ms ${OVERLAY_MOTION.easing.standard}`,
    };
  }

  if (motion === 'slide') {
    return {
      opacity: 1,
      transform: 'translateY(0)',
      transition: `opacity ${OVERLAY_MOTION.durationMs.panel}ms ${OVERLAY_MOTION.easing.standard}, transform ${OVERLAY_MOTION.durationMs.panel}ms ${OVERLAY_MOTION.easing.standard}`,
    };
  }

  return {
    opacity: 1,
    transform: 'translateY(0)',
    transition: `opacity ${OVERLAY_MOTION.durationMs.standard}ms ${OVERLAY_MOTION.easing.standard}, transform ${OVERLAY_MOTION.durationMs.standard}ms ${OVERLAY_MOTION.easing.standard}`,
  };
};

export const OverlaySurface = ({
  id,
  layer,
  open,
  motion = 'fade-up',
  dismissOnEscape = true,
  dismissOnOutsidePress = true,
  onDismiss,
  children,
}: OverlaySurfaceProps) => {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const focusRestoreRef = useRef(captureFocusRestore());
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  useEffect(() => {
    if (!open) return;
    focusRestoreRef.current = captureFocusRestore();
    return registerOverlay({
      id,
      layer,
      dismissOnEscape,
      dismissOnOutsidePress,
      onDismiss,
    });
  }, [dismissOnEscape, dismissOnOutsidePress, id, layer, onDismiss, open]);

  useEffect(() => {
    if (open) return;
    focusRestoreRef.current.restore();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!shouldDismissOnOutsidePress(id)) return;
      const target = event.target as Node | null;
      if (target && surfaceRef.current?.contains(target)) return;
      onDismiss?.();
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [id, onDismiss, open]);

  if (!open) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: OVERLAY_STACK[layer] }}
      aria-hidden={false}
    >
      {layer === 'commandPanel' && (
        <div className="absolute inset-0 bg-[rgb(8,12,20)]/80 backdrop-blur-[2px]" />
      )}
      <div
        ref={surfaceRef}
        className="pointer-events-auto h-full"
        style={getMotionStyle(motion, reducedMotion)}
      >
        {children}
      </div>
    </div>
  );
};
