'use client';

import dynamic from 'next/dynamic';

const SequencerWorkstation = dynamic(
  () => import('./SequencerWorkstation'),
  {
    ssr: false,
    loading: () => (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#00e5ff', fontFamily: 'monospace' }}>
        LOADING SNUZY SYNTH WORKSTATION...
      </div>
    ),
  }
);

export default function SequencerClientWrapper() {
  return <SequencerWorkstation />;
}