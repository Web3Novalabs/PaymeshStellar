import React, { useId } from 'react';

type InputType = 'text' | 'email' | 'password' | 'number';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** HTML input type. Defaults to 'text' */
  type?: InputType;
  /** Optional label rendered above the input, linked via htmlFor/id */
  label?: string;
  /** Validation error message. When present, the input switches to its error style */
  error?: string;
  /** Additional guidance rendered below the input. Hidden while an error is shown */
  helpText?: string;
}

/**
 * Input — a reusable, accessible form field for text, email, password, and
 * number values, with label, error, and help text support.
 *
 * Forwards all native <input> attributes (value, onChange, placeholder,
 * required, disabled, etc.) via props spreading.
 */
export default function Input({
  type = 'text',
  label,
  error,
  helpText,
  id,
  className = '',
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const helpTextId = helpText ? `${inputId}-help-text` : undefined;

  const base =
    'w-full rounded-lg border px-4 py-2 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

  const stateClasses = error
    ? 'border-red-500 text-red-900 placeholder-red-300 focus:ring-red-500 dark:text-red-100'
    : 'border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        className={`${base} ${stateClasses} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={[errorId, helpTextId].filter(Boolean).join(' ') || undefined}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : (
        helpText && (
          <p id={helpTextId} className="text-sm text-gray-500 dark:text-gray-400">
            {helpText}
          </p>
        )
      )}
    </div>
  );
}
