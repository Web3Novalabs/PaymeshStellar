'use client';

import { useWallet } from '@/contexts/WalletContext';
import Link from 'next/link';

export default function DashboardPage() {
  const { status, address, network } = useWallet();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <nav className="mb-6 flex flex-wrap gap-4 text-sm font-medium text-gray-600 dark:text-gray-400">
          <Link href="/dashboard" className="text-blue-600 hover:underline dark:text-blue-400">
            Dashboard
          </Link>
          <Link href="/groups" className="transition hover:text-gray-900 dark:hover:text-gray-50">
            Groups
          </Link>
          <Link href="/settings" className="transition hover:text-gray-900 dark:hover:text-gray-50">
            Settings
          </Link>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Review your current payroll activity and navigate to the main workspace sections.
        </p>
      </div>

      {status.status === 'connected' && address && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Wallet Info</h2>
          <dl className="mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Address:</dt>
              <dd className="font-mono text-sm text-gray-900 dark:text-gray-100">{address}</dd>
            </div>
            <div className="flex items-center gap-3">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Network:</dt>
              <dd>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  {network}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      )}

      {status.status !== 'connected' && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Connect your Stellar wallet to get started.
          </p>
        </div>
      )}
    </div>
  );
}
