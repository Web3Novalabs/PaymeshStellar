'use client';

import { useState, type FormEvent } from 'react';
import Input from './Input';
import Button from './Button';

export interface GroupFormValues {
  name: string;
  paymentToken: string;
}

export interface TokenOption {
  label: string;
  value: string;
}

interface GroupFormProps {
  /** 'create' shows empty fields, 'edit' pre-populates from initialValues. Defaults to 'create'. */
  mode?: 'create' | 'edit';
  /** Pre-populated field values, used in edit mode (or to prefill a create form). */
  initialValues?: Partial<GroupFormValues>;
  /** Available payment tokens for the select dropdown. */
  tokenOptions?: TokenOption[];
  /** Called with the validated form values on submit. */
  onSubmit: (values: GroupFormValues) => void | Promise<void>;
  /** Called when the cancel button is clicked. */
  onCancel: () => void;
  /** Disables the form and shows a loading state on the submit button. */
  isSubmitting?: boolean;
}

const DEFAULT_TOKEN_OPTIONS: TokenOption[] = [
  { label: 'USDC', value: 'USDC' },
  { label: 'XLM', value: 'XLM' },
  { label: 'EURC', value: 'EURC' },
];

interface FormErrors {
  name?: string;
  paymentToken?: string;
}

function validate(values: GroupFormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.name.trim()) {
    errors.name = 'Group name is required';
  }
  if (!values.paymentToken.trim()) {
    errors.paymentToken = 'Payment token is required';
  }
  return errors;
}

/**
 * GroupForm — reusable form for creating or editing a payroll group.
 *
 * Standalone and unopinionated about layout, so it can be dropped into a
 * modal or a dedicated page. Handles its own field state and validation;
 * the caller only receives validated values via `onSubmit`.
 */
export default function GroupForm({
  mode = 'create',
  initialValues,
  tokenOptions = DEFAULT_TOKEN_OPTIONS,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: GroupFormProps) {
  const [values, setValues] = useState<GroupFormValues>({
    name: initialValues?.name ?? '',
    paymentToken: initialValues?.paymentToken ?? '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Input
        label="Group Name"
        id="group-form-name"
        value={values.name}
        onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
        error={errors.name}
        placeholder="e.g., Engineering Team Payroll"
        disabled={isSubmitting}
        required
      />

      <div className="flex flex-col gap-1">
        <label
          htmlFor="group-form-token"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Payment Token
        </label>
        <select
          id="group-form-token"
          value={values.paymentToken}
          onChange={(e) => setValues((prev) => ({ ...prev, paymentToken: e.target.value }))}
          disabled={isSubmitting}
          aria-invalid={errors.paymentToken ? true : undefined}
          aria-describedby={errors.paymentToken ? 'group-form-token-error' : undefined}
          className={`w-full rounded-lg border px-4 py-2 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            errors.paymentToken
              ? 'border-red-500 text-red-900 focus:ring-red-500 dark:text-red-100'
              : 'border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50'
          }`}
        >
          <option value="" disabled>
            Select a token
          </option>
          {tokenOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.paymentToken && (
          <p id="group-form-token-error" className="text-sm text-red-600" role="alert">
            {errors.paymentToken}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          {mode === 'edit' ? 'Update Group' : 'Create Group'}
        </Button>
      </div>
    </form>
  );
}
