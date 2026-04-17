import { useEffect } from 'react';

export function useResizable(
  resizerRef: React.RefObject<HTMLElement | null>,
  onResize: (e: MouseEvent) => void,
  direction: 'row' | 'col' = 'row'
) {
  useEffect(() => {
    const up = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    const handleMove = (e: MouseEvent) => onResize(e);
    const down = () => {
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', up);
      document.body.style.cursor = direction === 'row' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
    };
    resizerRef.current?.addEventListener('mousedown', down);
    return () => { resizerRef.current?.removeEventListener('mousedown', down); };
  }, [onResize, direction]);
}
