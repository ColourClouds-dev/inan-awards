import React from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement>, 'className'> {
  label?: string;
  error?: string | null;
  fullWidth?: boolean;
  as?: 'input' | 'select';
  className?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  fullWidth = true,
  as = 'input',
  className = '',
  children,
  ...props
}) => {
  const baseStyles = 'px-4 py-3 text-lg rounded-lg border-2 bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200';
  const widthClass = fullWidth ? 'w-full' : 'w-auto';
  
  const inputStyles = error
    ? `${baseStyles} border-red-500 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500`
    : `${baseStyles} border-gray-300 text-gray-900 placeholder-gray-400`;

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
      ) : (
        <input
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
};

export default Input;
