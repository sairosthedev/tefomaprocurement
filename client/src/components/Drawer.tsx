import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalBehaviour } from './Modal';

/** Widths. Forms with two-column grids or item tables need `lg` or wider. */
const SIZE_CLASSES: Record<string, string> = {
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl'
};

let titleIds = 0;

/**
 * A panel that slides in from the right, for work that belongs to the page
 * underneath — creating a record without losing your place in the list. Shares
 * the modal's scroll lock and Escape handling, so a ConfirmModal opened over a
 * drawer closes on its own.
 */
export function Drawer({ isOpen, onClose, title, subtitle, children, size = 'lg', footer }: {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
  /** Action buttons pinned below the scrolling body. */
  footer?: React.ReactNode;
}) {
  useModalBehaviour(isOpen, onClose);
  const titleId = useRef(`drawer-title-${++titleIds}`).current;

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex h-full w-full ${SIZE_CLASSES[size] || SIZE_CLASSES.lg} flex-col bg-white shadow-2xl ring-1 ring-black/5 animate-slide-in`}
      >
        {/* Header — stays put while the body scrolls */}
        <div className="flex items-start justify-between gap-4 px-6 pt-4 pb-3 border-b border-gray-200 shrink-0">
          <div className="min-w-0">
            <h3 id={titleId} className="text-lg font-semibold text-gray-900 leading-snug">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pt-4 pb-5">
          {children}
        </div>

        {footer && (
          <div className="flex flex-wrap justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/60 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default Drawer;
