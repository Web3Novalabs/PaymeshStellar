'use client';

import { useState } from 'react';
import Button from '@/components/Button';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{title}</h2>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        {children}
      </div>
    </section>
  );
}

export default function ComponentsDemoPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSimulateLoading() {
    setIsSubmitting(true);
    setTimeout(() => setIsSubmitting(false), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 dark:bg-black sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            Button Component Demo
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            All variants and states supported by{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800">
              src/components/Button.tsx
            </code>
            .
          </p>
        </div>

        <Section title="Variants">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
        </Section>

        <Section title="Loading state">
          <Button variant="primary" isLoading>
            Primary
          </Button>
          <Button variant="secondary" isLoading>
            Secondary
          </Button>
        </Section>

        <Section title="Disabled">
          <Button variant="primary" disabled>
            Primary
          </Button>
          <Button variant="secondary" disabled>
            Secondary
          </Button>
        </Section>

        <Section title="Interactive example">
          <Button variant="primary" isLoading={isSubmitting} onClick={handleSimulateLoading}>
            {isSubmitting ? 'Submitting' : 'Submit'}
          </Button>
        </Section>

        <Section title="Standard HTML attributes">
          <Button type="submit">type=&quot;submit&quot;</Button>
          <Button type="button" onClick={() => alert('Clicked!')}>
            onClick
          </Button>
        </Section>
      </div>
    </div>
  );
}
