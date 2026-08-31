'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import GroupWizard, { WizardState } from '@/components/GroupWizard';

export default function EditGroupPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialState, setInitialState] = useState<Partial<WizardState> | null>(null);

  useEffect(() => {
    // Load existing group data
    async function loadGroup() {
      try {
        // TODO: Replace with actual API call
        // const response = await fetch(`/api/groups/${groupId}`);
        // if (!response.ok) throw new Error('Failed to load group');
        // const group = await response.json();

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Mock data - replace with actual group data
        const mockGroup = {
          id: groupId,
          name: 'Engineering Team',
          paymentToken: 'GBBN4VTHNQYJ6Q7B7CM7GHR3ZEECQJ2KNE7U5FAWHK2D5XQYM5WKW4TV',
          usageCount: 5,
          members: [
            {
              id: '1',
              address: 'GD5J6PHFVCHGE5H4ZL3FWJQSIHZO3SKN6QSE5YD3T3Y5R7E8N9X0Y1Z2',
              name: 'Alice',
              basisPoints: 3333,
              locked: false,
            },
            {
              id: '2',
              address: 'GABCD4EF5GH6IJ7KL8MN9OP0QR1ST2UV3WX4YZ5AB6CD7EF8GH9IJ0KL',
              name: 'Bob',
              basisPoints: 3333,
              locked: false,
            },
            {
              id: '3',
              address: 'G1234ABCD5678EFGH9012IJKL3456MNOP7890QRST1234UVWX5678YZ90',
              name: 'Charlie',
              basisPoints: 3334,
              locked: false,
            },
          ],
        };

        setInitialState({
          step: 'details',
          details: {
            name: mockGroup.name,
            paymentToken: mockGroup.paymentToken,
            usageCount: mockGroup.usageCount,
          },
          members: mockGroup.members,
          isEditMode: true,
          groupId,
        });
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Failed to load group');
      } finally {
        setIsLoading(false);
      }
    }

    loadGroup();
  }, [groupId]);

  // Guard against navigating away with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleSubmit = async (state: WizardState) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/groups/${groupId}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ members: membersDiff }),
      // });
      // if (!response.ok) throw new Error('Failed to update group');

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setHasUnsavedChanges(false);
      router.push(`/groups/${groupId}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to update group');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-gray-600">Loading group...</p>
        </div>
      </div>
    );
  }

  if (!initialState) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-lg border border-red-300 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-800">Failed to load group</h2>
          <p className="mt-2 text-sm text-red-600">{submitError || 'Group not found'}</p>
          <button
            onClick={() => router.push('/groups')}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Back to Groups
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <nav className="mb-6 flex gap-4 text-sm font-medium text-gray-600">
        <a href="/dashboard" className="transition hover:text-gray-900">
          Dashboard
        </a>
        <a href="/groups" className="transition hover:text-gray-900">
          Groups
        </a>
        <span className="text-blue-600">Edit Group</span>
      </nav>

      {hasUnsavedChanges && (
        <div
          className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm text-yellow-800">
            <strong>Unsaved changes:</strong> You have unsaved changes. Don&apos;t forget to save
            before leaving.
          </p>
        </div>
      )}

      {submitError && (
        <div
          className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-sm text-red-800">
            <strong>Error:</strong> {submitError}
          </p>
        </div>
      )}

      <Suspense fallback={<div>Loading wizard...</div>}>
        <GroupWizard
          initialState={initialState}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </Suspense>
    </div>
  );
}
