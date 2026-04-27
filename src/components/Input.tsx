import React, { useState } from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement>, 'className'> {
  label?: string;
  error?: string | null;
  fullWidth?: boolean;
  as?: 'input' | 'select';
  className?: string;
  /** Show an eye icon toggle for password fields */
  showToggle?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  fullWidth = true,
  as = 'input',
  className = '',
  children,
  showToggle,
  type,
  ...props
}, ref) => {
  const [visible, setVisible] = useState(false);

  const baseStyles = 'px-4 py-3 text-lg rounded-lg border-2 bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200';
  const widthClass = fullWidth ? 'w-full' : 'w-auto';

  const inputStyles = error
    ? `${baseStyles} border-red-500 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500`
    : `${baseStyles} border-gray-300 text-gray-900 placeholder-gray-400`;

  // Determine the effective input type
  const isPassword = type === 'password';
  const effectiveType = isPassword && visible ? 'text' : type;

  return (
    <div className={`${widthClass} space-y-2`}>
      {label && (
        <label className="block text-lg font-medium text-gray-700">
          {label}
        </label>
      )}
      {as === 'select' ? (
        <select
          className={`${inputStyles} ${widthClass} ${className}`}
          {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)}
        >
          {children}
        </select>
      ) : isPassword && showToggle !== false ? (
        // Password field with visibility toggle
        <div className="relative">
          <input
            ref={ref}
            type={effectiveType}
            className={`${inputStyles} ${widthClass} pr-12 ${className}`}
            {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          />
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? (
              // Eye-off icon
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              // Eye icon
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      ) : (
        <input
          ref={ref}
          type={type}
          className={`${inputStyles} ${widthClass} ${className}`}
          {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      {error && (
        <p className="text-red-600 text-sm mt-1">
          {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
