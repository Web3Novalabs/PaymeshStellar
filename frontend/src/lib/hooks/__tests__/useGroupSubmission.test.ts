import { renderHook, act } from '@testing-library/react';
import { useGroupSubmission, SubmissionStage } from '../useGroupSubmission';

describe('useGroupSubmission', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initial state', () => {
    it('should start in idle state', () => {
      const mockSubmit = jest.fn().mockResolvedValue('tx123');
      const { result } = renderHook(() => useGroupSubmission({ onSubmit: mockSubmit }));
      
      expect(result.current.state.stage).toBe('idle');
      expect(result.current.state.error).toBeNull();
      expect(result.current.state.transactionId).toBeNull();
      expect(result.current.state.canRetry).toBe(true);
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  describe('successful submission flow', () => {
    it('should progress through all stages on success', async () => {
      const mockSubmit = jest.fn().mockResolvedValue('tx123');
      const mockSuccess = jest.fn();
      const { result } = renderHook(() => 
        useGroupSubmission({ onSubmit: mockSubmit, onSuccess: mockSuccess })
      );
      
      act(() => {
        result.current.submit();
      });
      
      // Stage 1: simulating
      expect(result.current.state.stage).toBe('simulating');
      
      // Advance past simulation delay
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      // Stage 2: awaiting_signature
      expect(result.current.state.stage).toBe('awaiting_signature');
      
      // Advance past signature delay
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      // Stage 3: submitting
      expect(result.current.state.stage).toBe('submitting');
      
      // Wait for onSubmit to resolve
      await act(async () => {
        await Promise.resolve();
      });
      
      // Stage 4: confirming
      expect(result.current.state.stage).toBe('confirming');
      expect(result.current.state.transactionId).toBe('tx123');
      
      // Advance past confirmation delay
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      
      // Stage 5: success
      expect(result.current.state.stage).toBe('success');
      expect(mockSuccess).toHaveBeenCalledWith('tx123');
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  describe('failure at simulating stage', () => {
    it('should handle failure during simulation', async () => {
      const mockSubmit = jest.fn().mockRejectedValue(new Error('Simulation failed'));
      const mockError = jest.fn();
      const { result } = renderHook(() => 
        useGroupSubmission({ onSubmit: mockSubmit, onError: mockError })
      );
      
      // Mock the simulation to fail
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((cb, delay) => {
        if (delay === 1000) {
          // Fail during simulation
          throw new Error('Simulation failed');
        }
        return originalSetTimeout(cb, delay);
      }) as any;
      
      act(() => {
        result.current.submit();
      });
      
      // Should be in error state
      expect(result.current.state.stage).toBe('error');
      expect(result.current.state.error).toBe('Simulation failed');
      expect(result.current.state.canRetry).toBe(true);
      expect(mockError).toHaveBeenCalledWith('Simulation failed');
      
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('failure at awaiting_signature stage', () => {
    it('should handle failure during signature', async () => {
      const mockSubmit = jest.fn().mockResolvedValue('tx123');
      const { result } = renderHook(() => 
        useGroupSubmission({ onSubmit: mockSubmit })
      );
      
      act(() => {
        result.current.submit();
      });
      
      // Advance to signature stage
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(result.current.state.stage).toBe('awaiting_signature');
      
      // Mock signature failure
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((cb, delay) => {
        if (delay === 2000) {
          throw new Error('Signature rejected');
        }
        return originalSetTimeout(cb, delay);
      }) as any;
      
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      expect(result.current.state.stage).toBe('error');
      expect(result.current.state.error).toBe('Signature rejected');
      expect(result.current.state.canRetry).toBe(true); // Can retry since not submitted
      
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('failure at submitting stage', () => {
    it('should handle failure during submit', async () => {
      const mockSubmit = jest.fn().mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => 
        useGroupSubmission({ onSubmit: mockSubmit })
      );
      
      act(() => {
        result.current.submit();
      });
      
      // Advance to submitting stage
      act(() => {
        jest.advanceTimersByTime(3000); // Past simulation and signature
      });
      
      expect(result.current.state.stage).toBe('submitting');
      
      // Wait for the rejected promise
      await act(async () => {
        await Promise.resolve();
      });
      
      expect(result.current.state.stage).toBe('error');
      expect(result.current.state.error).toBe('Network error');
      expect(result.current.state.canRetry).toBe(true); // Can retry since not submitted yet
    });
  });

  describe('failure at confirming stage', () => {
    it('should handle failure during confirmation', async () => {
      const mockSubmit = jest.fn().mockResolvedValue('tx123');
      const { result } = renderHook(() => 
        useGroupSubmission({ onSubmit: mockSubmit })
      );
      
      act(() => {
        result.current.submit();
      });
      
      // Advance to submitting stage
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      
      // Wait for submit to complete
      await act(async () => {
        await Promise.resolve();
      });
      
      expect(result.current.state.stage).toBe('confirming');
      expect(result.current.state.transactionId).toBe('tx123');
      
      // Mock confirmation failure
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((cb, delay) => {
        if (delay === 1500) {
          throw new Error('Confirmation timeout');
        }
        return originalSetTimeout(cb, delay);
      }) as any;
      
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      
      expect(result.current.state.stage).toBe('error');
      expect(result.current.state.error).toBe('Confirmation timeout');
      expect(result.current.state.canRetry).toBe(false); // Cannot retry since already submitted
      
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('retry logic', () => {
    it('should allow retry after failure before submission', async () => {
      const mockSubmit = jest.fn().mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => 
        useGroupSubmission({ onSubmit: mockSubmit })
      );
      
      act(() => {
        result.current.submit();
      });
      
      // Advance to submitting stage
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      
      await act(async () => {
        await Promise.resolve();
      });
      
      expect(result.current.state.stage).toBe('error');
      expect(result.current.state.canRetry).toBe(true);
      
      // Retry
      act(() => {
        result.current.retry();
      });
      
      expect(result.current.state.stage).toBe('idle');
      expect(result.current.state.error).toBeNull();
    });

    it('should not allow retry after successful submission', async () => {
      const mockSubmit = jest.fn().mockResolvedValue('tx123');
      const { result } = renderHook(() => 
        useGroupSubmission({ onSubmit: mockSubmit })
      );
      
      act(() => {
        result.current.submit();
      });
      
      // Advance through all stages
      act(() => {
        jest.advanceTimersByTime(5500);
      });
      
      await act(async () => {
        await Promise.resolve();
      });
      
      expect(result.current.state.stage).toBe('success');
      expect(result.current.state.canRetry).toBe(true);
      
      // Try to retry after success
      act(() => {
        result.current.retry();
      });
      
      // Should reset to idle
      expect(result.current.state.stage).toBe('idle');
    });

    it('should prevent double-submission after successful submit', async () => {
      const mockSubmit = jest.fn().mockResolvedValue('tx123');
      const { result } = renderHook(() => 
        useGroupSubmission({ onSubmit: mockSubmit })
      );
      
      act(() => {
        result.current.submit();
      });
      
      // Advance to success
      act(() => {
        jest.advanceTimersByTime(5500);
      });
      
      await act(async () => {
        await Promise.resolve();
      });
      
      expect(mockSubmit).toHaveBeenCalledTimes(1);
      
      // Try to submit again
      act(() => {
        result.current.submit();
      });
      
      expect(result.current.state.stage).toBe('error');
      expect(result.current.state.error).toBe('Transaction has already been submitted. Cannot resubmit.');
      expect(result.current.state.canRetry).toBe(false);
      expect(mockSubmit).toHaveBeenCalledTimes(1); // Still only called once
    });
  });

  describe('reset', () => {
    it('should reset state to initial', async () => {
      const mockSubmit = jest.fn().mockRejectedValue(new Error('Test error'));
      const { result } = renderHook(() => 
        useGroupSubmission({ onSubmit: mockSubmit })
      );
      
      act(() => {
        result.current.submit();
      });
      
      // Advance to error
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      
      await act(async () => {
        await Promise.resolve();
      });
      
      expect(result.current.state.stage).toBe('error');
      
      // Reset
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.state.stage).toBe('idle');
      expect(result.current.state.error).toBeNull();
      expect(result.current.state.transactionId).toBeNull();
      expect(result.current.state.canRetry).toBe(true);
    });
  });

  describe('isSubmitting flag', () => {
    it('should be true during active stages', () => {
      const mockSubmit = jest.fn().mockResolvedValue('tx123');
      const { result } = renderHook(() => 
        useGroupSubmission({ onSubmit: mockSubmit })
      );
      
      expect(result.current.isSubmitting).toBe(false);
      
      act(() => {
        result.current.submit();
      });
      
      expect(result.current.isSubmitting).toBe(true);
    });

    it('should be false in idle, success, and error states', async () => {
      const mockSubmit = jest.fn().mockRejectedValue(new Error('Test error'));
      const { result } = renderHook(() => 
        useGroupSubmission({ onSubmit: mockSubmit })
      );
      
      act(() => {
        result.current.submit();
      });
      
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      
      await act(async () => {
        await Promise.resolve();
      });
      
      expect(result.current.state.stage).toBe('error');
      expect(result.current.isSubmitting).toBe(false);
    });
  });
});
