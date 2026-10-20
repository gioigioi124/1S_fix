import React from 'react';
import { VFP_HOTKEYS } from '../lib/hotkeys';

interface HotkeyBarProps {
  onAction?: (actionId: string) => void;
}

export const HotkeyBar: React.FC<HotkeyBarProps> = ({ onAction }) => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 h-8 bg-slate-800 text-slate-200 border-t border-slate-700 flex items-center px-4 text-xs select-none z-40 overflow-x-auto">
      <div className="flex items-center gap-4 text-[11px] whitespace-nowrap">
        <span className="font-semibold text-amber-400">Phím tắt 1S:</span>
        {VFP_HOTKEYS.map((hk) => (
          <button
            key={hk.key}
            type="button"
            onClick={() => onAction?.(hk.actionId)}
            className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
          >
            <kbd className="px-1.5 py-0.5 bg-slate-700 text-amber-300 rounded font-mono text-[10px] border border-slate-600">
              {hk.label}
            </kbd>
            <span className={hk.disabledInReadOnly ? 'text-slate-400 line-through' : 'text-slate-300'}>
              {hk.description}
            </span>
          </button>
        ))}
      </div>
    </footer>
  );
};
