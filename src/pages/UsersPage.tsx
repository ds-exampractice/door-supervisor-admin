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

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedDevices, setExpandedDevices] = useState<string | null>(null)
  const [showDeleteDevice, setShowDeleteDevice] = useState<{ userId: string; device: Device } | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    const snap = await getDocs(collection(db, 'Users'))
    const list: AppUser[] = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data()
        // Load devices subcollection
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
    setSaving(true)
    await setDoc(doc(db, 'Users', user.id), { hasPurchased: !user.hasPurchased }, { merge: true })
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, hasPurchased: !u.hasPurchased } : u))
    setSaving(false)
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
    u.id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#2C3E50]">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} total</p>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email or username…"
          className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm w-64
                     focus:outline-none focus:ring-2 focus:ring-[#1565C0]"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading users…</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-semibold">Username</th>
                <th className="text-left px-5 py-3 font-semibold">Email</th>
                <th className="text-left px-5 py-3 font-semibold">Purchased</th>
                <th className="text-left px-5 py-3 font-semibold">Password</th>
                <th className="text-left px-5 py-3 font-semibold">Promo</th>
                <th className="text-left px-5 py-3 font-semibold">Last Login</th>
                <th className="text-left px-5 py-3 font-semibold">Devices</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <>
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                    <td className="px-5 py-3 font-mono text-xs text-[#1565C0] font-semibold">{user.id}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{user.email}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => togglePurchased(user)}
                        disabled={saving}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                          ${user.hasPurchased ? 'bg-[#26A69A]' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
                          ${user.hasPurchased ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                        ${user.hasSetPassword ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {user.hasSetPassword ? 'Set' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {user.promo_code_used ? (
                        <span className="font-mono text-xs text-[#26A69A] font-semibold">{user.promo_code_used}</span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">{formatDate(user.lastLogin)}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setExpandedDevices(expandedDevices === user.id ? null : user.id)}
                        className="text-xs text-[#1565C0] font-semibold hover:underline"
                      >
                        {user.devices?.length ?? 0} device{(user.devices?.length ?? 0) !== 1 ? 's' : ''} {expandedDevices === user.id ? '▲' : '▼'}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded devices row */}
                  {expandedDevices === user.id && (
                    <tr key={`${user.id}-devices`} className="bg-blue-50/40 border-b border-gray-100">
                      <td colSpan={7} className="px-8 py-3">
                        {(user.devices?.length ?? 0) === 0 ? (
                          <p className="text-xs text-gray-400">No devices registered</p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {user.devices?.map(device => (
                              <div key={device.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-100">
                                <div>
                                  <p className="text-xs font-semibold text-[#2C3E50]">{device.deviceName}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {device.platform} · Last login: {formatDate(device.lastLoginAt)}
                                  </p>
                                </div>
                                <button
                                  onClick={() => setShowDeleteDevice({ userId: user.id, device })}
                                  className="text-xs text-red-500 hover:text-red-700 font-semibold"
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
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">
                  {search ? 'No users match your search' : 'No users found'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Revoke Device Modal */}
      {showDeleteDevice && (
        <Modal title="Revoke Device" onClose={() => setShowDeleteDevice(null)} size="sm">
          <p className="text-sm text-gray-600 mb-2">
            Revoke <span className="font-semibold text-[#2C3E50]">{showDeleteDevice.device.deviceName}</span>?
          </p>
          <p className="text-xs text-gray-400 mb-5">
            The user will be able to register this slot with a new device on their next login.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteDevice(null)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={revokeDevice}
              className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">
              Revoke
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
