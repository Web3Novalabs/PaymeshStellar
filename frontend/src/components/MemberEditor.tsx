'use client';

import { useId } from 'react';
import { MemberAllocation } from '@/lib/utils/allocation';
import { isValidStellarAddress } from '@/lib/utils/stellar';
import Input from './Input';
import Button from './Button';

interface MemberEditorProps {
  members: MemberAllocation[];
  onChange: (members: MemberAllocation[]) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

/**
 * MemberEditor - Component for editing payroll group members.
 * Features:
 * - Add/remove member rows
 * - Stellar address validation with checksum verification
 * - Duplicate address detection
 * - Per-row display name
 * - Inline errors wired to inputs via aria-describedby
 */
export default function MemberEditor({
  members,
  onChange,
  errors = {},
  disabled = false,
}: MemberEditorProps) {
  const baseId = useId();

  const handleAddMember = () => {
    const newMember: MemberAllocation = {
      id: `${Date.now()}`,
      address: '',
      name: '',
      basisPoints: 0,
      locked: false,
    };
    onChange([...members, newMember]);
  };

  const handleRemoveMember = (id: string) => {
    onChange(members.filter((m) => m.id !== id));
  };

  const handleMemberChange = (id: string, field: keyof MemberAllocation, value: string | number | boolean) => {
    onChange(
      members.map((m) =>
        m.id === id
          ? {
              ...m,
              [field]: value,
            }
          : m
      )
    );
  };

  const validateAddress = (address: string): string | undefined => {
    if (!address) {
      return undefined;
    }

    // Check for duplicates
    const addressCount = members.filter((m) => m.address === address).length;
    if (addressCount > 1) {
      return 'Duplicate address - each member must have a unique Stellar address';
    }

    // Validate Stellar address with checksum
    if (!isValidStellarAddress(address)) {
      return 'Invalid Stellar address - must be a valid Ed25519 public key';
    }

    return undefined;
  };

  const validateName = (name: string): string | undefined => {
    if (!name || name.trim() === '') {
      return 'Display name is required';
    }
    return undefined;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Members</h3>
        <Button
          type="button"
          variant="secondary"
          onClick={handleAddMember}
          disabled={disabled}
          aria-label="Add new member"
        >
          + Add Member
        </Button>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No members added yet. Click "Add Member" to begin.</p>
      ) : (
        <div className="space-y-3">
          {members.map((member, index) => {
            const memberId = `${baseId}-member-${member.id}`;
            const addressErrorId = `${memberId}-address-error`;
            const nameErrorId = `${memberId}-name-error`;
            const addressError = validateAddress(member.address);
            const nameError = validateName(member.name);
            const hasError = addressError || nameError || errors[member.id];

            return (
              <div
                key={member.id}
                className={`rounded-lg border p-4 ${hasError ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                  {/* Display Name */}
                  <div className="md:col-span-3">
                    <Input
                      id={`${memberId}-name`}
                      label="Display Name"
                      value={member.name}
                      onChange={(e) => handleMemberChange(member.id, 'name', e.target.value)}
                      error={nameError}
                      helpText="Human-readable name for this member"
                      disabled={disabled}
                      aria-describedby={nameError ? nameErrorId : undefined}
                    />
                  </div>

                  {/* Stellar Address */}
                  <div className="md:col-span-5">
                    <Input
                      id={`${memberId}-address`}
                      label="Stellar Address"
                      value={member.address}
                      onChange={(e) => handleMemberChange(member.id, 'address', e.target.value)}
                      error={addressError}
                      helpText="Ed25519 public key (G...)"
                      disabled={disabled}
                      aria-describedby={addressError ? addressErrorId : undefined}
                    />
                  </div>

                  {/* Basis Points (read-only in editor, managed by allocator) */}
                  <div className="md:col-span-2">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`${memberId}-basis-points`}
                        className="text-sm font-medium text-gray-700"
                      >
                        Allocation
                      </label>
                      <input
                        id={`${memberId}-basis-points`}
                        type="text"
                        value={`${member.basisPoints} bp`}
                        disabled
                        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-600"
                        aria-label={`Allocation for ${member.name || 'member'}`}
                      />
                    </div>
                  </div>

                  {/* Remove Button */}
                  <div className="flex items-end md:col-span-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={disabled || members.length === 1}
                      className="w-full"
                      aria-label={`Remove ${member.name || 'member'} from group`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                {/* General error for this member row */}
                {errors[member.id] && (
                  <p id={`${memberId}-error`} className="mt-2 text-sm text-red-600" role="alert">
                    {errors[member.id]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary of validation state */}
      {members.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">{members.length}</span> member{members.length !== 1 ? 's' : ''} added
          </p>
        </div>
      )}
    </div>
  );
}
