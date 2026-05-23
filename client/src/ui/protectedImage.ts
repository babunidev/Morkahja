import { useEffect } from 'react';
import type { CSSProperties, ImgHTMLAttributes, MouseEvent } from 'react';

export const PROTECTED_BACKGROUND_ATTR = 'data-morkahja-protected-background';
export const PROTECTED_SURFACE_ATTR = 'data-morkahja-protected-surface';

const TEXT_INPUT_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

export function preventImageContextMenu(event: MouseEvent<HTMLElement>): void {
  event.preventDefault();
}

/** Disables drag and the browser image context menu (e.g. “Open image in new tab”). */
export const protectedImageProps = {
  draggable: false,
  onContextMenu: preventImageContextMenu,
} satisfies Pick<ImgHTMLAttributes<HTMLImageElement>, 'draggable' | 'onContextMenu'>;

/** Dashboard / settings overlays: block browser menu on backdrop and panel chrome. */
export const protectedOverlaySurfaceProps = {
  [PROTECTED_SURFACE_ATTR]: '',
  onContextMenu: preventImageContextMenu,
};

export const protectedOverlayTextStyle: CSSProperties = {
  userSelect: 'none',
};

function hasProtectedBackgroundImage(element: HTMLElement): boolean {
  if (element.hasAttribute(PROTECTED_BACKGROUND_ATTR)) {
    return true;
  }

  const { backgroundImage } = window.getComputedStyle(element);
  return backgroundImage !== 'none' && backgroundImage.includes('url(');
}

function isProtectedSurface(element: HTMLElement): boolean {
  return element.hasAttribute(PROTECTED_SURFACE_ATTR)
    || element.hasAttribute(PROTECTED_BACKGROUND_ATTR)
    || hasProtectedBackgroundImage(element);
}

function findProtectedMediaTarget(target: EventTarget | null): HTMLElement | null {
  let node = target instanceof HTMLElement ? target : null;

  while (node) {
    if (node instanceof HTMLImageElement) {
      return node;
    }

    if (isProtectedSurface(node)) {
      return node;
    }

    node = node.parentElement;
  }

  return null;
}

function isTextInputTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(TEXT_INPUT_SELECTOR));
}

/** Blocks image/background context menus, drag, and incidental text selection. */
export function useProtectedImages(): void {
  useEffect(() => {
    function onContextMenu(event: Event): void {
      if (findProtectedMediaTarget(event.target)) {
        event.preventDefault();
      }
    }

    function onDragStart(event: DragEvent): void {
      if (findProtectedMediaTarget(event.target)) {
        event.preventDefault();
      }
    }

    function onSelectStart(event: Event): void {
      if (!isTextInputTarget(event.target)) {
        event.preventDefault();
      }
    }

    document.addEventListener('contextmenu', onContextMenu, { capture: true });
    document.addEventListener('dragstart', onDragStart, { capture: true });
    document.addEventListener('selectstart', onSelectStart, { capture: true });

    return () => {
      document.removeEventListener('contextmenu', onContextMenu, { capture: true });
      document.removeEventListener('dragstart', onDragStart, { capture: true });
      document.removeEventListener('selectstart', onSelectStart, { capture: true });
    };
  }, []);
}
