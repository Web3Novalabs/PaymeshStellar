import React from 'react';

interface CardProps {
  /** Main content rendered inside the card body */
  children: React.ReactNode;
  /** Optional title displayed in the card header */
  title?: string;
  /** Optional description displayed below the title in the card header */
  description?: string;
  /** Optional custom header content. When provided, overrides title/description rendering */
  header?: React.ReactNode;
  /** Optional footer content rendered at the bottom of the card */
  footer?: React.ReactNode;
  /** Additional CSS classes applied to the card wrapper */
  className?: string;
}

/**
 * Card — a reusable container component for displaying payroll groups,
 * member information, and other key data blocks in a consistent layout.
 *
 * Supports optional title/description, a custom header slot, and a footer slot.
 */
export default function Card({
  children,
  title,
  description,
  header,
  footer,
  className = '',
}: CardProps) {
  const hasHeader = header !== undefined || title !== undefined || description !== undefined;

  return (
    <div
      className={`flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 ${className}`}
    >
      {/* Header section */}
      {hasHeader && (
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          {header !== undefined ? (
            header
          ) : (
            <>
              {title && (
                <h3 className="text-lg font-semibold leading-tight text-gray-900 dark:text-gray-50">
                  {title}
                </h3>
              )}
              {description && (
                <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  {description}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 px-6 py-4">{children}</div>

      {/* Footer section */}
      {footer !== undefined && (
        <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">{footer}</div>
      )}
    </div>
  );
}
