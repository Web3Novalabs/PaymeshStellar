'use client';
import ErrorFallback from '@/components/errors/ErrorFallback';
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} scope="root" />;
}
