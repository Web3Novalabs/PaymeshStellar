'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import GroupWizard, { WizardState } from '@/components/GroupWizard';
import MemberEditor from '@/components/MemberEditor';
import Allocator from '@/components/Allocator';
import SharePreview from '@/components/SharePreview';
import { validateAllocation, MemberAllocation } from '@/lib/utils/allocation';

export default function NewGroupPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (state: WizardState) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Prepare the data for submission
      const groupData = {
        name: state.details.name,
        paymentToken: state.details.paymentToken,
        usageCount: state.details.usageCount,
        members: state.members.map((m) => ({
          address: m.address,
          name: m.name,
          percentage: m.basisPoints,
        })),
      };

      // TODO: Replace with actual API call
      // const response = await fetch('/api/groups', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(groupData),
      // });
      // if (!response.ok) throw new Error('Failed to create group');

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Redirect to groups list on success
      router.push('/groups');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create group');
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <nav className="mb-6 flex gap-4 text-sm font-medium text-gray-600">
        <a href="/dashboard" className="transition hover:text-gray-900">
          Dashboard
        </a>
        <a href="/groups" className="transition hover:text-gray-900">
          Groups
        </a>
        <span className="text-blue-600">Create New Group</span>
      </nav>

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

      <GroupWizard onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}
