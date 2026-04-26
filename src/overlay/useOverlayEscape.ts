import { useEffect } from 'react';

import { dismissTopmostOverlay } from './overlaySystem';

export const useOverlayEscape = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (target?.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (event.key !== 'Escape') return;

      const dismissed = dismissTopmostOverlay();
      if (!dismissed) return;
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled]);
};
