import React from 'react';

type SkeletonShape = 'line' | 'box' | 'circle';

interface SkeletonProps {
  /** Shape of the skeleton placeholder */
  shape?: SkeletonShape;
  /** Width of the skeleton (Tailwind class or CSS value) */
  width?: string;
  /** Height of the skeleton (Tailwind class or CSS value) */
  height?: string;
  /** Additional CSS classes applied to the skeleton */
  className?: string;
}

/**
 * LoadingSkeleton — a placeholder UI component that mimics the shape of content
 * while data is being fetched. Supports line, box, and circle shapes with a
 * smooth shimmer animation.
 *
 * Compose multiple skeletons to build full layout placeholders:
 * ```tsx
 * <LoadingSkeleton shape="box" width="100%" height={200} />
 * <LoadingSkeleton shape="line" width="75%" height={16} className="mt-4" />
 * <LoadingSkeleton shape="line" width="50%" height={16} className="mt-2" />
 * ```
 */
export default function LoadingSkeleton({
  shape = 'line',
  width = '100%',
  height,
  className = '',
}: SkeletonProps) {
  const shapeStyles: Record<SkeletonShape, string> = {
    line: 'rounded',
    box: 'rounded-lg',
    circle: 'rounded-full',
  };

  const defaultHeights: Record<SkeletonShape, string> = {
    line: '4',
    box: '32',
    circle: '12',
  };

  const resolvedHeight = height ?? `h-${defaultHeights[shape]}`;

  const isTailwindHeight = /^(h-\d+|h-\[)/.test(resolvedHeight);
  const heightClass = isTailwindHeight ? resolvedHeight : '';
  const heightStyle = !isTailwindHeight ? { height: resolvedHeight } : undefined;

  const isTailwindWidth = /^(w-\d+|w-\[)/.test(width);
  const widthClass = isTailwindWidth ? width : '';
  const widthStyle = !isTailwindWidth ? { width: width } : undefined;

  return (
    <div
      className={`skeleton-shimmer ${shapeStyles[shape]} ${widthClass} ${heightClass} ${className}`}
      style={{ ...widthStyle, ...heightStyle }}
      role="status"
      aria-label="Loading"
    />
  );
}
