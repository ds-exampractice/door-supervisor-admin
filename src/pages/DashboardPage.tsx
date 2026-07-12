import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { Link } from 'react-router-dom'

const MODULES = ['PWPSI', 'PWDSPSI', 'ACMIPSI', 'APISPSI']

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string
  to?: string
}

function StatCard({ label, value, sub, color = 'text-[#2C3E50]', to }: StatCardProps) {
  const inner = (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 hover:shadow-md transition">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

interface FlaggedEntry {
  questionId: string
  moduleCode: string
  question: string
  count: number
}

interface RecentUser {
  id: string
  email: string
  hasPurchased: boolean
  createdAt?: { seconds: number }
}

export default function DashboardPage() {
  const [stats, setStats] = useState({ users: 0, purchased: 0, activeCodes: 0, totalCodes: 0 })
  const [flagged, setFlagged] = useState<FlaggedEntry[]>([])
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingFlagged, setLoadingFlagged] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      const [usersSnap, codesSnap] = await Promise.all([
        getDocs(collection(db, 'Users')),
        getDocs(collection(db, 'promo_codes')),
      ])
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as RecentUser & { createdAt?: { seconds: number } }))
      const purchased = users.filter(u => u.hasPurchased).length
      const activeCodes = codesSnap.docs.filter(d => d.data().active).length

      setStats({ users: users.length, purchased, activeCodes, totalCodes: codesSnap.size })

      const sorted = [...users].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      setRecentUsers(sorted.slice(0, 6))
      setLoadingStats(false)
    }

    const loadFlagged = async () => {
      // Aggregate flagged questions across all users for all modules
      const usersSnap = await getDocs(collection(db, 'Users'))
      const counts: Record<string, FlaggedEntry> = {}

      await Promise.all(
        usersSnap.docs.map(async userDoc => {
          await Promise.all(
            MODULES.map(async moduleCode => {
              try {
                const snap = await getDocs(
                  collection(db, 'Users', userDoc.id, 'Flagged Questions', 'Modules', moduleCode, 'Type', 'BIIAB')
                )
                snap.docs.forEach(d => {
                  const key = `${moduleCode}:${d.id}`
                  if (!counts[key]) {
                    counts[key] = {
                      questionId: d.id,
                      moduleCode,
                      question: (d.data().Question as string) ?? '',
                      count: 0,
                    }
                  }
                  counts[key].count++
                })
              } catch {
                // user may have no flagged questions in this module
              }
            })
          )
        })
      )

      const sorted = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10)
      setFlagged(sorted)
      setLoadingFlagged(false)
    }

    loadStats()
    loadFlagged()
  }, [])

  const conversionRate = stats.users > 0 ? Math.round((stats.purchased / stats.users) * 100) : 0

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#2C3E50]">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Overview of your platform</p>
      </div>

      {/* Stats */}
      {loadingStats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 px-6 py-5 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Users" value={stats.users} sub="Registered accounts" to="/users" />
          <StatCard
            label="Purchased"
            value={stats.purchased}
            sub={`${conversionRate}% conversion`}
            color="text-[#26A69A]"
            to="/users"
          />
          <StatCard
            label="Active Promo Codes"
            value={stats.activeCodes}
            sub={`${stats.totalCodes} total`}
            color="text-[#1565C0]"
            to="/promo-codes"
          />
          <StatCard
            label="Free Users"
            value={stats.users - stats.purchased}
            sub="No purchase yet"
            color="text-gray-500"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent signups */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#2C3E50]">Recent Signups</h2>
            <Link to="/users" className="text-xs text-[#1565C0] font-semibold hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {loadingStats ? (
              [...Array(4)].map((_, i) => <div key={i} className="px-6 py-3.5 animate-pulse h-12" />)
            ) : recentUsers.length === 0 ? (
              <p className="px-6 py-8 text-sm text-gray-400 text-center">No users yet</p>
            ) : recentUsers.map(u => (
              <div key={u.id} className="px-6 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#2C3E50] font-mono">{u.id}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
                  ${u.hasPurchased ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>
                  {u.hasPurchased ? 'Purchased' : 'Free'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Most flagged questions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#2C3E50]">Most Flagged Questions</h2>
            <span className="text-xs text-gray-400">Flagged by users as confusing/incorrect</span>
          </div>
          <div className="divide-y divide-gray-50">
            {loadingFlagged ? (
              [...Array(4)].map((_, i) => <div key={i} className="px-6 py-3.5 animate-pulse h-14" />)
            ) : flagged.length === 0 ? (
              <p className="px-6 py-8 text-sm text-gray-400 text-center">No flagged questions yet</p>
            ) : flagged.map(f => (
              <div key={`${f.moduleCode}:${f.questionId}`} className="px-6 py-3.5 flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                  <span className="text-xs font-bold text-red-500">{f.count}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-[#1565C0] bg-blue-50 px-2 py-0.5 rounded-full">{f.moduleCode}</span>
                    <span className="text-xs text-gray-400 font-mono">#{f.questionId}</span>
                  </div>
                  <p className="text-sm text-[#2C3E50] truncate">{f.question || '(question text not stored in flag)'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
