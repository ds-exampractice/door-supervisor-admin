import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import logo from '../assets/app-logo.png'

const NAV = [
  {
    to: '/promo-codes',
    label: 'Promo Codes',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    to: '/questions',
    label: 'Questions',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    to: '/users',
    label: 'Users',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="w-64 min-h-screen bg-[#1565C0] flex flex-col shadow-xl">
      {/* Logo */}
      <div className="px-6 py-7 border-b border-white/10 flex items-center gap-3.5">
        <img src={logo} alt="DS Exam Logo" className="w-10 h-10 rounded-xl shadow-md" />
        <div>
          <p className="text-white font-bold text-sm leading-tight tracking-wide">DS Exam Practice</p>
          <p className="text-white/50 text-xs mt-0.5 tracking-wider uppercase">Admin Panel</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-5 space-y-1">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all
               ${isActive
                 ? 'bg-white text-[#1565C0] shadow-sm'
                 : 'text-white/75 hover:bg-white/10 hover:text-white'}`
            }
          >
            {icon}
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-4 py-5 border-t border-white/10 mx-2 mb-2">
        <div className="bg-white/10 rounded-xl px-4 py-3">
          <p className="text-white/50 text-xs uppercase tracking-wider mb-0.5">Signed in as</p>
          <p className="text-white text-xs font-semibold truncate">{user?.email}</p>
          <button
            onClick={logout}
            className="mt-3 w-full text-center text-xs text-white/60 hover:text-white transition py-1.5 rounded-lg hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
