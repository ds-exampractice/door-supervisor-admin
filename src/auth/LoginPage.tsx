import { useState, type FormEvent } from 'react'
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Persistence: local survives browser close, session clears on tab close
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
      const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)

      // Verify admin claim — AuthContext also checks this, but catching it here
      // lets us show a specific "Access denied" message instead of a blank redirect
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
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
      <div className="w-full max-w-md px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <img src={logo} alt="DS Exam Practice" className="w-20 h-20 rounded-2xl shadow-lg block mx-auto mb-5" />
          <h1 className="text-2xl font-bold text-[#2C3E50]">DS Exam Practice</h1>
          <p className="text-sm text-gray-500 mt-1">Admin Panel · Restricted Access</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-[#2C3E50] mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-[#F5F7FA] border border-transparent
                           focus:outline-none focus:border-[#1565C0] focus:bg-white transition
                           text-[#2C3E50] text-sm"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#2C3E50] mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl bg-[#F5F7FA] border border-transparent
                           focus:outline-none focus:border-[#1565C0] focus:bg-white transition
                           text-[#2C3E50] text-sm"
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
              <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer">
                Remember me
              </label>
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
                         hover:bg-[#1251A3] active:bg-[#0D3D80] transition disabled:opacity-60
                         disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>


      </div>
    </div>
  )
}
