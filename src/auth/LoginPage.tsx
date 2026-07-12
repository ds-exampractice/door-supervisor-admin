import { useState } from 'react'
import {
  signInWithEmailAndPassword,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
} from 'firebase/auth'
import { auth } from '../firebase'
import logo from '../assets/app-logo.png'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
      const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
      const token = await credential.user.getIdTokenResult()
      if (token.claims.admin !== true) {
        await auth.signOut()
        setError('Access denied. This account does not have admin privileges.')
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('Incorrect email or password.')
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a moment and try again.')
      } else {
        setError('Sign in failed. Please check your connection and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left panel — brand */}
      <div className="bg-[#1565C0] md:w-1/2 flex flex-col items-center justify-center px-10 py-14 md:py-0">
        <img src={logo} alt="DS Exam Practice" className="w-24 h-24 rounded-2xl shadow-xl mb-6" />
        <h1 className="text-white text-3xl font-bold tracking-tight text-center">DS Exam Practice</h1>
        <p className="text-white/60 text-sm mt-2 text-center">Door Supervisor Licence Preparation</p>
        <div className="mt-10 hidden md:flex flex-col gap-3 w-full max-w-xs">
          {['Manage promo codes', 'Edit questions', 'Oversee users'].map(f => (
            <div key={f} className="flex items-center gap-3 text-white/70 text-sm">
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-white text-xs flex-shrink-0">✓</span>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="md:w-1/2 flex items-center justify-center bg-[#F5F7FA] px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-[#2C3E50] mb-1">Admin sign in</h2>
          <p className="text-sm text-gray-400 mb-8">Restricted to authorised accounts only.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-[#2C3E50] mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-[#2C3E50] text-sm
                           focus:outline-none focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 transition"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#2C3E50] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-[#2C3E50] text-sm
                           focus:outline-none focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 transition"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="w-4 h-4 accent-[#1565C0] rounded"
              />
              <label htmlFor="remember" className="text-sm text-gray-500 cursor-pointer">Remember me</label>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#1565C0] text-white font-semibold text-sm
                         hover:bg-[#1251A3] active:bg-[#0D3D80] transition disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
