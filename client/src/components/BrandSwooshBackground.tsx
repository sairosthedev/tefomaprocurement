import React from 'react';

/**
 * Full-page decorative background echoing the Tefoma logo:
 * white page with a few light logo tiles.
 */
export default function BrandSwooshBackground() {
  const logoTiles = [
    {
      style: { left: '5%', top: '8%', width: '140px', height: '82px', opacity: 0.72 },
      tileStyle: { transform: 'rotate(-7deg)' }
    },
    {
      style: { right: '8%', top: '14%', width: '150px', height: '90px', opacity: 0.74, animationDelay: '0.4s' },
      tileStyle: { transform: 'rotate(6deg)' }
    },
    {
      style: { left: '14%', top: '43%', width: '132px', height: '78px', opacity: 0.66, animationDelay: '0.8s' },
      tileStyle: { transform: 'rotate(5deg)' }
    },
    {
      style: { right: '13%', top: '47%', width: '132px', height: '78px', opacity: 0.68, animationDelay: '1.2s' },
      tileStyle: { transform: 'rotate(-5deg)' }
    },
    {
      style: { left: '9%', bottom: '8%', width: '150px', height: '90px', opacity: 0.64, animationDelay: '1.6s' },
      tileStyle: { transform: 'rotate(4deg)' }
    },
    {
      style: { right: '19%', bottom: '9%', width: '132px', height: '78px', opacity: 0.64, animationDelay: '2s' },
      tileStyle: { transform: 'rotate(-6deg)' }
    }
  ];

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ background: '#ffffff' }}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,115,186,0.06),rgba(255,255,255,0)_48%)]" />

      {logoTiles.map(({ style, tileStyle }, index) => (
        <div
          key={index}
          className="absolute animate-float"
          style={style}
        >
          <div
            className="h-full w-full rounded-lg border border-white/45 bg-white/80 p-3 shadow-xl shadow-black/10 backdrop-blur-sm"
            style={tileStyle}
          >
            <img src="/tefomaLogo.png" alt="" className="h-full w-full object-contain" />
          </div>
        </div>
      ))}
    </div>
  );
}
