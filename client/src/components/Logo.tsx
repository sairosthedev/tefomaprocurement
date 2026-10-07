const LOGO_IMAGE = '/sourceline-logo.png';
const MARK_IMAGE = '/sourceline-mark.png';
const PRODUCT_NAME = 'Sourceline';

const Logo = ({
  variant = 'default', // 'default', 'compact', 'icon'
  className = '',
  showText = true
}: any) => {
  const Fallback = ({ size = 'text-xl' }: { size?: string }) => (
    <div className="flex items-center gap-2">
      <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
        <span className={`${size} font-bold text-primary`}>S</span>
      </div>
      {showText && (
        <div className="text-xl font-bold text-primary">
          Source<span className="text-brand-blue">line</span>
        </div>
      )}
    </div>
  );

  if (variant === 'icon') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="bg-white rounded-lg p-1.5 inline-flex max-w-full">
          <img
            src={MARK_IMAGE}
            alt={PRODUCT_NAME}
            className="h-10 w-auto max-w-full object-contain"
            onError={(e: any) => {
              e.target.style.display = 'none';
              const fallback = e.target.nextSibling;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <div style={{ display: 'none' }} className="h-10 w-10 bg-primary/10 rounded-lg items-center justify-center">
            <span className="text-lg font-bold text-primary">S</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    // Sidebar version — the sidebar is navy and so is the "Source" wordmark,
    // so seat the logo on a white card for contrast.
    return (
      <div className={`w-full ${className}`}>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-center">
            <img
              src={LOGO_IMAGE}
              alt={PRODUCT_NAME}
              className="h-14 w-auto object-contain"
              onError={(e: any) => {
                e.target.style.display = 'none';
                const fallback = e.target.nextSibling;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div style={{ display: 'none' }} className="items-center">
              <span className="text-lg font-bold text-primary">
                Source<span className="text-brand-blue">line</span>
              </span>
            </div>
          </div>
          <div className="brand-accent-bar h-1 w-full" />
        </div>
        {showText && (
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-300 text-center mt-2">
            Procurement System
          </p>
        )}
      </div>
    );
  }

  // Default full logo (light backgrounds: login, register, unauthorized)
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src={LOGO_IMAGE}
        alt={`${PRODUCT_NAME} Procurement System`}
        className="h-24 w-auto object-contain max-w-full"
        onError={(e: any) => {
          e.target.style.display = 'none';
          const fallback = e.target.nextSibling;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
      <div style={{ display: 'none' }}>
        <Fallback />
      </div>
    </div>
  );
};

export default Logo;
