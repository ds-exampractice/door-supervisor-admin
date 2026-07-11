import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const NAV = [
  { to: '/promo-codes', label: 'Promo Codes', icon: '🏷️' },
  { to: '/questions', label: 'Questions', icon: '📝' },
  { to: '/users', label: 'Users', icon: '👥' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="w-56 min-h-screen bg-[#1565C0] flex flex-col">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/10">
        <p className="text-white font-bold text-base leading-tight">DS Exam</p>
        <p className="text-white/60 text-xs mt-0.5">Admin Panel</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition
               ${isActive
                 ? 'bg-white text-[#1565C0]'
                 : 'text-white/80 hover:bg-white/10 hover:text-white'}`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-white/60 text-xs truncate mb-2">{user?.email}</p>
        <button
          onClick={logout}
          className="w-full text-left text-sm text-white/70 hover:text-white transition py-1"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
