import React, { useState, useEffect } from 'react';

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 2400);
    const doneTimer = setTimeout(() => onComplete(), 2900);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  return (
    <>
      <style>{`
        @keyframes sl-enter {
          from { opacity: 0; transform: scale(0.82) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes sl-tagline {
          from { opacity: 0; transform: translateY(10px); letter-spacing: 0.3em; }
          to   { opacity: 1; transform: translateY(0);  letter-spacing: 0.22em; }
        }
        @keyframes sl-bar {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes sl-exit {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(1.05); }
        }
        @keyframes sl-float-a {
          0%, 100% { transform: translateY(0px) rotate(var(--rot)); }
          50%       { transform: translateY(-20px) rotate(var(--rot)); }
        }
        @keyframes sl-dot-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.3); }
        }
        @keyframes sl-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200%  center; }
        }

        .sl-logo  { animation: sl-enter   0.75s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both; }
        .sl-tag   { animation: sl-tagline 0.55s ease-out 0.85s both; }
        .sl-bar   { animation: sl-bar     2.1s cubic-bezier(0.4, 0, 0.2, 1) 0.3s both; }
        .sl-exit  { animation: sl-exit    0.5s ease-in forwards; }

        .sl-mark  { animation: sl-float-a var(--dur, 4s) ease-in-out var(--delay, 0s) infinite; }

        .sl-shimmer-text {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.5) 0%,
            rgba(255,255,255,1)   40%,
            rgba(255,255,255,0.5) 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: sl-shimmer 2.5s linear 1s infinite;
        }

        .sl-dot { animation: sl-dot-pulse 1.2s ease-in-out infinite; }
        .sl-dot:nth-child(2) { animation-delay: 0.2s; }
        .sl-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden${exiting ? ' sl-exit' : ''}`}
        style={{ background: 'linear-gradient(145deg, #020E20 0%, #051A38 55%, #0B2A55 100%)' }}
      >
        {/* Radial glow behind logo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,92,230,0.18) 0%, transparent 70%)',
          }}
        />

        {/* Floating background marks */}
        {[
          { top: '8%',  left: '6%',  size: 80,  rot: '15deg',  dur: '4.2s', delay: '0s',    opacity: 0.07 },
          { top: '12%', left: '78%', size: 60,  rot: '-22deg', dur: '5.1s', delay: '0.6s',  opacity: 0.06 },
          { top: '70%', left: '5%',  size: 70,  rot: '35deg',  dur: '3.8s', delay: '1.1s',  opacity: 0.06 },
          { top: '75%', left: '80%', size: 90,  rot: '-10deg', dur: '4.7s', delay: '0.3s',  opacity: 0.07 },
          { top: '45%', left: '90%', size: 50,  rot: '50deg',  dur: '5.5s', delay: '1.5s',  opacity: 0.05 },
          { top: '40%', left: '2%',  size: 55,  rot: '-40deg', dur: '4.0s', delay: '0.9s',  opacity: 0.05 },
        ].map((m, i) => (
          <img
            key={i}
            src="/sourceline-mark.png"
            alt=""
            aria-hidden
            className="absolute pointer-events-none sl-mark"
            style={{
              top: m.top,
              left: m.left,
              width: m.size,
              height: m.size,
              opacity: m.opacity,
              '--rot': m.rot,
              '--dur': m.dur,
              '--delay': m.delay,
              objectFit: 'contain',
              filter: 'brightness(0) invert(1)',
            } as React.CSSProperties}
          />
        ))}

        {/* Core content */}
        <div className="relative z-10 flex flex-col items-center gap-5 px-8">
          {/* Logo with spring entrance */}
          <div className="sl-logo drop-shadow-2xl">
            <img
              src="/sourceline-logo.png"
              alt="Sourceline"
              className="w-52 sm:w-64 md:w-72"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </div>

          {/* Tagline */}
          <p
            className="sl-tag sl-shimmer-text text-xs sm:text-sm font-semibold uppercase"
            style={{ letterSpacing: '0.22em' }}
          >
            Procurement Platform
          </p>

          {/* Progress bar */}
          <div className="w-44 sm:w-56 h-px bg-white/10 rounded-full overflow-hidden mt-3">
            <div
              className="sl-bar h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #005CE6 0%, #3D85F0 60%, #005CE6 100%)',
                backgroundSize: '200% auto',
              }}
            />
          </div>

          {/* Loading dots */}
          <div className="flex items-center gap-1.5 mt-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="sl-dot block w-1 h-1 rounded-full"
                style={{ backgroundColor: '#3D85F0', animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>

        {/* Bottom brand accent line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ background: 'linear-gradient(90deg, #051A38 0%, #005CE6 50%, #051A38 100%)' }}
        />
      </div>
    </>
  );
}
