import { useEffect, useState } from 'react'
import { collection, getDocs, setDoc, doc, deleteDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import Modal from '../components/Modal'

interface Device {
  id: string
  deviceName: string
  platform: string
  firstLoginAt?: Timestamp
  lastLoginAt?: Timestamp
}

interface AppUser {
  id: string
  email: string
  username?: string
  hasPurchased: boolean
  hasSetPassword: boolean
  createdAt?: Timestamp
  lastLogin?: Timestamp
  promo_code_used?: string
  promo_type?: string
  devices?: Device[]
}

function formatDate(ts?: Timestamp): string {
  if (!ts) return '—'
  return ts.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Toggle({ active, onChange }: { active: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
        ${active ? 'bg-[#26A69A]' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform
        ${active ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

const inputCls = 'w-full px-4 py-2.5 rounded-xl bg-[#F5F7FA] text-sm text-[#2C3E50] border border-transparent focus:outline-none focus:ring-2 focus:ring-[#1565C0] focus:border-[#1565C0] transition'
const labelCls = 'block text-sm font-semibold text-[#2C3E50] mb-1.5'

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedDevices, setExpandedDevices] = useState<string | null>(null)
  const [showDeleteDevice, setShowDeleteDevice] = useState<{ userId: string; device: Device } | null>(null)
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [editForm, setEditForm] = useState<{ username: string; email: string; hasPurchased: boolean; hasSetPassword: boolean }>({
    username: '', email: '', hasPurchased: false, hasSetPassword: false,
  })
  const [editError, setEditError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    const snap = await getDocs(collection(db, 'Users'))
    const list: AppUser[] = await Promise.all(
      snap.docs.map(async d => {
        const data = d.data()
        const deviceSnap = await getDocs(collection(db, 'Users', d.id, 'Devices'))
        const devices: Device[] = deviceSnap.docs.map(dd => ({ id: dd.id, ...dd.data() } as Device))
        return { id: d.id, ...data, devices } as AppUser
      })
    )
    list.sort((a, b) => (b.lastLogin?.seconds ?? 0) - (a.lastLogin?.seconds ?? 0))
    setUsers(list)
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const togglePurchased = async (user: AppUser) => {
    await setDoc(doc(db, 'Users', user.id), { hasPurchased: !user.hasPurchased }, { merge: true })
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, hasPurchased: !u.hasPurchased } : u))
  }

  const handleEditSave = async () => {
    if (!editUser) return
    setSaving(true); setEditError('')
    try {
      await setDoc(doc(db, 'Users', editUser.id), {
        username: editForm.username,
        email: editForm.email,
        hasPurchased: editForm.hasPurchased,
        hasSetPassword: editForm.hasSetPassword,
      }, { merge: true })
      setEditUser(null)
      await fetchUsers()
    } catch (e) { setEditError((e as Error).message) }
    finally { setSaving(false) }
  }

  const revokeDevice = async () => {
    if (!showDeleteDevice) return
    await deleteDoc(doc(db, 'Users', showDeleteDevice.userId, 'Devices', showDeleteDevice.device.id))
    setShowDeleteDevice(null)
    await fetchUsers()
  }

  const filtered = users.filter(u =>
    !search ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.id.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase())
  )

  const exportCSV = () => {
    const rows = [
      ['Username', 'Email', 'Has Purchased', 'Password Set', 'Promo Code', 'Last Login'],
      ...users.map(u => [
        u.id,
        u.email ?? '',
        u.hasPurchased ? 'Yes' : 'No',
        u.hasSetPassword ? 'Yes' : 'No',
        u.promo_code_used ?? '',
        formatDate(u.lastLogin),
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#2C3E50]">Users</h1>
          <p className="text-sm text-gray-400 mt-1">{users.length} registered · {users.filter(u => u.hasPurchased).length} purchased</p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by email, username…"
            className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm w-full sm:w-64
                       focus:outline-none focus:ring-2 focus:ring-[#1565C0] shadow-sm"
          />
          <button
            onClick={exportCSV}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 transition shadow-sm flex items-center gap-2 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading users…</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-semibold">Username</th>
                <th className="text-left px-5 py-3 font-semibold">Email</th>
                <th className="text-left px-5 py-3 font-semibold">Purchased</th>
                <th className="text-left px-5 py-3 font-semibold">Password</th>
                <th className="text-left px-5 py-3 font-semibold">Promo</th>
                <th className="text-left px-5 py-3 font-semibold">Last Login</th>
                <th className="text-left px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <>
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                    <td className="px-5 py-3.5 font-mono text-xs text-[#1565C0] font-semibold">{user.id}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs max-w-[160px] truncate">{user.email}</td>
                    <td className="px-5 py-3.5">
                      <Toggle active={user.hasPurchased} onChange={() => togglePurchased(user)} />
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full
                        ${user.hasSetPassword ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'}`}>
                        {user.hasSetPassword ? 'Set' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {user.promo_code_used
                        ? <span className="font-mono text-xs text-[#26A69A] font-semibold">{user.promo_code_used}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">{formatDate(user.lastLogin)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => {
                            setEditUser(user)
                            setEditForm({
                              username: user.id,
                              email: user.email ?? '',
                              hasPurchased: user.hasPurchased,
                              hasSetPassword: user.hasSetPassword,
                            })
                            setEditError('')
                          }}
                          className="text-[#1565C0] text-xs font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setExpandedDevices(expandedDevices === user.id ? null : user.id)}
                          className="text-xs text-gray-500 font-semibold px-2 py-1 rounded-lg hover:bg-gray-100 transition flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          {user.devices?.length ?? 0}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expandedDevices === user.id && (
                    <tr key={`${user.id}-devices`} className="bg-slate-50/60 border-b border-gray-100">
                      <td colSpan={7} className="px-8 py-4">
                        {(user.devices?.length ?? 0) === 0 ? (
                          <p className="text-xs text-gray-400">No devices registered</p>
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            {user.devices?.map(device => (
                              <div key={device.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100 min-w-[200px]">
                                <div>
                                  <p className="text-xs font-semibold text-[#2C3E50]">{device.deviceName}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">{device.platform}</p>
                                  <p className="text-xs text-gray-400">Last: {formatDate(device.lastLoginAt)}</p>
                                </div>
                                <button
                                  onClick={() => setShowDeleteDevice({ userId: user.id, device })}
                                  className="ml-4 text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition"
                                >
                                  Revoke
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                  {search ? 'No users match your search' : 'No users found'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <Modal title={`Edit User — ${editUser.id}`} onClose={() => setEditUser(null)}>
          <div className="space-y-4">
            <div className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-500">
              Joined: {formatDate(editUser.createdAt)} · Last login: {formatDate(editUser.lastLogin)}
              {editUser.promo_code_used && <> · Promo: <span className="font-mono font-bold text-[#26A69A]">{editUser.promo_code_used}</span></>}
            </div>

            <div>
              <label className={labelCls}>Username (document ID)</label>
              <input value={editForm.username} readOnly
                className={`${inputCls} opacity-60 cursor-not-allowed`} />
              <p className="text-xs text-gray-400 mt-1">Username cannot be changed — it is the Firestore document ID.</p>
            </div>

            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                className={inputCls} />
            </div>

            <div className="flex items-center justify-between px-3 py-3 rounded-xl bg-gray-50 border border-gray-100">
              <div>
                <p className="text-sm font-semibold text-[#2C3E50]">Has Purchased</p>
                <p className="text-xs text-gray-400 mt-0.5">Grants full app access</p>
              </div>
              <Toggle active={editForm.hasPurchased} onChange={() => setEditForm(f => ({ ...f, hasPurchased: !f.hasPurchased }))} />
            </div>

            <div className="flex items-center justify-between px-3 py-3 rounded-xl bg-gray-50 border border-gray-100">
              <div>
                <p className="text-sm font-semibold text-[#2C3E50]">Has Set Password</p>
                <p className="text-xs text-gray-400 mt-0.5">Whether the user completed password setup</p>
              </div>
              <Toggle active={editForm.hasSetPassword} onChange={() => setEditForm(f => ({ ...f, hasSetPassword: !f.hasSetPassword }))} />
            </div>

            {editError && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">{editError}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditUser(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleEditSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#1251A3] transition disabled:opacity-60">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Revoke Device Modal */}
      {showDeleteDevice && (
        <Modal title="Revoke Device" onClose={() => setShowDeleteDevice(null)} size="sm">
          <p className="text-sm text-gray-600 mb-2">
            Revoke <span className="font-semibold text-[#2C3E50]">{showDeleteDevice.device.deviceName}</span>?
          </p>
          <p className="text-xs text-gray-400 mb-5">
            The user's device slot will be freed and they can register a new device on next login.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteDevice(null)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button onClick={revokeDevice}
              className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">Revoke</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
