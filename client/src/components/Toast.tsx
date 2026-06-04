import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

const ToastContext = createContext<any>(null);

export function ToastProvider({ children }: any) {
  const [toasts, setToasts] = useState<any[]>([]);

  const addToast = useCallback((message: any, type: any = 'success', duration: any = 4000) => {
    const id = Date.now();
    setToasts((prev: any) => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts((prev: any) => prev.filter((t: any) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: any) => {
    setToasts((prev: any) => prev.filter((t: any) => t.id !== id));
  }, []);

  const showToast = addToast; // Alias for backwards compatibility
  
  return (
    <ToastContext.Provider value={{ addToast, showToast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 space-y-2 max-w-md w-full mx-4">
        {toasts.map((toast: any) => (
          <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ message, type, onClose }: any) {
  const icons: any = {
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <XCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertCircle className="h-5 w-5 text-amber-500" />
  };

  const bgColors: any = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200'
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${bgColors[type]} animate-fade-in`}>
      {icons[type]}
      <span className="text-sm font-medium text-gray-800 flex-1">{message}</span>
      <button onClick={onClose} className="ml-2 p-1 hover:bg-black/5 rounded-lg transition-colors">
        <X className="h-4 w-4 text-gray-500" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
