'use client';
import { useEffect, useState } from 'react';
import './RaftaarFilms3DStyles.css';

interface Props {
  onComplete: () => void;
}

export default function RaftaarFilmsIntro({ onComplete }: Props) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // After 2.4s, start exit animation, then call onComplete
    const exitTimer = setTimeout(() => setExiting(true), 2400);
    const doneTimer = setTimeout(() => onComplete(), 3000);
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, [onComplete]);

  return (
    <div className={`rf-intro-overlay${exiting ? ' rf-intro-exiting' : ''}`}>
      {/* Ambient orbs */}
      <div
        className="rf-intro-bg-orb"
        style={{
          width: '60vw', height: '60vw',
          background: 'radial-gradient(circle, #FF7A18 0%, transparent 70%)',
          top: '-20%', left: '-20%', animationDelay: '0s',
        }}
      />
      <div
        className="rf-intro-bg-orb"
        style={{
          width: '50vw', height: '50vw',
          background: 'radial-gradient(circle, #FF4500 0%, transparent 70%)',
          bottom: '-15%', right: '-15%', animationDelay: '1.5s',
        }}
      />

      {/* Logo container */}
      <div style={{ position: 'relative', textAlign: 'center', padding: '0 2rem' }}>
        <div className="rf-intro-beam" />
        <div className="rf-intro-logo">
          Raftaar Films
        </div>
        <div className="rf-intro-subtitle">by InPlayer</div>
        <div className="rf-intro-line" />
      </div>
    </div>
  );
}
