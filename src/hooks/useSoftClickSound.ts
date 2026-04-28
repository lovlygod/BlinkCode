import { useCallback, useEffect, useRef } from 'react';

interface SoftClickOptions {
  enabled?: boolean;
  minIntervalMs?: number;
  volume?: number;
  preset?: 'click' | 'select';
}

export function useSoftClickSound(options: SoftClickOptions = {}) {
  const {
    enabled = true,
    minIntervalMs = 40,
    volume = 0.06,
    preset = 'click',
  } = options;

  const ctxRef = useRef<AudioContext | null>(null);
  const lastPlayRef = useRef(0);

  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, []);

  const play = useCallback(() => {
    if (!enabled) return;

    const now = performance.now();
    if (now - lastPlayRef.current < minIntervalMs) return;
    lastPlayRef.current = now;

    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;

    if (!ctxRef.current) ctxRef.current = new AC();
    const ctx = ctxRef.current;
    if (!ctx) return;

    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    if (preset === 'select') {
      // Slightly brighter but still soft "popup/select" tone.
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(850, t0);
      filter.Q.setValueAtTime(0.8, t0);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, t0);
      osc.frequency.exponentialRampToValueAtTime(560, t0 + 0.03);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(volume * 0.7, t0 + 0.0025);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.036);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0);
      osc.stop(t0 + 0.04);
      return;
    }

    // Default: natural soft click.
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, t0);
    filter.Q.setValueAtTime(0.0001, t0);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, t0);
    osc.frequency.exponentialRampToValueAtTime(300, t0 + 0.028);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume * 0.75, t0 + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.032);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + 0.036);
  }, [enabled, minIntervalMs, volume, preset]);

  return play;
}

