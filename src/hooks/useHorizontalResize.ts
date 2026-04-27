import { useCallback, useRef } from 'react';

export function useHorizontalResize(
  currentWidth: number,
  setWidth: (nextWidth: number) => void,
): React.RefCallback<HTMLDivElement> {
  const widthRef = useRef(currentWidth);
  widthRef.current = currentWidth;
  const setWidthRef = useRef(setWidth);
  setWidthRef.current = setWidth;
  const prevElRef = useRef<HTMLElement | null>(null);
  const downHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);

  return useCallback((node: HTMLDivElement | null) => {
    if (prevElRef.current && downHandlerRef.current) {
      prevElRef.current.removeEventListener('mousedown', downHandlerRef.current);
      prevElRef.current = null;
      downHandlerRef.current = null;
    }

    if (!node) return;

    const handleDown = (e: MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = widthRef.current;

      const handleMove = (e: MouseEvent) => {
        setWidthRef.current(startWidth + (e.clientX - startX));
      };

      const handleUp = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

    downHandlerRef.current = handleDown;
    prevElRef.current = node;
    node.addEventListener('mousedown', handleDown);
  }, []);
}
