'use client';

import React, { useCallback, useState } from 'react';
import Button from '@/components/Button';
import Input from '@/components/Input';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Member {
  /** Unique identifier for this member row */
  id: string;
  /** Display name of the member */
  name: string;
  /** Allocation percentage (0–100) */
  percentage: number;
}

export interface MemberInputProps {
  /** Current list of members */
  members: Member[];
  /** Called when the member list changes */
  onChange: (members: Member[]) => void;
  /** Optional label rendered above the group */
  label?: string;
  /** Optional validation error shown below the group */
  error?: string;
  /** Optional help text displayed below the group when no error */
  helpText?: string;
  /** When true, all inputs are disabled */
  disabled?: boolean;
}

interface ValidationResult {
  total: number;
  isValid: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let nextMemberId = 1;

function generateMemberId(): string {
  return `member-${nextMemberId++}`;
}

function calculateTotal(members: Member[]): ValidationResult {
  const total = members.reduce((sum, m) => sum + (m.percentage || 0), 0);
  return { total, isValid: total === 100 };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MemberInput({
  members,
  onChange,
  label,
  error,
  helpText,
  disabled = false,
}: MemberInputProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleAddMember = useCallback(() => {
    onChange([...members, { id: generateMemberId(), name: '', percentage: 0 }]);
  }, [members, onChange]);

  const handleRemoveMember = useCallback(
    (id: string) => {
      onChange(members.filter((m) => m.id !== id));
    },
    [members, onChange],
  );

  const handleMemberChange = useCallback(
    (id: string, field: 'name' | 'percentage', value: string) => {
      onChange(
        members.map((m) => {
          if (m.id !== id) return m;
          if (field === 'name') {
            return { ...m, name: value };
          }
          // Empty input renders a placeholder; parse numeric entry with 0-100 bounds.
          const parsed = value === '' ? 0 : Math.max(0, Math.min(100, Number(value)));
          return { ...m, percentage: Number.isFinite(parsed) ? parsed : 0 };
        }),
      );
    },
    [members, onChange],
  );

  const validation = calculateTotal(members);
  const hasError = Boolean(error) || (members.length > 0 && !validation.isValid);
  const errorText =
    error ??
    (members.length > 0 && !validation.isValid
      ? `Total allocation is ${validation.total.toFixed(1)}%. Please adjust so percentages total exactly 100%.`
      : '');

  return (
    <div className="flex flex-col gap-3">
      {label && (
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
      )}

      {members.length > 0 && (
        <ul className="flex flex-col gap-2" role="list" aria-label="Members">
          {members.map((member, index) => {
            const memberIndex = index + 1;
            return (
              <li
                key={member.id}
                className={`rounded-lg border p-3 transition-colors duration-200 ${
                  hoveredId === member.id
                    ? 'border-gray-300 dark:border-gray-600'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
                onMouseEnter={() => setHoveredId(member.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_8rem_auto]">
                  <Input
                    label="Name"
                    placeholder="Member name"
                    value={member.name}
                    onChange={(e) => handleMemberChange(member.id, 'name', e.target.value)}
                    disabled={disabled}
                    aria-label={`Name for member ${memberIndex}`}
                  />
                  <Input
                    label="Percentage"
                    type="number"
                    min={0}
                    max={100}
                    placeholder="%"
                    value={member.percentage || ''}
                    onChange={(e) => handleMemberChange(member.id, 'percentage', e.target.value)}
                    disabled={disabled}
                    aria-label={`Percentage for member ${memberIndex}`}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={disabled}
                    className="mt-6 inline-flex items-center justify-center rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-red-600 transition-all duration-200 hover:border-red-200 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:border-red-900 dark:hover:bg-red-950/30"
                    aria-label={`Remove member ${memberIndex}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {members.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800/40">
          <span className="font-medium text-gray-700 dark:text-gray-300">Total allocation</span>
          <span
            className={`font-semibold tabular-nums ${
              validation.isValid
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {validation.total.toFixed(1)}%
          </span>
        </div>
      )}

      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleAddMember}
          disabled={disabled}
          aria-label="Add member"
        >
          + Add Member
        </Button>
      </div>

      {hasError ? (
        <p className="text-sm text-red-600" role={error ? 'alert' : undefined}>
          {errorText}
        </p>
      ) : (
        helpText && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{helpText}</p>
        )
      )}
    </div>
  );
}