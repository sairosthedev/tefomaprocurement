import React from 'react';
import { Eye } from 'lucide-react';

export default function ViewButton({ onClick, className = '', disabled = false, size = 'sm', text = 'View' }: any) {
  const baseClasses = 'inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium transition-colors';

  const sizeClasses: any = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2 text-base rounded-xl',
    lg: 'px-5 py-2.5 text-lg rounded-xl'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${sizeClasses[size]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      title="View Details"
    >
      <Eye className={size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-5 w-5' : 'h-5 w-5'} />
      {text}
    </button>
  );
}
