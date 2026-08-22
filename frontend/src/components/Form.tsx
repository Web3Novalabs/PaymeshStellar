import React, { useState, useCallback, type FormEvent } from 'react';
import type { ReactNode } from 'react';
import Input from './Input';
import Button from './Button';

// ── Field descriptor ────────────────────────────────────────────────

export interface FormField {
  /** Field name (used as the key in form values). */
  name: string;
  /** Label rendered above the field. */
  label: string;
  /** HTML input type. Defaults to 'text'. */
  type?: 'text' | 'email' | 'password' | 'number';
  /** Placeholder text. */
  placeholder?: string;
  /** Whether the field is required. */
  required?: boolean;
  /** Custom validation function. Return a string error message, or undefined if valid. */
  validate?: (value: string, values: Record<string, string>) => string | undefined;
}

// ── Props ───────────────────────────────────────────────────────────

export interface FormProps {
  /** Array of field descriptors that define the form's layout and validation. */
  fields: FormField[];
  /** Called when all fields pass validation. The values object maps field names to their current values. */
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
  /** Text shown on the submit button. Defaults to 'Submit'. */
  submitLabel?: string;
  /** When true, the submit button is disabled and shows a spinner. */
  isLoading?: boolean;
  /** Optional children rendered after the fields but before the submit button. */
  children?: ReactNode;
  /** Additional CSS class on the <form> element. */
  className?: string;
  /** Optional heading rendered above the fields. */
  title?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

type FieldErrors = Record<string, string | undefined>;
type FieldValues = Record<string, string>;

function runFieldValidations(fields: FormField[], values: FieldValues): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of fields) {
    const value = values[field.name] ?? '';
    if (field.required && value.trim().length === 0) {
      errors[field.name] = `${field.label} is required`;
    } else if (field.validate) {
      const error = field.validate(value, values);
      if (error) {
        errors[field.name] = error;
      }
    }
  }
  return errors;
}

function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some((e) => e !== undefined);
}

// ── Component ───────────────────────────────────────────────────────

/**
 * Form — a reusable form component with built-in validation feedback,
 * loading state, and reset capability.
 *
 * The component manages its own field state internally. Each field is
 * described by a `FormField` descriptor that can carry a custom
 * `validate` function. Errors are displayed below each field using
 * the existing Input component's error prop.
 *
 * @example
 * ```tsx
 * <Form
 *   fields={[
 *     { name: 'email', label: 'Email', type: 'email', required: true },
 *     { name: 'name', label: 'Full Name', required: true },
 *   ]}
 *   onSubmit={(values) => handleSubmit(values)}
 *   submitLabel="Create Account"
 * />
 * ```
 */
export default function Form({
  fields,
  onSubmit,
  submitLabel = 'Submit',
  isLoading = false,
  children,
  className = '',
  title,
}: FormProps) {
  const [values, setValues] = useState<FieldValues>(() => {
    const initial: FieldValues = {};
    for (const field of fields) {
      initial[field.name] = '';
    }
    return initial;
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const handleChange = useCallback(
    (name: string, value: string) => {
      setValues((prev) => ({ ...prev, [name]: value }));
      // Clear the error for this field when the user starts typing
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    },
    [errors],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitted(true);

      const validationErrors = runFieldValidations(fields, values);
      setErrors(validationErrors);

      if (hasErrors(validationErrors)) {
        return;
      }

      await onSubmit(values);
    },
    [fields, values, onSubmit],
  );

  const reset = useCallback(() => {
    const initial: FieldValues = {};
    for (const field of fields) {
      initial[field.name] = '';
    }
    setValues(initial);
    setErrors({});
    setSubmitted(false);
  }, [fields]);

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex flex-col gap-4 ${className}`}
      noValidate
    >
      {title && (
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          {title}
        </h2>
      )}

      {fields.map((field) => (
        <Input
          key={field.name}
          type={field.type ?? 'text'}
          label={field.label}
          placeholder={field.placeholder}
          required={field.required}
          value={values[field.name] ?? ''}
          error={submitted ? errors[field.name] : undefined}
          onChange={(e) => handleChange(field.name, e.target.value)}
        />
      ))}

      {children}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" variant="primary" isLoading={isLoading}>
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={reset}
          disabled={isLoading}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}

// ── Re-export for convenience ───────────────────────────────────────

export { Button };