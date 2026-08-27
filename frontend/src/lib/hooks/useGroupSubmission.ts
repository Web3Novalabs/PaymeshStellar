import { useState, useCallback, useRef } from 'react';

export type SubmissionStage =
  'idle' | 'simulating' | 'awaiting_signature' | 'submitting' | 'confirming' | 'success' | 'error';

export interface SubmissionState {
  stage: SubmissionStage;
  error: string | null;
  transactionId: string | null;
  canRetry: boolean;
}

export interface UseGroupSubmissionOptions {
  onSubmit: () => Promise<string>;
  onSuccess?: (transactionId: string) => void;
  onError?: (error: string) => void;
}

/**
 * Hook for managing group submission flow with progress stages and retry logic.
 * Stages: simulating → awaiting signature → submitting → confirming
 * Prevents double-submission of already-signed transactions.
 */
export function useGroupSubmission({ onSubmit, onSuccess, onError }: UseGroupSubmissionOptions) {
  const [state, setState] = useState<SubmissionState>({
    stage: 'idle',
    error: null,
    transactionId: null,
    canRetry: true,
  });

  const hasSigned = useRef(false);
  const hasSubmitted = useRef(false);

  const reset = useCallback(() => {
    setState({
      stage: 'idle',
      error: null,
      transactionId: null,
      canRetry: true,
    });
    hasSigned.current = false;
    hasSubmitted.current = false;
  }, []);

  const submit = useCallback(async () => {
    // Prevent double-submission
    if (hasSubmitted.current) {
      setState((prev) => ({
        ...prev,
        stage: 'error',
        error: 'Transaction has already been submitted. Cannot resubmit.',
        canRetry: false,
      }));
      return;
    }

    setState((prev) => ({ ...prev, stage: 'simulating', error: null }));

    try {
      // Stage 1: Simulate transaction
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setState((prev) => ({ ...prev, stage: 'awaiting_signature' }));

      // Stage 2: Await signature (this would involve wallet interaction)
      if (!hasSigned.current) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        hasSigned.current = true;
      }

      setState((prev) => ({ ...prev, stage: 'submitting' }));

      // Stage 3: Submit to blockchain
      const transactionId = await onSubmit();
      hasSubmitted.current = true;

      setState((prev) => ({ ...prev, stage: 'confirming', transactionId }));

      // Stage 4: Confirm transaction
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setState((prev) => ({ ...prev, stage: 'success' }));
      onSuccess?.(transactionId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Submission failed';
      setState((prev) => ({
        ...prev,
        stage: 'error',
        error: errorMessage,
        canRetry: !hasSubmitted.current, // Can retry if we haven't successfully submitted yet
      }));
      onError?.(errorMessage);
    }
  }, [onSubmit, onSuccess, onError]);

  const retry = useCallback(() => {
    if (!state.canRetry) return;

    // Reset to idle state but preserve signed state if we had it
    setState((prev) => ({
      ...prev,
      stage: 'idle',
      error: null,
      canRetry: true,
    }));

    // If we already signed, skip straight to submitting
    if (hasSigned.current) {
      setState((prev) => ({ ...prev, stage: 'submitting' }));
      submit();
    } else {
      submit();
    }
  }, [state.canRetry, submit]);

  return {
    state,
    submit,
    retry,
    reset,
    isSubmitting: state.stage !== 'idle' && state.stage !== 'success' && state.stage !== 'error',
  };
}
