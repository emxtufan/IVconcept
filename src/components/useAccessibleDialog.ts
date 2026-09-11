import { useLayoutEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], audio[controls], [tabindex]:not([tabindex="-1"])';
const dialogStack: symbol[] = [];
const isolatedElements = new Map<HTMLElement, { count: number; inert: boolean; ariaHidden: string | null }>();
let originalBodyOverflow = '';
let originalDocumentOverflow = '';

function isolate(element: HTMLElement) {
  const saved = isolatedElements.get(element);
  if (saved) {
    saved.count += 1;
  } else {
    isolatedElements.set(element, { count: 1, inert: element.inert, ariaHidden: element.getAttribute('aria-hidden') });
    element.inert = true;
    element.setAttribute('aria-hidden', 'true');
  }
}

function release(element: HTMLElement) {
  const saved = isolatedElements.get(element);
  if (!saved || --saved.count > 0) return;
  element.inert = saved.inert;
  if (saved.ariaHidden === null) element.removeAttribute('aria-hidden');
  else element.setAttribute('aria-hidden', saved.ariaHidden);
  isolatedElements.delete(element);
}

/** Shared focus, keyboard, background isolation and scroll behavior for public dialogs. */
export function useAccessibleDialog<T extends HTMLElement = HTMLDivElement>(isOpen: boolean, onClose: () => void) {
  const dialogRef = useRef<T | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;

    const token = Symbol('dialog');
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const isTopDialog = () => dialogStack[dialogStack.length - 1] === token;
    if (dialogStack.length === 0) {
      originalBodyOverflow = document.body.style.overflow;
      originalDocumentOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
    dialogStack.push(token);
    dialog.inert = false;

    const focusableElements = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0 && !element.closest('[inert]'));
    const focusInside = () => {
      const target = dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]') ?? focusableElements()[0] ?? dialog;
      target.focus({ preventScroll: true });
    };

    // Focus first, before hiding the trigger's ancestor from assistive technology.
    focusInside();
    const background: HTMLElement[] = [];
    let branch: HTMLElement = dialog;
    while (branch.parentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling !== branch && sibling instanceof HTMLElement && !sibling.hasAttribute('data-dialog-backdrop') && !['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) {
          isolate(sibling);
          background.push(sibling);
        }
      }
      if (branch.parentElement === document.body) break;
      branch = branch.parentElement;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopDialog()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const elements = focusableElements();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus({ preventScroll: true });
        } else if (event.shiftKey && (document.activeElement === first || !elements.includes(document.activeElement as HTMLElement))) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        } else if (!event.shiftKey && (document.activeElement === last || !elements.includes(document.activeElement as HTMLElement))) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };
    const handleFocus = (event: FocusEvent) => {
      if (isTopDialog() && !dialog.contains(event.target as Node)) focusInside();
    };
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocus);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocus);
      const wasTop = isTopDialog();
      const index = dialogStack.indexOf(token);
      if (index >= 0) dialogStack.splice(index, 1);
      background.forEach(release);
      // AnimatePresence may keep the exiting element mounted for a short time.
      dialog.inert = true;
      if (dialogStack.length === 0) {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalDocumentOverflow;
      }
      if (wasTop && previousFocus?.isConnected && !previousFocus.closest('[inert]')) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  return dialogRef;
}
