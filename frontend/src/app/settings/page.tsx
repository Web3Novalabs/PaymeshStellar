'use client';

import Link from 'next/link';
import { useWallet } from '@/contexts/WalletContext';

export default function SettingsPage() {
  const { status, network } = useWallet();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <nav className="mb-6 flex flex-wrap gap-4 text-sm font-medium text-gray-600 dark:text-gray-400">
          <Link
            href="/dashboard"
            className="transition hover:text-gray-900 dark:hover:text-gray-50"
          >
            Dashboard
          </Link>
          <Link href="/groups" className="transition hover:text-gray-900 dark:hover:text-gray-50">
            Groups
          </Link>
          <Link href="/settings" className="text-blue-600 hover:underline dark:text-blue-400">
            Settings
          </Link>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Settings</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Configure user preferences and account-related options for the workspace.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Session</h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {status.status === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {status.status === 'connected' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Network</span>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  {network}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Auth Method</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  SEP-10 / Stellar Wallet
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
