'use client';

import dynamic from 'next/dynamic';

const SequencerWorkstation = dynamic(
  () => import('./SequencerWorkstation'),
  {
    ssr: false,
    loading: () => (
      <div style={{ position: 'fixed', inset: 0, background: '#0b0e14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <style>{'@keyframes bootSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(280px); } }'}</style>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 6, color: '#00e5ff', textShadow: '0 0 24px #00e5ff66' }}>
          SNUZY
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: '#78909c' }}>
          MIDI WORKSTATION
        </div>
        <div style={{ width: 280, height: 8, borderRadius: 999, background: '#1b2230', border: '1px solid #2c3547', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: 90, borderRadius: 999, background: 'linear-gradient(90deg, #00e5ff, #00e676)', animation: 'bootSlide 1.1s ease-in-out infinite' }} />
        </div>
        <div style={{ fontSize: 12, color: '#90a4ae' }}>
          Loading studio…
        </div>
      </div>
    ),
  }
);

export default function SequencerClientWrapper() {
  return <SequencerWorkstation />;
}
