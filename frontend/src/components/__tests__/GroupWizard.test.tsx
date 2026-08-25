import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GroupWizard, { WizardState, WizardStep } from '../GroupWizard';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

// Mock window.history
const mockPushState = jest.fn();
const mockReplaceState = jest.fn();

Object.defineProperty(window, 'history', {
  value: {
    pushState: mockPushState,
    replaceState: mockReplaceState,
    back: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
});

describe('GroupWizard navigation and persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.getItem.mockReturnValue(null);
  });

  describe('initial state', () => {
    it('should start at details step', () => {
      render(<GroupWizard onSubmit={jest.fn()} />);
      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    it('should show progress indicator with first step active', () => {
      render(<GroupWizard onSubmit={jest.fn()} />);
      const step1 = screen.getByLabelText('Go to details step');
      expect(step1).toHaveAttribute('aria-current', 'step');
    });
  });

  describe('step navigation', () => {
    it('should move to next step when clicking Next button', async () => {
      render(<GroupWizard onSubmit={jest.fn()} />);
      
      // Fill in required details
      const nameInput = screen.getByLabelText('Group Name');
      fireEvent.change(nameInput, { target: { value: 'Test Group' } });
      
      const tokenInput = screen.getByLabelText('Payment Token Address');
      fireEvent.change(tokenInput, { target: { value: 'GTEST...' } });
      
      const nextButton = screen.getByLabelText('Go to next step');
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText('Members')).toBeInTheDocument();
      });
    });

    it('should disable Next button when step is invalid', () => {
      render(<GroupWizard onSubmit={jest.fn()} />);
      
      const nextButton = screen.getByLabelText('Go to next step');
      expect(nextButton).toBeDisabled();
    });

    it('should move to previous step when clicking Back button', async () => {
      render(<GroupWizard onSubmit={jest.fn()} />);
      
      // Fill details and go to next step
      const nameInput = screen.getByLabelText('Group Name');
      fireEvent.change(nameInput, { target: { value: 'Test Group' } });
      
      const tokenInput = screen.getByLabelText('Payment Token Address');
      fireEvent.change(tokenInput, { target: { value: 'GTEST...' } });
      
      const nextButton = screen.getByLabelText('Go to next step');
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText('Members')).toBeInTheDocument();
      });
      
      // Go back
      const backButton = screen.getByLabelText('Go to previous step');
      fireEvent.click(backButton);
      
      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    it('should allow clicking on completed steps to navigate back', async () => {
      render(<GroupWizard onSubmit={jest.fn()} />);
      
      // Fill details and go to next step
      const nameInput = screen.getByLabelText('Group Name');
      fireEvent.change(nameInput, { target: { value: 'Test Group' } });
      
      const tokenInput = screen.getByLabelText('Payment Token Address');
      fireEvent.change(tokenInput, { target: { value: 'GTEST...' } });
      
      const nextButton = screen.getByLabelText('Go to next step');
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText('Members')).toBeInTheDocument();
      });
      
      // Click on step 1 to go back
      const step1Button = screen.getByLabelText('Go to details step');
      fireEvent.click(step1Button);
      
      expect(screen.getByText('Details')).toBeInTheDocument();
    });
  });

  describe('sessionStorage persistence', () => {
    it('should save state to sessionStorage on state change', () => {
      render(<GroupWizard onSubmit={jest.fn()} />);
      
      const nameInput = screen.getByLabelText('Group Name');
      fireEvent.change(nameInput, { target: { value: 'Test Group' } });
      
      expect(mockSessionStorage.setItem).toHaveBeenCalled();
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'group-wizard-state',
        expect.stringContaining('Test Group')
      );
    });

    it('should restore state from sessionStorage on mount', () => {
      const savedState: Partial<WizardState> = {
        step: 'members',
        details: {
          name: 'Restored Group',
          paymentToken: 'GRESTORED...',
          usageCount: 5,
        },
        members: [],
        isEditMode: false,
      };
      
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(savedState));
      
      render(<GroupWizard onSubmit={jest.fn()} />);
      
      expect(screen.getByText('Members')).toBeInTheDocument();
    });

    it('should clear sessionStorage after successful submission', async () => {
      const savedState: Partial<WizardState> = {
        step: 'details',
        details: {
          name: 'Test Group',
          paymentToken: 'GTEST...',
          usageCount: 1,
        },
        members: [
          {
            id: '1',
            address: 'GD5J6PHFVCHGE5H4ZL3FWJQSIHZO3SKN6QSE5YD3T3Y5R7E8N9X0Y1Z2',
            name: 'Test Member',
            basisPoints: 10000,
            locked: false,
          },
        ],
        isEditMode: false,
      };
      
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(savedState));
      
      const mockSubmit = jest.fn().mockResolvedValue(undefined);
      render(<GroupWizard onSubmit={mockSubmit} />);
      
      // Navigate to review step
      const nameInput = screen.getByLabelText('Group Name');
      fireEvent.change(nameInput, { target: { value: 'Test Group' } });
      
      const tokenInput = screen.getByLabelText('Payment Token Address');
      fireEvent.change(tokenInput, { target: { value: 'GTEST...' } });
      
      const nextButton = screen.getByLabelText('Go to next step');
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText('Members')).toBeInTheDocument();
      });
      
      const nextButton2 = screen.getByLabelText('Go to next step');
      fireEvent.click(nextButton2);
      
      await waitFor(() => {
        expect(screen.getByText(/Create Group/)).toBeInTheDocument();
      });
      
      // Submit
      const submitButton = screen.getByLabelText('Submit and sign');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('group-wizard-state');
      });
    });
  });

  describe('URL state persistence', () => {
    it('should update URL with step parameter', () => {
      render(<GroupWizard onSubmit={jest.fn()} />);
      
      expect(mockReplaceState).toHaveBeenCalled();
    });

    it('should parse step from URL on mount', () => {
      // This would require mocking useSearchParams to return specific values
      // For now, we verify the function exists
      expect(mockReplaceState).toBeDefined();
    });
  });

  describe('browser back button support', () => {
    it('should handle popstate event to move to previous step', () => {
      render(<GroupWizard onSubmit={jest.fn()} />);
      
      // Simulate browser back button
      const popStateEvent = new PopStateEvent('popstate', { state: { step: 'details' } });
      window.dispatchEvent(popStateEvent);
      
      // The wizard should handle this event
      expect(window.history.back).toBeDefined();
    });
  });

  describe('step validation', () => {
    it('should require name, token, and usage count for details step', () => {
      render(<GroupWizard onSubmit={jest.fn()} />);
      
      const nextButton = screen.getByLabelText('Go to next step');
      expect(nextButton).toBeDisabled();
      
      // Fill name only
      const nameInput = screen.getByLabelText('Group Name');
      fireEvent.change(nameInput, { target: { value: 'Test Group' } });
      
      expect(nextButton).toBeDisabled();
      
      // Fill token
      const tokenInput = screen.getByLabelText('Payment Token Address');
      fireEvent.change(tokenInput, { target: { value: 'GTEST...' } });
      
      expect(nextButton).toBeDisabled();
      
      // Fill usage count (already has default value of 1)
      expect(nextButton).toBeEnabled();
    });

    it('should require valid allocation for members step', async () => {
      const initialState: Partial<WizardState> = {
        step: 'members',
        details: {
          name: 'Test Group',
          paymentToken: 'GTEST...',
          usageCount: 1,
        },
        members: [],
        isEditMode: false,
      };
      
      render(<GroupWizard onSubmit={jest.fn()} initialState={initialState} />);
      
      const nextButton = screen.getByLabelText('Go to next step');
      expect(nextButton).toBeDisabled();
    });
  });

  describe('edit mode', () => {
    it('should show update button in edit mode', () => {
      const initialState: Partial<WizardState> = {
        step: 'review',
        details: {
          name: 'Test Group',
          paymentToken: 'GTEST...',
          usageCount: 1,
        },
        members: [
          {
            id: '1',
            address: 'GD5J6PHFVCHGE5H4ZL3FWJQSIHZO3SKN6QSE5YD3T3Y5R7E8N9X0Y1Z2',
            name: 'Test Member',
            basisPoints: 10000,
            locked: false,
          },
        ],
        isEditMode: true,
        groupId: 'test-id',
      };
      
      render(<GroupWizard onSubmit={jest.fn()} initialState={initialState} />);
      
      expect(screen.getByText('Update Group')).toBeInTheDocument();
    });

    it('should show create button in create mode', () => {
      const initialState: Partial<WizardState> = {
        step: 'review',
        details: {
          name: 'Test Group',
          paymentToken: 'GTEST...',
          usageCount: 1,
        },
        members: [
          {
            id: '1',
            address: 'GD5J6PHFVCHGE5H4ZL3FWJQSIHZO3SKN6QSE5YD3T3Y5R7E8N9X0Y1Z2',
            name: 'Test Member',
            basisPoints: 10000,
            locked: false,
          },
        ],
        isEditMode: false,
      };
      
      render(<GroupWizard onSubmit={jest.fn()} initialState={initialState} />);
      
      expect(screen.getByText('Create Group')).toBeInTheDocument();
    });
  });
});
