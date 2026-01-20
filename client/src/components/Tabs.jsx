import React from 'react';
import { cn } from '../../lib/utils';

const Tabs = ({ 
  tabs, 
  activeTab, 
  onTabChange, 
  className = '',
  variant = 'default' // 'default' or 'pills'
}) => {
  const baseStyles = variant === 'pills' 
    ? 'inline-flex items-center gap-1 p-1 bg-gray-100 rounded-xl'
    : 'flex items-center gap-1 border-b border-gray-200';

  return (
    <div className={cn('w-full', className)}>
      <div className={cn(baseStyles)}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.value;
          const tabStyles = variant === 'pills'
            ? cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              )
            : cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-200',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              );

          return (
            <button
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              className={cn(tabStyles, 'relative')}
              type="button"
            >
              {tab.icon && (
                <tab.icon className={cn('inline-block', isActive ? 'h-4 w-4' : 'h-4 w-4', 'mr-2')} />
              )}
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count !== null && (
                <span
                  className={cn(
                    'ml-2 px-2 py-0.5 rounded-full text-xs font-semibold',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'bg-gray-200 text-gray-600'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Tabs;

