import React, { useRef, useState } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  fullWidth?: boolean;
  isLoading?: boolean;
  loadingText?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  fullWidth = true,
  isLoading = false,
  loadingText,
  className = '',
  disabled,
  onClick,
  ...props
}) => {
  const { isOnline } = useNetworkStatus();
  const [showOfflineHint, setShowOfflineHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const baseStyles = 'px-5 py-2.5 rounded-lg text-base font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'btn-brand focus:ring-2 focus:ring-offset-2',
    secondary: 'btn-brand focus:ring-2 focus:ring-offset-2',
    outline: 'border-2 border-brand text-brand hover:opacity-80 focus:ring-2 focus:ring-offset-2',
  };

  const widthClass = fullWidth ? 'w-full' : 'w-full min-[360px]:w-auto';

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isOnline) {
      e.preventDefault();
      e.stopPropagation();
      // Flash the hint label, clear after 2.5 s
      setShowOfflineHint(true);
      if (hintTimer.current) clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setShowOfflineHint(false), 2500);
      return;
    }
    onClick?.(e);
  };

  return (
    <span className={`relative flex flex-col items-center gap-1 ${fullWidth ? 'w-full' : 'w-full min-[360px]:w-auto'}`}>
      <button
        className={`${baseStyles} ${variants[variant]} ${widthClass} ${className}`}
        disabled={disabled || isLoading}
        onClick={handleClick}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin shrink-0" />
            {loadingText || 'Loading...'}
          </div>
        ) : (
          children
        )}
      </button>

      {/* Offline hint — fades in below the button */}
      <span
        aria-live="polite"
        className={`text-xs font-medium text-amber-600 transition-all duration-300 ${
          showOfflineHint ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
        }`}
      >
        No internet connection
      </span>
    </span>
  );
};

export default Button;
