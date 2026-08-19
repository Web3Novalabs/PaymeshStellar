'use client';

import { useId } from 'react';
import { MemberAllocation, getRemainingBasisPoints, basisPointsToPercentage, splitEvenly, rebalanceAllocation } from '@/lib/utils/allocation';
import Button from './Button';

interface AllocatorProps {
  members: MemberAllocation[];
  onChange: (members: MemberAllocation[]) => void;
  disabled?: boolean;
}

/**
 * Allocator - Component for managing basis point allocation among members.
 * Features:
 * - Integer basis points everywhere (no floats in allocation path)
 * - Display as percent to 2 decimals
 * - "Split evenly" with deterministic dust placement
 * - Per-row lock so rebalancing skips locked rows
 * - Live remaining-bps indicator that blocks submission unless total is exactly 10000
 */
export default function Allocator({ members, onChange, disabled = false }: AllocatorProps) {
  const baseId = useId();
  const remaining = getRemainingBasisPoints(members);
  const isValid = remaining === 0;

  const handleSplitEvenly = () => {
    if (members.length === 0 || disabled) return;

    const evenSplit = splitEvenly(members.length);
    const updated = members.map((member, index) => ({
      ...member,
      basisPoints: evenSplit[index] || 0,
    }));
    onChange(updated);
  };

  const handleRebalance = () => {
    if (disabled) return;
    onChange(rebalanceAllocation(members));
  };

  const handleBasisPointsChange = (id: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) return;

    onChange(
      members.map((m) =>
        m.id === id
          ? {
              ...m,
              basisPoints: numValue,
            }
          : m
      )
    );
  };

  const handleToggleLock = (id: string) => {
    if (disabled) return;
    onChange(
      members.map((m) =>
        m.id === id
          ? {
              ...m,
              locked: !m.locked,
            }
          : m
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Allocation</h3>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleSplitEvenly}
            disabled={disabled || members.length === 0}
            aria-label="Split allocation evenly among all members"
          >
            Split Evenly
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleRebalance}
            disabled={disabled || members.length === 0}
            aria-label="Rebalance allocation among unlocked members"
          >
            Rebalance Unlocked
          </Button>
        </div>
      </div>

      {/* Remaining basis points indicator */}
      <div
        className={`rounded-lg border p-4 ${
          isValid
            ? 'border-green-300 bg-green-50'
            : remaining > 0
              ? 'border-yellow-300 bg-yellow-50'
              : 'border-red-300 bg-red-50'
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {isValid ? (
              <span className="text-green-800">Allocation complete: 10,000 / 10,000 basis points</span>
            ) : remaining > 0 ? (
              <span className="text-yellow-800">
                Remaining: {remaining} basis points ({basisPointsToPercentage(remaining)}%)
              </span>
            ) : (
              <span className="text-red-800">
                Over-allocated by {Math.abs(remaining)} basis points ({basisPointsToPercentage(Math.abs(remaining))}%)
              </span>
            )}
          </p>
          {!isValid && (
            <span className="text-sm text-gray-600">
              Total must equal exactly 10,000 basis points (100%)
            </span>
          )}
        </div>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-gray-500 italic">Add members in the Members section to allocate shares.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">
                  Member
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">
                  Basis Points
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">
                  Percentage
                </th>
                <th scope="col" className="px-4 py-3 text-center font-semibold text-gray-600">
                  Locked
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((member) => {
                const rowId = `${baseId}-row-${member.id}`;
                const percentage = basisPointsToPercentage(member.basisPoints);
                const isOverAllocated = member.basisPoints > 10000;

                return (
                  <tr key={member.id} className={member.locked ? 'bg-gray-50' : ''}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {member.name || 'Unnamed Member'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          id={`${rowId}-bp`}
                          type="number"
                          min="0"
                          max="10000"
                          value={member.basisPoints}
                          onChange={(e) => handleBasisPointsChange(member.id, e.target.value)}
                          disabled={disabled || member.locked}
                          className={`w-24 rounded-lg border px-3 py-2 text-sm ${
                            isOverAllocated
                              ? 'border-red-500 text-red-900 focus:border-red-500 focus:ring-red-500'
                              : 'border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500'
                          } disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400`}
                          aria-label={`Basis points for ${member.name || 'member'}`}
                          aria-describedby={`${rowId}-percentage`}
                        />
                        <span className="text-xs text-gray-500">bp</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        id={`${rowId}-percentage`}
                        className={`font-medium ${isOverAllocated ? 'text-red-600' : 'text-gray-700'}`}
                      >
                        {percentage}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleLock(member.id)}
                        disabled={disabled}
                        className={`inline-flex items-center justify-center rounded p-2 transition ${
                          member.locked
                            ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                        aria-label={`${member.locked ? 'Unlock' : 'Lock'} allocation for ${member.name || 'member'}`}
                        aria-pressed={member.locked}
                      >
                        {member.locked ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Helper text */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs text-gray-600">
          <strong>Tip:</strong> Use "Split Evenly" to distribute 10,000 basis points equally among all members.
          Lock specific members to preserve their allocation when using "Rebalance Unlocked".
        </p>
      </div>
    </div>
  );
}
