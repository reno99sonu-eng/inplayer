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
      {/* Dynamic Morphing Liquid Glass Orbs */}
      <div className="rf-intro-bg-orb-1" />
      <div className="rf-intro-bg-orb-2" />
      <div className="rf-intro-bg-orb-3" />

      {/* Floating 3D Liquid Glass Shield */}
      <div className="rf-glass-shield">
        {/* Specular Light Sweep */}
        <div className="rf-glass-sweep-shine" />

        {/* 3D Molten Typography */}
        <h1 className="rf-intro-logo">
          Raftaar Films
        </h1>

        {/* Frosted Glass Badge */}
        <div className="rf-intro-subtitle-pill">
          <span className="rf-intro-pill-dot" />
          <span>BY INPLAYER</span>
        </div>

        {/* Film / Sound Wave Rhythm Bars */}
        <div className="rf-intro-wave-container">
          {[0.2, 0.45, 0.7, 0.9, 0.6, 0.35, 0.15].map((delay, idx) => (
            <div
              key={idx}
              className="rf-intro-wave-bar"
              style={{
                animation: `rf-wave-bar 1.2s ease-in-out ${delay}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
