import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Widths. Detail views and forms with tables or two-column grids need `lg` or
 * wider — squeezed into a narrow column they grow tall and start to scroll.
 */
const SIZE_CLASSES: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-7xl'
};

/** How many modals are open, so the page only unlocks when the last one closes. */
let openModals = 0;

/**
 * Lock the page behind an open modal and close it on Escape. Only the top-most
 * modal answers Escape, so a confirm opened over a form closes on its own.
 * Shared with Drawer, so the two stack correctly over each other.
 */
export function useModalBehaviour(isOpen: boolean, onClose?: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    openModals += 1;
    const depth = openModals;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && depth === openModals) onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      openModals -= 1;
      if (openModals === 0) document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);
}

/**
 * The frame every modal shares: rendered into <body> so no page container,
 * sidebar or sticky header can sit on top of it or clip it, with a dimmed
 * backdrop and the panel centred within the viewport.
 */
function ModalShell({ onClose, panelClassName, children, labelledBy }: {
  onClose?: () => void;
  panelClassName: string;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`relative w-full bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 animate-modal-in ${panelClassName}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

let titleIds = 0;

export function Modal({ isOpen, onClose, title, subtitle, children, size = 'md', footer }: any) {
  useModalBehaviour(isOpen, onClose);
  const titleId = useRef(`modal-title-${++titleIds}`).current;

  if (!isOpen) return null;

  return (
    <ModalShell
      onClose={onClose}
      labelledBy={titleId}
      panelClassName={`${SIZE_CLASSES[size] || SIZE_CLASSES.md} flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)]`}
    >
      {/* Header — stays put while the body scrolls */}
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
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

      {/* Body — only this part scrolls, and without a visible bar */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-none px-6 py-5">
        {children}
      </div>

      {footer && (
        <div className="flex flex-wrap justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl shrink-0">
          {footer}
        </div>
      )}
    </ModalShell>
  );
}

// Default export for backward compatibility
export default Modal;

/**
 * Action buttons at the bottom of a modal. Pinned to the bottom of the
 * scrolling body, so Save/Cancel stay in reach however long the form is.
 */
export function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky -bottom-5 -mx-6 -mb-5 mt-5 flex flex-wrap justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-white">
      {children}
    </div>
  );
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', confirmStyle = 'danger', loading = false }: any) {
  useModalBehaviour(isOpen, loading ? undefined : onClose);

  if (!isOpen) return null;

  const buttonStyles: any = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    primary: 'bg-primary hover:bg-primary-dark text-white',
    success: 'bg-primary hover:bg-primary-dark text-white'
  };

  return (
    <ModalShell onClose={loading ? undefined : onClose} panelClassName="max-w-sm">
      <div className="p-6 text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${buttonStyles[confirmStyle]}`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
