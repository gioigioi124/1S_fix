import { useEffect } from 'react';

export interface HotkeyHandlers {
  onF2?: () => void;
  onF3?: () => void;
  onF4?: () => void;
  onF7?: () => void;
  onCtrlF7?: () => void;
  onF8?: () => void;
  onF9?: () => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onSpace?: () => void;
  onCtrlA?: () => void;
  onCtrlU?: () => void;
}

export function useHotkeys(handlers: HotkeyHandlers, isEnabled: boolean = true) {
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement;

      // Browser default intercepts
      if (['F3', 'F7', 'F8', 'F9'].includes(e.key)) {
        e.preventDefault();
      }

      // Check Ctrl+F
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        handlers.onF3?.();
        return;
      }

      // Ctrl + F7 (Alias Shift + F7)
      if ((e.ctrlKey || e.metaKey) && e.key === 'F7') {
        e.preventDefault();
        handlers.onCtrlF7?.();
        return;
      }

      // Ctrl + A (Select All)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !isInput) {
        e.preventDefault();
        handlers.onCtrlA?.();
        return;
      }

      // Ctrl + U (Deselect All)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        handlers.onCtrlU?.();
        return;
      }

      // F2
      if (e.key === 'F2') {
        e.preventDefault();
        handlers.onF2?.();
        return;
      }

      // F3
      if (e.key === 'F3') {
        e.preventDefault();
        handlers.onF3?.();
        return;
      }

      // F4
      if (e.key === 'F4') {
        e.preventDefault();
        handlers.onF4?.();
        return;
      }

      // F7
      if (e.key === 'F7') {
        e.preventDefault();
        handlers.onF7?.();
        return;
      }

      // F8
      if (e.key === 'F8') {
        e.preventDefault();
        handlers.onF8?.();
        return;
      }

      // F9
      if (e.key === 'F9') {
        e.preventDefault();
        handlers.onF9?.();
        return;
      }

      // Escape
      if (e.key === 'Escape') {
        handlers.onEscape?.();
        return;
      }

      // Enter
      if (e.key === 'Enter' && !isInput) {
        e.preventDefault();
        handlers.onEnter?.();
        return;
      }

      // Space
      if (e.key === ' ' && !isInput) {
        e.preventDefault();
        handlers.onSpace?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlers, isEnabled]);
}
