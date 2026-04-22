import { useRef, useEffect } from 'react';

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return `${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)}`;
}

const GAP = 18;
const BASE_R = 1;
const MAX_R = 8;
const BASE_RADIUS = 240;
const WOBBLE = 50;

export default function DotGrid({ className, color = '#4f8cff' }: { className?: string; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const raf = useRef(0);
  const startTime = useRef(performance.now());
  const colorRef = useRef(color);
  colorRef.current = color;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const blobRadius = (angle: number, T: number) => {
      return BASE_RADIUS
        + WOBBLE * 0.25 * Math.sin(angle * 2 + T * 0.7)
        + WOBBLE * 0.20 * Math.cos(angle * 3 - T * 1.1)
        + WOBBLE * 0.15 * Math.sin(angle * 5 + T * 0.9)
        + WOBBLE * 0.12 * Math.cos(angle * 7 - T * 1.3)
        + WOBBLE * 0.10 * Math.sin(angle * 11 + T * 0.5)
        + WOBBLE * 0.08 * Math.cos(angle * 13 - T * 1.7)
        + WOBBLE * 0.05 * Math.sin(angle * 17 + T * 2.1)
        + WOBBLE * 0.05 * Math.cos(angle * 19 - T * 0.8);
    };

    const draw = () => {
      const T = (performance.now() - startTime.current) / 1000;
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      ctx.clearRect(0, 0, w, h);

      const mx = mouse.current.x;
      const my = mouse.current.y;

      const startX = (w % GAP) / 2;
      const startY = (h % GAP) / 2;

      for (let x = startX; x < w; x += GAP) {
        for (let y = startY; y < h; y += GAP) {
          const dx = x - mx;
          const dy = y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);

          const maxR = blobRadius(angle, T);

          let t = 0;
          if (dist < maxR) {
            t = 1 - dist / maxR;
          }

          const r = BASE_R + (MAX_R - BASE_R) * t * t;
          const alpha = 0.18 + 0.72 * t * t;

          const c = colorRef.current;
          const rgb = hexToRgb(c);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb},${alpha})`;
          ctx.fill();

          if (t > 0.3) {
            ctx.beginPath();
            ctx.arc(x, y, r + 4 * t, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgb},${0.12 * t})`;
            ctx.fill();
          }
        }
      }

      raf.current = requestAnimationFrame(draw);
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current.x = e.clientX - rect.left;
      mouse.current.y = e.clientY - rect.top;
    };

    const onLeave = () => {
      mouse.current.x = -9999;
      mouse.current.y = -9999;
    };

    resize();
    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(raf.current);
      ro.disconnect();
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
        zIndex: 0,
      }}
    />
  );
}
