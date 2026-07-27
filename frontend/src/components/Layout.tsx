import Link from 'next/link';
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
}

/**
 * Layout — a reusable page shell with a responsive navbar, main content area,
 * and optional sidebar for supporting content.
 */
export default function Layout({ children, sidebar, className = '' }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-50">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Paymesh
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium text-gray-600 dark:text-gray-300">
            <Link href="/groups" className="transition hover:text-gray-900 dark:hover:text-gray-50">
              Groups
            </Link>
            <Link href="/" className="transition hover:text-gray-900 dark:hover:text-gray-50">
              Home
            </Link>
          </nav>
        </div>
      </header>

      <main
        className={`mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8 lg:py-8 ${className}`}
      >
        <section className={`flex-1 ${sidebar ? 'lg:pr-4' : ''}`}>{children}</section>
        {sidebar !== undefined && (
          <aside className="w-full lg:w-80 lg:flex-none">{sidebar}</aside>
        )}
      </main>

      <footer className="border-t border-gray-200 bg-white/80 dark:border-gray-800 dark:bg-gray-950/80">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-gray-600 sm:px-6 lg:px-8 dark:text-gray-400">
          © 2026 Paymesh. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
