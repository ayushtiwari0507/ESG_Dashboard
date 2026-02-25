import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../../pages/LoginPage';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock auth context
const mockLogin = vi.fn();
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    token: null,
    loading: false,
    logout: vi.fn(),
  }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the login form', () => {
    render(<LoginPage />);
    expect(screen.getByText('ESG Platform')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('requires email and password fields', () => {
    render(<LoginPage />);
    const emailInput = screen.getByPlaceholderText('you@company.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  it('calls login on form submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<LoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('you@company.com'), 'admin@test.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    await user.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@test.com', 'password123');
    });
  });

  it('navigates to / on successful login', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<LoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('you@company.com'), 'admin@test.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'pass');
    await user.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('shows error message on failed login', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { data: { error: 'Invalid credentials' } },
    });
    render(<LoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('you@company.com'), 'bad@test.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrong');
    await user.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('shows generic error when no response error', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network error'));
    render(<LoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('you@company.com'), 'x@x.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'x');
    await user.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });
  });

  it('disables submit button while loading', async () => {
    // Make login hang
    mockLogin.mockReturnValue(new Promise(() => {}));
    render(<LoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('you@company.com'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'p');
    await user.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
    });
  });
});
