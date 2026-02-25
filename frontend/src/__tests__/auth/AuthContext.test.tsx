import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../auth/AuthContext';
import api from '../../api/client';

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

function TestConsumer() {
  const { user, token, loading, login, logout } = useAuth();

  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.email : 'null'}</span>
      <span data-testid="token">{token ?? 'null'}</span>
      <button onClick={() => login('a@b.com', 'pass')} data-testid="login-btn">Login</button>
      <button onClick={logout} data-testid="logout-btn">Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('provides loading=true initially when no token', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Eventually loading should be false
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('fetches user profile when token exists in storage', async () => {
    localStorage.setItem('accessToken', 'stored-token');
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { id: 1, email: 'admin@esg.com', fullName: 'Admin', role: 'admin', siteIds: [] },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('admin@esg.com');
    });
    expect(api.get).toHaveBeenCalledWith('/auth/me');
  });

  it('clears token if /auth/me fails', async () => {
    localStorage.setItem('accessToken', 'bad-token');
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('401'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('login stores token and sets user', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        accessToken: 'new-token',
        user: { id: 2, email: 'user@esg.com', fullName: 'User', role: 'site_user', siteIds: [1] },
      },
    });
    // After login sets token, useEffect calls api.get('/auth/me')
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { id: 2, email: 'user@esg.com', fullName: 'User', role: 'site_user', siteIds: [1] },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    const loginBtn = screen.getByTestId('login-btn');
    loginBtn.click();

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('user@esg.com');
    });
    expect(localStorage.getItem('accessToken')).toBe('new-token');
  });

  it('logout clears state and storage', async () => {
    localStorage.setItem('accessToken', 'old-token');
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { id: 1, email: 'admin@esg.com', fullName: 'Admin', role: 'admin', siteIds: [] },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('admin@esg.com');
    });

    screen.getByTestId('logout-btn').click();

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('null');
      expect(screen.getByTestId('token').textContent).toBe('null');
    });
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('throws error when useAuth used outside provider', () => {
    // Suppress React error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within AuthProvider');
    spy.mockRestore();
  });
});
