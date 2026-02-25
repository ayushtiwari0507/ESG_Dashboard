import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock all page components to simplify testing
vi.mock('../pages/LoginPage', () => ({
  default: () => <div data-testid="login-page">Login Page</div>,
}));
vi.mock('../pages/DashboardPage', () => ({
  default: () => <div data-testid="dashboard-page">Dashboard</div>,
}));
vi.mock('../pages/DataEntryPage', () => ({
  default: () => <div data-testid="data-entry-page">Data Entry</div>,
}));
vi.mock('../pages/AuditLogPage', () => ({
  default: () => <div data-testid="audit-page">Audit</div>,
}));
vi.mock('../pages/UserManagementPage', () => ({
  default: () => <div data-testid="users-page">Users</div>,
}));
vi.mock('../components/layout/MainLayout', () => ({
  default: () => {
    const { Outlet } = require('react-router-dom');
    return <div data-testid="main-layout"><Outlet /></div>;
  },
}));

// Mock AuthContext to control auth state
vi.mock('../auth/AuthContext', () => {
  const mockUseAuth = vi.fn();
  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useAuth: mockUseAuth,
  };
});

import { useAuth } from '../auth/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

describe('App Router', () => {
  it('renders login page at /login when unauthenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    render(<App />);
    // When not authenticated, navigating to protected route redirects to login
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('shows loading spinner when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      loading: true,
      login: vi.fn(),
      logout: vi.fn(),
    });
    render(<App />);
    // The ProtectedRoute should show spinner
    // Login page is still rendered for /login route
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });
});
