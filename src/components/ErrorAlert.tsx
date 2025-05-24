
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onClose?: () => void;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, onClose }) => {
  return (
    <div className="bg-error-50 border border-error-200 text-error-800 rounded-lg p-4 mb-4 animate-fade-in-down flex items-start">
      <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 text-error-500" />
      <div className="flex-grow">{message}</div>
      {onClose && (
        <button 
          onClick={onClose} 
          className="ml-2 text-error-400 hover:text-error-600 transition-colors"
          aria-label="Kapat"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};
