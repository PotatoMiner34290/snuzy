import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Snuzy Drum & Synth Workstation',
  description: 'Tone.js Audio Synthesis • Multi-layer Looper • MIDI File Exporter & Importer',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}