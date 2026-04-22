import { useRef, useEffect, useState } from 'react';

export default function BlinkLogo({ className }: { className?: string }) {
  const cursorRef = useRef<SVGRectElement>(null);
  const textRef = useRef<SVGTextElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const text = textRef.current;
    const cursor = cursorRef.current;
    const svg = svgRef.current;
    if (!text || !cursor || !svg) return;

    const measure = () => {
      const bbox = text.getBBox();
      const pad = 14;
      const cursorX = bbox.x + bbox.width + 7;
      const totalW = cursorX + 4 + pad;
      cursor.setAttribute('x', String(cursorX));
      svg.setAttribute('viewBox', `0 0 ${totalW} 90`);
      setReady(true);
    };

    document.fonts.ready.then(() => requestAnimationFrame(measure));
  }, []);

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox="0 0 260 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity: ready ? 1 : 0, transition: 'opacity 0.15s' }}
    >
      <style>{`
        .blink-tw-text {
          font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, 'Liberation Mono', monospace;
          font-size: 52px;
          font-weight: 700;
          fill: #4f8cff;
          letter-spacing: -2px;
        }
        @keyframes blinkCursor { 0%,50%{opacity:1}51%,100%{opacity:0} }
      `}</style>
      <text ref={textRef} x="14" y="64" className="blink-tw-text">
        <tspan opacity="0">B<animate attributeName="opacity" values="0;1" dur="0.06s" begin="0.3s" fill="freeze" calcMode="discrete"/></tspan>
        <tspan opacity="0">l<animate attributeName="opacity" values="0;1" dur="0.06s" begin="0.42s" fill="freeze" calcMode="discrete"/></tspan>
        <tspan opacity="0">i<animate attributeName="opacity" values="0;1" dur="0.06s" begin="0.54s" fill="freeze" calcMode="discrete"/></tspan>
        <tspan opacity="0">n<animate attributeName="opacity" values="0;1" dur="0.06s" begin="0.66s" fill="freeze" calcMode="discrete"/></tspan>
        <tspan opacity="0">k<animate attributeName="opacity" values="0;1" dur="0.06s" begin="0.78s" fill="freeze" calcMode="discrete"/></tspan>
      </text>
      <rect ref={cursorRef} x="175" y="18" width="4" height="52" rx="2" fill="#4f8cff" opacity="0"
        style={{ animation: 'blinkCursor 1.1s step-end 0.85s infinite' }}
      >
        <animate attributeName="opacity" values="0;1" dur="0.05s" begin="0.85s" fill="freeze" calcMode="discrete"/>
      </rect>
    </svg>
  );
}
