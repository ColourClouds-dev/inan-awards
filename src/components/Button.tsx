import React from 'react';

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
  ...props
}) => {
  const baseStyles = 'px-6 py-3 rounded-lg text-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'btn-brand focus:ring-2 focus:ring-offset-2',
    secondary: 'btn-brand focus:ring-2 focus:ring-offset-2',
    outline: 'border-2 border-brand text-brand hover:opacity-80 focus:ring-2 focus:ring-offset-2',
  };

  const widthClass = fullWidth ? 'w-full' : 'w-full min-[360px]:w-auto';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${widthClass} ${className}`}
      disabled={disabled || isLoading}
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
  );
};

export default Button;
