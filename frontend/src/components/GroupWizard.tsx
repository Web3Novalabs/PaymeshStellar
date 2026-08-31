'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MemberAllocation, validateAllocation } from '@/lib/utils/allocation';
import Button from './Button';
import MemberEditor from './MemberEditor';
import Allocator from './Allocator';
import SharePreview from './SharePreview';

export type WizardStep = 'details' | 'members' | 'review';

export interface GroupDetails {
  name: string;
  paymentToken: string;
  usageCount: number;
}

export interface WizardState {
  step: WizardStep;
  details: GroupDetails;
  members: MemberAllocation[];
  isEditMode: boolean;
  groupId?: string;
}

interface GroupWizardProps {
  initialState?: Partial<WizardState>;
  onSubmit: (state: WizardState) => Promise<void>;
  isSubmitting?: boolean;
}

const STEP_ORDER: WizardStep[] = ['details', 'members', 'review'];
const STORAGE_KEY = 'group-wizard-state';

/**
 * GroupWizard - Multi-step wizard for creating/editing payroll groups.
 * Features:
 * - 3 steps: details, members, review and sign
 * - State survives back/forward navigation and full page reload (URL state + sessionStorage)
 * - Browser back button moves between steps instead of dumping user out
 */
export default function GroupWizard({
  initialState,
  onSubmit,
  isSubmitting = false,
}: GroupWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<WizardState>(() => {
    // Try to restore from sessionStorage first
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Merge with URL params and initial state
          return deepMerge(parsed, initialState || {}, parseURLState(searchParams));
        } catch {
          // Fall through to initial state
        }
      }
    }

    return {
      step: 'details',
      details: {
        name: '',
        paymentToken: '',
        usageCount: 1,
      },
      members: [],
      isEditMode: false,
      ...initialState,
      ...parseURLState(searchParams),
    };
  });

  // Persist state to sessionStorage and URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    // Update URL without triggering navigation
    const url = new URL(window.location.href);
    url.searchParams.set('step', state.step);
    if (state.details.name) url.searchParams.set('name', state.details.name);
    if (state.details.paymentToken) url.searchParams.set('token', state.details.paymentToken);
    if (state.details.usageCount)
      url.searchParams.set('usage', state.details.usageCount.toString());
    url.searchParams.set('members', state.members.length.toString());

    window.history.replaceState({}, '', url.toString());
  }, [state]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state) {
        const currentStepIndex = STEP_ORDER.indexOf(state.step);
        if (currentStepIndex > 0) {
          setState((prev) => ({ ...prev, step: STEP_ORDER[currentStepIndex - 1] }));
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [state.step]);

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const goToStep = useCallback((step: WizardStep) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  const goToNextStep = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(state.step);
    if (currentIndex < STEP_ORDER.length - 1) {
      const nextStep = STEP_ORDER[currentIndex + 1];
      setState((prev) => ({ ...prev, step: nextStep }));
      // Push history state for back button support
      window.history.pushState({ step: nextStep }, '', `?step=${nextStep}`);
    }
  }, [state.step]);

  const goToPreviousStep = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(state.step);
    if (currentIndex > 0) {
      const prevStep = STEP_ORDER[currentIndex - 1];
      setState((prev) => ({ ...prev, step: prevStep }));
      window.history.back();
    }
  }, [state.step]);

  const handleSubmit = useCallback(async () => {
    try {
      await onSubmit(state);
      // Clear storage after successful submission
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      // Error handling is managed by the parent component
      console.error('Submission failed:', error);
    }
  }, [state, onSubmit]);

  const canProceedToNext = useCallback(() => {
    switch (state.step) {
      case 'details':
        return (
          state.details.name.trim() !== '' &&
          state.details.paymentToken.trim() !== '' &&
          state.details.usageCount > 0
        );
      case 'members':
        return (
          state.members.length > 0 &&
          state.members.every((m) => m.name.trim() !== '' && m.address.trim() !== '') &&
          validateAllocation(state.members)
        );
      case 'review':
        return true;
      default:
        return false;
    }
  }, [state]);

  const currentStepIndex = STEP_ORDER.indexOf(state.step);
  const isLastStep = currentStepIndex === STEP_ORDER.length - 1;
  const isFirstStep = currentStepIndex === 0;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      {/* Progress indicator */}
      <nav aria-label="Wizard progress" className="mb-8">
        <ol className="flex items-center justify-between">
          {STEP_ORDER.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isAccessible = index <= currentStepIndex;

            return (
              <li key={step} className="flex items-center">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => isAccessible && goToStep(step)}
                    disabled={!isAccessible || isSubmitting}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-medium transition ${
                      isCompleted
                        ? 'border-green-500 bg-green-500 text-white'
                        : isCurrent
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-gray-300 bg-white text-gray-500'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-label={`Go to ${step} step`}
                  >
                    {isCompleted ? (
                      <svg
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </button>
                  <span
                    className={`ml-3 hidden text-sm font-medium sm:block ${
                      isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    {step.charAt(0).toUpperCase() + step.slice(1)}
                  </span>
                </div>
                {index < STEP_ORDER.length - 1 && (
                  <div className="ml-4 h-0.5 w-16 bg-gray-300 sm:ml-8 sm:w-24" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step content */}
      <div className="mx-auto max-w-4xl">
        {state.step === 'details' && (
          <DetailsStep details={state.details} onChange={(details) => updateState({ details })} />
        )}
        {state.step === 'members' && (
          <MembersStep
            members={state.members}
            onChange={(members) => updateState({ members })}
            disabled={isSubmitting}
          />
        )}
        {state.step === 'review' && (
          <ReviewStep
            details={state.details}
            members={state.members}
            isEditMode={state.isEditMode}
          />
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex justify-between">
          <div>
            {!isFirstStep && (
              <Button
                type="button"
                variant="secondary"
                onClick={goToPreviousStep}
                disabled={isSubmitting}
                aria-label="Go to previous step"
              >
                ← Back
              </Button>
            )}
          </div>
          <div>
            {!isLastStep ? (
              <Button
                type="button"
                variant="primary"
                onClick={goToNextStep}
                disabled={!canProceedToNext() || isSubmitting}
                aria-label="Go to next step"
              >
                Next →
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
                isLoading={isSubmitting}
                aria-label="Submit and sign"
              >
                {state.isEditMode ? 'Update Group' : 'Create Group'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Step components
function DetailsStep({
  details,
  onChange,
}: {
  details: GroupDetails;
  onChange: (details: GroupDetails) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">Group Details</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="group-name" className="block text-sm font-medium text-gray-700">
            Group Name
          </label>
          <input
            id="group-name"
            type="text"
            value={details.name}
            onChange={(e) => onChange({ ...details, name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="e.g., Engineering Team Payroll"
            aria-describedby="group-name-help"
          />
          <p id="group-name-help" className="mt-1 text-sm text-gray-500">
            A descriptive name for your payroll group
          </p>
        </div>

        <div>
          <label htmlFor="payment-token" className="block text-sm font-medium text-gray-700">
            Payment Token Address
          </label>
          <input
            id="payment-token"
            type="text"
            value={details.paymentToken}
            onChange={(e) => onChange({ ...details, paymentToken: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="G..."
            aria-describedby="payment-token-help"
          />
          <p id="payment-token-help" className="mt-1 text-sm text-gray-500">
            Stellar asset contract address for payments
          </p>
        </div>

        <div>
          <label htmlFor="usage-count" className="block text-sm font-medium text-gray-700">
            Usage Count
          </label>
          <input
            id="usage-count"
            type="number"
            min="1"
            value={details.usageCount}
            onChange={(e) =>
              onChange({ ...details, usageCount: parseInt(e.target.value, 10) || 1 })
            }
            className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            aria-describedby="usage-count-help"
          />
          <p id="usage-count-help" className="mt-1 text-sm text-gray-500">
            Application-defined usage metadata
          </p>
        </div>
      </div>
    </div>
  );
}

function MembersStep({
  members,
  onChange,
  disabled,
}: {
  members: MemberAllocation[];
  onChange: (members: MemberAllocation[]) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Members</h2>
        <p className="text-sm text-gray-600">
          Add members and allocate basis points. Total must equal exactly 10,000 basis points
          (100%).
        </p>
        <div className="mt-4">
          <MemberEditor members={members} onChange={onChange} disabled={disabled} />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <Allocator members={members} onChange={onChange} disabled={disabled} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <SharePreview members={members} />
      </div>
    </div>
  );
}

function ReviewStep({
  details,
  members,
  isEditMode,
}: {
  details: GroupDetails;
  members: MemberAllocation[];
  isEditMode: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">
        Review and {isEditMode ? 'Update' : 'Sign'}
      </h2>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Group Details</h3>
          <dl className="mt-2 space-y-1">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Name:</dt>
              <dd className="text-sm font-medium text-gray-900">{details.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Payment Token:</dt>
              <dd className="text-sm font-medium text-gray-900">{details.paymentToken}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Usage Count:</dt>
              <dd className="text-sm font-medium text-gray-900">{details.usageCount}</dd>
            </div>
          </dl>
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900">Members ({members.length})</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Address</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Allocation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((member) => (
                  <tr key={member.id}>
                    <td className="px-4 py-2 font-medium text-gray-900">{member.name}</td>
                    <td className="px-4 py-2 text-gray-600">{member.address}</td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {member.basisPoints} bp ({((member.basisPoints / 10000) * 100).toFixed(2)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            <strong>Ready to {isEditMode ? 'update' : 'create'}.</strong> Review the details above
            and click the button below to sign the transaction with your wallet.
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function parseURLState(searchParams: URLSearchParams): Partial<WizardState> {
  const step = searchParams.get('step') as WizardStep | null;
  const name = searchParams.get('name') || undefined;
  const token = searchParams.get('token') || undefined;
  const usage = searchParams.get('usage');
  const membersCount = searchParams.get('members');

  const result: Partial<WizardState> = {};
  if (step && STEP_ORDER.includes(step)) {
    result.step = step;
  }

  const details: Partial<GroupDetails> = {};
  if (name) details.name = name;
  if (token) details.paymentToken = token;
  if (usage) details.usageCount = parseInt(usage, 10) || 1;

  if (Object.keys(details).length > 0) {
    result.details = details as GroupDetails;
  }

  if (membersCount) {
    // Members are not stored in URL for size reasons, just the count
  }

  return result;
}

function deepMerge<T>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        deepMerge((target as any)[key], (source as any)[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

function isObject(item: unknown): item is Record<string, unknown> {
  return Boolean(item) && typeof item === 'object' && !Array.isArray(item);
}
