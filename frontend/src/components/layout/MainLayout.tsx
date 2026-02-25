import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊', roles: ['admin', 'site_user', 'viewer'] },
  { path: '/data-entry', label: 'Data Entry', icon: '📝', roles: ['admin', 'site_user'] },
  { path: '/users', label: 'Users', icon: '👥', roles: ['admin'] },
  { path: '/audit-log', label: 'Audit Log', icon: '📋', roles: ['admin'] },
];

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleNav = navItems.filter(item =>
    item.roles.includes(user?.role || '')
  );

  return (
    <div className="flex h-screen bg-dark-950">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-900/80 backdrop-blur-lg border-r border-dark-700 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg">
              E
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">ESG Platform</h1>
              <p className="text-xs text-dark-400">Sustainability Data</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {visibleNav.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'sidebar-link-active text-primary-400 bg-primary-500/10'
                    : 'text-dark-300 hover:text-white hover:bg-dark-800'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-dark-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.fullName}</p>
              <p className="text-xs text-dark-400 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-dark-400 hover:text-red-400 transition-colors px-2 py-1.5 rounded hover:bg-dark-800"
          >
            ← Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
