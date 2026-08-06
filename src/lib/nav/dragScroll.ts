import type { Attachment } from 'svelte/attachments';

const DRAG_THRESHOLD_PX = 5;

/**
 * Pointer drag-to-scroll for mouse/pen. Touch keeps native pan via CSS touch-action.
 * Suppresses link clicks after a drag so sliding the bar does not navigate.
 */
export const dragScroll: Attachment<HTMLElement> = (node) => {
  let pointerId: number | null = null;
  let startX = 0;
  let startScrollLeft = 0;
  let dragged = false;

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    pointerId = event.pointerId;
    startX = event.clientX;
    startScrollLeft = node.scrollLeft;
    dragged = false;
    node.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    const deltaX = event.clientX - startX;
    if (Math.abs(deltaX) > DRAG_THRESHOLD_PX) dragged = true;
    node.scrollLeft = startScrollLeft - deltaX;
  };

  const endPointer = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    if (node.hasPointerCapture(event.pointerId)) {
      node.releasePointerCapture(event.pointerId);
    }
  };

  const onClickCapture = (event: MouseEvent) => {
    if (!dragged) return;
    event.preventDefault();
    event.stopPropagation();
    dragged = false;
  };

  node.addEventListener('pointerdown', onPointerDown);
  node.addEventListener('pointermove', onPointerMove);
  node.addEventListener('pointerup', endPointer);
  node.addEventListener('pointercancel', endPointer);
  node.addEventListener('click', onClickCapture, true);

  return () => {
    node.removeEventListener('pointerdown', onPointerDown);
    node.removeEventListener('pointermove', onPointerMove);
    node.removeEventListener('pointerup', endPointer);
    node.removeEventListener('pointercancel', endPointer);
    node.removeEventListener('click', onClickCapture, true);
  };
};
