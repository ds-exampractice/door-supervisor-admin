import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { Link } from 'react-router-dom'

const MODULES = ['PWPSI', 'PWDSPSI', 'ACMIPSI', 'APISPSI']

interface FlaggedEntry { questionId: string; moduleCode: string; question: string; count: number }
interface RecentUser  { id: string; email: string; hasPurchased: boolean; createdAt?: { seconds: number } }

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
      setRecentUsers(sorted.slice(0, 8))
      setLoadingStats(false)
    }

    const loadFlagged = async () => {
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
                    counts[key] = { questionId: d.id, moduleCode, question: (d.data().Question as string) ?? '', count: 0 }
                  }
                  counts[key].count++
                })
              } catch { /* user may have no flags in this module */ }
            })
          )
        })
      )
      setFlagged(Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10))
      setLoadingFlagged(false)
    }

    loadStats()
    loadFlagged()
  }, [])

  const conversion = stats.users > 0 ? Math.round((stats.purchased / stats.users) * 100) : 0

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Platform overview</p>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        {loadingStats ? (
          [1,2,3,4].map(i => (
            <div key={i} className="stat-card" style={{ height: 90, opacity: 0.4 }} />
          ))
        ) : (
          <>
            <Link to="/users" style={{ textDecoration: 'none' }}>
              <div className="stat-card" style={{ transition: 'box-shadow 0.15s', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-xs)'}
              >
                <div className="stat-label">Total Users</div>
                <div className="stat-value">{stats.users}</div>
                <div className="stat-sub">Registered accounts</div>
              </div>
            </Link>
            <Link to="/users" style={{ textDecoration: 'none' }}>
              <div className="stat-card" style={{ transition: 'box-shadow 0.15s', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-xs)'}
              >
                <div className="stat-label">Purchased</div>
                <div className="stat-value" style={{ color: 'var(--teal)' }}>{stats.purchased}</div>
                <div className="stat-sub">{conversion}% conversion</div>
              </div>
            </Link>
            <Link to="/promo-codes" style={{ textDecoration: 'none' }}>
              <div className="stat-card" style={{ transition: 'box-shadow 0.15s', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-xs)'}
              >
                <div className="stat-label">Active Promo Codes</div>
                <div className="stat-value" style={{ color: 'var(--brand)' }}>{stats.activeCodes}</div>
                <div className="stat-sub">{stats.totalCodes} total</div>
              </div>
            </Link>
            <div className="stat-card">
              <div className="stat-label">Free Users</div>
              <div className="stat-value" style={{ color: 'var(--t3)' }}>{stats.users - stats.purchased}</div>
              <div className="stat-sub">No purchase yet</div>
            </div>
          </>
        )}
      </div>

      {/* Bottom panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        {/* Recent signups */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Signups</div>
            <Link to="/users" style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-text)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {loadingStats
            ? <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
            : recentUsers.length === 0
              ? <div className="empty-state"><div className="empty-state-sub">No signups yet</div></div>
              : recentUsers.map((u, i) => (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 20px',
                  borderBottom: i < recentUsers.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p className="mono" style={{ fontWeight: 700, color: 'var(--brand-text)', fontSize: 12 }}>{u.id}</p>
                    <p style={{ fontSize: 12, color: 'var(--t4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{u.email}</p>
                  </div>
                  <span className={`badge ${u.hasPurchased ? 'badge-teal' : 'badge-gray'}`} style={{ marginLeft: 12, flexShrink: 0 }}>
                    {u.hasPurchased ? 'Purchased' : 'Free'}
                  </span>
                </div>
              ))
          }
        </div>

        {/* Most flagged */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Most Flagged Questions</div>
              <div className="card-sub">Flagged as confusing or incorrect by users</div>
            </div>
          </div>
          {loadingFlagged
            ? <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
            : flagged.length === 0
              ? <div className="empty-state"><div className="empty-state-sub">No flagged questions yet</div></div>
              : flagged.map((f, i) => (
                <div key={`${f.moduleCode}:${f.questionId}`} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '11px 20px',
                  borderBottom: i < flagged.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    width: 30, height: 30, flexShrink: 0, borderRadius: '50%',
                    background: 'var(--red-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>{f.count}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span className="badge badge-brand">{f.moduleCode}</span>
                      <span className="mono" style={{ color: 'var(--t4)', fontSize: 11 }}>#{f.questionId}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.question || '(question text not stored in flag)'}
                    </p>
                  </div>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  )
}
