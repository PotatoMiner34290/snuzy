'use client';

import React, { useLayoutEffect, useState } from 'react';

export interface TourStep {
  title: string;
  body: React.ReactNode;
  target?: () => HTMLElement | null;
  view?: 'arrangement' | 'steps';
}

interface Props {
  step: number;
  steps: TourStep[];
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}

const BACKDROP: React.CSSProperties = {
  position: 'fixed',
  zIndex: 11000,
  background: 'rgba(5, 8, 14, 0.72)',
};

export default function TourGuide({ step, steps, onNext, onBack, onClose }: Props) {
  const current = steps[step];
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      try {
        const el = current.target?.();
        if (!el) {
          setRect(null);
          return;
        }
        const r = el.getBoundingClientRect();
        setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
      } catch {
        setRect(null);
      }
    };
    measure();
    const t = setTimeout(measure, 120);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [step, current]);

  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext, onBack, onClose]);

  const pad = 8;
  const belowSpace = rect ? window.innerHeight - (rect.top + rect.height) : 0;
  const tipBelow = !rect || belowSpace > 260;
  const tipStyle: React.CSSProperties = rect
    ? tipBelow
      ? { left: Math.max(12, Math.min(rect.left, window.innerWidth - 332)), top: rect.top + rect.height + 12 }
      : { left: Math.max(12, Math.min(rect.left, window.innerWidth - 332)), top: Math.max(12, rect.top - 12), transform: 'translateY(-100%)' }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

  const last = step === steps.length - 1;

  return (
    <>
      {rect ? (
        <>
          <div style={{ ...BACKDROP, left: 0, top: 0, right: 0, height: Math.max(0, rect.top - pad) }} onClick={onClose} />
          <div style={{ ...BACKDROP, left: 0, top: rect.top + rect.height + pad, right: 0, bottom: 0 }} onClick={onClose} />
          <div style={{ ...BACKDROP, left: 0, top: rect.top - pad, width: Math.max(0, rect.left - pad), height: rect.height + pad * 2 }} onClick={onClose} />
          <div style={{ ...BACKDROP, left: rect.left + rect.width + pad, top: rect.top - pad, right: 0, height: rect.height + pad * 2 }} onClick={onClose} />
          <div
            style={{
              position: 'fixed', zIndex: 11001, pointerEvents: 'none',
              left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2,
              border: '2px solid #00e5ff', borderRadius: 10, boxShadow: '0 0 24px #00e5ff66',
            }}
          />
        </>
      ) : (
        <div style={{ ...BACKDROP, inset: 0 }} onClick={onClose} />
      )}

      <div
        style={{
          position: 'fixed', zIndex: 11002, width: 320,
          background: '#171c29', border: '1px solid #00e5ff88', borderRadius: 12,
          boxShadow: '0 16px 48px #000d', padding: '16px 18px', color: '#dbe2e9',
          ...tipStyle,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <strong style={{ color: '#00e5ff', fontSize: 14, flex: 1 }}>{current.title}</strong>
          <span style={{ color: '#607d8b', fontSize: 11, flexShrink: 0 }}>{step + 1} / {steps.length}</span>
        </div>
        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#b0bec5', marginTop: 8 }}>{current.body}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 14, alignItems: 'center' }}>
          <button
            onClick={onBack} disabled={step === 0}
            style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #3b475d', background: '#222a3b', color: step === 0 ? '#546e7a' : '#eee', cursor: step === 0 ? 'default' : 'pointer', fontSize: 12, fontWeight: 700 }}
          >
            ← Back
          </button>
          <button
            onClick={onNext}
            style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#00e5ff', color: '#000', cursor: 'pointer', fontSize: 12, fontWeight: 800, flex: 1 }}
          >
            {last ? 'Finish ✓' : 'Next →'}
          </button>
          <button
            onClick={onClose}
            style={{ padding: '7px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: '#78909c', cursor: 'pointer', fontSize: 12 }}
          >
            Skip
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 10, justifyContent: 'center' }}>
          {steps.map((_, i) => (
            <span key={i} style={{ width: 16, height: 4, borderRadius: 2, background: i === step ? '#00e5ff' : i < step ? '#00e5ff55' : '#2c3547' }} />
          ))}
        </div>
      </div>
    </>
  );
}
