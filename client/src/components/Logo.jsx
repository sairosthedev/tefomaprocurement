import React from 'react';

const Logo = ({ 
  variant = 'default', // 'default', 'compact', 'icon'
  className = '',
  showText = true 
}) => {
  // Logo image paths
  const logoImage = '/fossilLogo.png';
  const logoIcon = '/fossilLogo.png'; // Use same logo for icon variant
  
  if (variant === 'icon') {
    // Just the logo icon
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <img 
          src={logoIcon || logoImage} 
          alt="Fossil Contracting Logo" 
          className="h-10 w-auto object-contain"
          onError={(e) => {
            // Fallback if image doesn't exist
            e.target.style.display = 'none';
            const fallback = e.target.nextSibling;
            if (fallback) {
              fallback.style.display = 'block';
            }
          }}
        />
        <div style={{ display: 'none' }} className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <span className="text-lg font-bold text-primary">FC</span>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    // Compact version for sidebar
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <img 
          src={logoImage} 
          alt="Fossil Contracting" 
          className="h-14 w-auto object-contain flex-shrink-0"
          onError={(e) => {
            e.target.style.display = 'none';
            const fallback = e.target.nextSibling;
            if (fallback) {
              fallback.style.display = 'flex';
            }
          }}
        />
        {showText && (
          <div className="flex flex-col">
            <span className="text-base font-bold text-white leading-tight">FossilProcure</span>
            <span className="text-xs text-gray-300 leading-tight">fossilapps</span>
          </div>
        )}
      </div>
    );
  }

  // Default full logo
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img 
        src={logoImage} 
        alt="Fossil Contracting Logo" 
        className="h-16 w-auto object-contain max-w-full"
        onError={(e) => {
          e.target.style.display = 'none';
          const fallback = e.target.nextSibling;
          if (fallback) {
            fallback.style.display = 'flex';
          }
        }}
      />
      {/* Fallback if image doesn't exist */}
      <div style={{ display: 'none' }} className="flex items-center gap-2">
        <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
          <span className="text-xl font-bold text-primary">FC</span>
        </div>
        {showText && (
          <div>
            <div className="text-xl font-bold text-gray-900">FOSSIL CONTRACTING</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Logo;

