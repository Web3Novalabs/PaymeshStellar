import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <nav className="mb-6 flex flex-wrap gap-4 text-sm font-medium text-gray-600">
          <Link href="/dashboard" className="transition hover:text-gray-900">
            Dashboard
          </Link>
          <Link href="/groups" className="transition hover:text-gray-900">
            Groups
          </Link>
          <Link href="/settings" className="text-blue-600 hover:underline">
            Settings
          </Link>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-sm text-gray-500">
          Configure user preferences and account-related options for the workspace.
        </p>
      </div>
    </div>
  );
}
