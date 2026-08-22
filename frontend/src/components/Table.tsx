import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Column definition for the Table component */
export interface Column<T extends Record<string, unknown>> {
  /** Unique key, should match the data object's property or a custom key when render is provided */
  key: keyof T | string;
  /** Column header label */
  label: string;
  /** Text alignment for the column. Defaults to 'left' */
  align?: 'left' | 'right' | 'center';
  /** Optional width (Tailwind class like `w-24` or `min-w-[200px]`) */
  width?: string;
  /** Custom render function for the cell. Receives the cell value, the full row, and the row index */
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
  /** Additional CSS class applied to the header cell `<th>` */
  headerClassName?: string;
  /** Additional CSS class applied to the data cell `<td>` */
  cellClassName?: string;
}

export interface TableProps<T extends Record<string, unknown>> {
  /** Column definitions */
  columns: Column<T>[];
  /** Data rows to display */
  data: T[];
  /** Unique key for each row. Accepts a keyof T or a function `(row, index) => string` */
  rowKey: keyof T | ((row: T, index: number) => string);
  /** Optional accessible caption rendered as a `<caption>` element */
  caption?: string;
  /** Custom content shown when data is empty */
  emptyState?: React.ReactNode;
  /** Additional CSS class applied to the outer wrapper */
  className?: string;
  /** When true, alternating rows get a subtle background tint */
  striped?: boolean;
  /** When true, rows show a hover highlight */
  hoverable?: boolean;
}

// ---------------------------------------------------------------------------
// Alignment helpers
// ---------------------------------------------------------------------------

const ALIGN_CLASSES: Record<string, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Table — a reusable component for displaying structured data like group
 * members, percentages, and other list-based information.
 *
 * Supports custom column definitions, alignment, striped rows, hover effects,
 * and an empty state for when data is unavailable.
 *
 * ```tsx
 * <Table
 *   columns={[
 *     { key: 'name', label: 'Name' },
 *     { key: 'percentage', label: '%', align: 'right' },
 *   ]}
 *   data={members}
 *   rowKey="id"
 *   striped
 *   hoverable
 * />
 * ```
 */
export default function Table<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  caption,
  emptyState,
  className = '',
  striped = false,
  hoverable = false,
}: TableProps<T>) {
  function resolveRowKey(row: T, index: number): string {
    if (typeof rowKey === 'function') {
      return rowKey(row, index);
    }
    const value = row[rowKey as keyof T];
    return String(value ?? index);
  }

  return (
    <div
      className={`overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 ${className}`}
    >
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        {caption && <caption className="sr-only">{caption}</caption>}

        {/* Header */}
        <thead className="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            {columns.map((col) => {
              const alignClass = ALIGN_CLASSES[col.align ?? 'left'];
              return (
                <th
                  key={String(col.key)}
                  scope="col"
                  className={`${alignClass} px-6 py-3 text-sm font-semibold text-gray-600 dark:text-gray-400 ${col.width ?? ''} ${col.headerClassName ?? ''}`}
                  style={col.width && /^[0-9]/.test(col.width) ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Body */}
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-6 py-12 text-center text-sm text-gray-400 dark:text-gray-500"
              >
                {emptyState ?? 'No data available.'}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => {
              const id = resolveRowKey(row, rowIndex);
              const isOdd = rowIndex % 2 === 1;

              return (
                <tr
                  key={id}
                  className={[
                    'transition',
                    striped && isOdd ? 'bg-gray-50/60 dark:bg-gray-800/30' : '',
                    hoverable ? 'hover:bg-blue-50/40 dark:hover:bg-blue-900/20' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {columns.map((col) => {
                    const value = row[col.key as keyof T];
                    const alignClass = ALIGN_CLASSES[col.align ?? 'left'];

                    return (
                      <td
                        key={String(col.key)}
                        className={`${alignClass} px-6 py-4 text-sm text-gray-700 dark:text-gray-300 ${col.cellClassName ?? ''}`}
                      >
                        {col.render ? col.render(value, row, rowIndex) : String(value ?? '')}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
