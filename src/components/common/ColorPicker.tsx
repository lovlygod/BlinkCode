import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import './ColorPicker.css';

const PRESET_COLORS = [
  '#4f8cff', '#3b82f6', '#6366f1',
  '#8b5cf6', '#bd93f9', '#a855f7',
  '#ec4899', '#ff79c6', '#ff6b6b',
  '#ef4444', '#f97316', '#ffb86c',
  '#f1fa8c', '#eab308', '#22c55e',
  '#50fa7b', '#14b8a6', '#8be9fd',
  '#06b6d4', '#64748b', '#e5e7eb',
];

type Direction = 'up' | 'down';
type Rgb = { r: number; g: number; b: number };
type Hsv = { h: number; s: number; v: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map(ch => ch + ch).join('')
    : normalized.padEnd(6, '0').slice(0, 6);
  const value = parseInt(expanded, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHex({ r, g, b }: Rgb) {
  return `#${[r, g, b].map(part => clamp(Math.round(part), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rr) h = ((gg - bb) / delta) % 6;
    else if (max === gg) h = (bb - rr) / delta + 2;
    else h = (rr - gg) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h, s, v };
}

function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs((hh / 60) % 2 - 1));
  const m = v - c;

  let rr = 0;
  let gg = 0;
  let bb = 0;

  if (hh < 60) [rr, gg, bb] = [c, x, 0];
  else if (hh < 120) [rr, gg, bb] = [x, c, 0];
  else if (hh < 180) [rr, gg, bb] = [0, c, x];
  else if (hh < 240) [rr, gg, bb] = [0, x, c];
  else if (hh < 300) [rr, gg, bb] = [x, 0, c];
  else [rr, gg, bb] = [c, 0, x];

  return {
    r: Math.round((rr + m) * 255),
    g: Math.round((gg + m) * 255),
    b: Math.round((bb + m) * 255),
  };
}

export default function ColorPicker({
  value,
  onChange,
  direction = 'down',
}: {
  value: string;
  onChange: (c: string) => void;
  direction?: Direction;
}) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(hexToRgb(value)));
  const ref = useRef<HTMLDivElement>(null);
  const saturationRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHsv(rgbToHsv(hexToRgb(value)));
  }, [value]);

  useEffect(() => {
    if (!open) {
      setCustomOpen(false);
      return;
    }
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const updateFromHsv = (next: Hsv) => {
    const clamped = {
      h: ((next.h % 360) + 360) % 360,
      s: clamp(next.s, 0, 1),
      v: clamp(next.v, 0, 1),
    };
    setHsv(clamped);
    onChange(rgbToHex(hsvToRgb(clamped)));
  };

  const handleSaturationPointer = (clientX: number, clientY: number) => {
    const el = saturationRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = clamp((clientX - rect.left) / rect.width, 0, 1);
    const v = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    updateFromHsv({ ...hsv, s, v });
  };

  const handleHuePointer = (clientX: number) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const h = clamp((clientX - rect.left) / rect.width, 0, 1) * 360;
    updateFromHsv({ ...hsv, h });
  };

  const startDrag = (move: (x: number, y: number) => void) => (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    move(e.clientX, e.clientY);
    const onMove = (event: MouseEvent) => move(event.clientX, event.clientY);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const rgb = hsvToRgb(hsv);
  const hueColor = `hsl(${hsv.h}, 100%, 50%)`;

  return (
    <div className="color-picker" ref={ref}>
      <button type="button" className="color-picker-preview" style={{ background: value }} onClick={() => setOpen(!open)} />
      {open && (
        <div className={`color-picker-dropdown ${direction === 'up' ? 'open-up' : 'open-down'}`}>
          <div className="color-picker-grid">
            {PRESET_COLORS.map(c => (
              <button
                type="button"
                key={c}
                className={`color-picker-swatch ${c.toLowerCase() === value.toLowerCase() ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => onChange(c)}
              />
            ))}
          </div>

          <div className="color-picker-custom">
            <button type="button" className={`color-picker-custom-label ${customOpen ? 'active' : ''}`} onClick={() => setCustomOpen(v => !v)}>
              <span className="color-picker-custom-chip" style={{ background: value }} />
              <span>Custom</span>
            </button>
            <span className="color-picker-hex">{value}</span>
          </div>

          {customOpen && (
            <div className={`color-picker-panel ${direction === 'up' ? 'panel-up' : 'panel-down'}`}>
              <div
                ref={saturationRef}
                className="color-picker-panel-sv"
                style={{ backgroundColor: hueColor }}
                onMouseDown={startDrag(handleSaturationPointer)}
              >
                <div className="color-picker-panel-sv-white" />
                <div className="color-picker-panel-sv-black" />
                <div
                  className="color-picker-panel-sv-thumb"
                  style={{
                    left: `${hsv.s * 100}%`,
                    top: `${(1 - hsv.v) * 100}%`,
                    background: value,
                  }}
                />
              </div>

              <div className="color-picker-panel-controls">
                <div className="color-picker-panel-row">
                  <div className="color-picker-panel-preview" style={{ background: value }} />
                  <div
                    ref={hueRef}
                    className="color-picker-panel-hue"
                    onMouseDown={startDrag((x) => handleHuePointer(x))}
                  >
                    <div
                      className="color-picker-panel-hue-thumb"
                      style={{ left: `${(hsv.h / 360) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="color-picker-panel-rgb">
                  {([
                    ['R', rgb.r],
                    ['G', rgb.g],
                    ['B', rgb.b],
                  ] as const).map(([label, channel]) => (
                    <label key={label} className="color-picker-panel-field">
                      <input
                        type="number"
                        min={0}
                        max={255}
                        value={channel}
                        onChange={(e) => {
                          const next = clamp(Number(e.target.value || 0), 0, 255);
                          const nextRgb: Rgb = label === 'R'
                            ? { ...rgb, r: next }
                            : label === 'G'
                              ? { ...rgb, g: next }
                              : { ...rgb, b: next };
                          onChange(rgbToHex(nextRgb));
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
