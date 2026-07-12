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
  return <button onClick={onChange} className={`ds-toggle${active ? ' on' : ''}`} aria-pressed={active} />
}

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
        u.id, u.email ?? '',
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
    a.href = url; a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const purchased = users.filter(u => u.hasPurchased).length

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-sub">{users.length} registered &nbsp;·&nbsp; {purchased} purchased ({users.length > 0 ? Math.round((purchased / users.length) * 100) : 0}%)</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <svg
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t4)', pointerEvents: 'none' }}
              width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users…"
              className="form-input"
              style={{ paddingLeft: 32, width: 220 }}
            />
          </div>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Purchased</th>
                  <th>Password</th>
                  <th>Promo</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <>
                    <tr key={user.id}>
                      <td>
                        <span className="mono" style={{ color: 'var(--brand-text)', fontWeight: 700 }}>{user.id}</span>
                      </td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--t3)' }}>
                        {user.email}
                      </td>
                      <td>
                        <Toggle active={user.hasPurchased} onChange={() => togglePurchased(user)} />
                      </td>
                      <td>
                        <span className={`badge ${user.hasSetPassword ? 'badge-green' : 'badge-amber'}`}>
                          {user.hasSetPassword ? 'Set' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        {user.promo_code_used
                          ? <span className="mono badge badge-teal">{user.promo_code_used}</span>
                          : <span style={{ color: 'var(--t4)' }}>—</span>}
                      </td>
                      <td style={{ color: 'var(--t4)', fontSize: 12 }}>{formatDate(user.lastLogin)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="btn btn-sm btn-ghost-blue"
                            onClick={() => {
                              setEditUser(user)
                              setEditForm({ username: user.id, email: user.email ?? '', hasPurchased: user.hasPurchased, hasSetPassword: user.hasSetPassword })
                              setEditError('')
                            }}
                          >Edit</button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => setExpandedDevices(expandedDevices === user.id ? null : user.id)}
                            style={{ gap: 4 }}
                          >
                            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            {user.devices?.length ?? 0}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedDevices === user.id && (
                      <tr key={`${user.id}-devices`}>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div className="row-detail">
                            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--t4)', marginBottom: 10 }}>
                              Registered Devices
                            </p>
                            {(user.devices?.length ?? 0) === 0 ? (
                              <p style={{ fontSize: 13, color: 'var(--t4)' }}>No devices registered</p>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                {user.devices?.map(device => (
                                  <div key={device.id} className="device-card">
                                    <div>
                                      <div className="device-name">{device.deviceName}</div>
                                      <div className="device-meta">{device.platform} · Last: {formatDate(device.lastLoginAt)}</div>
                                    </div>
                                    <button
                                      className="btn btn-sm btn-ghost-red"
                                      style={{ marginLeft: 12 }}
                                      onClick={() => setShowDeleteDevice({ userId: user.id, device })}
                                    >Revoke</button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <div className="empty-state-title">{search ? 'No users match your search' : 'No users found'}</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <Modal title={`Edit User`} onClose={() => setEditUser(null)}>
          <div className="form-section">
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--r2)',
              background: 'var(--bg-muted)', border: '1px solid var(--border)',
              fontSize: 12, color: 'var(--t3)',
            }}>
              Joined {formatDate(editUser.createdAt)} &nbsp;·&nbsp; Last login {formatDate(editUser.lastLogin)}
              {editUser.promo_code_used && <> &nbsp;·&nbsp; Promo: <span className="mono" style={{ fontWeight: 700, color: 'var(--teal)' }}>{editUser.promo_code_used}</span></>}
            </div>

            <div className="form-field">
              <label className="form-label">Username (document ID)</label>
              <input value={editForm.username} readOnly className="form-input" />
              <p className="form-hint">Username cannot be changed — it is the Firestore document ID.</p>
            </div>

            <div className="form-field">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                className="form-input"
              />
            </div>

            <div className="toggle-row">
              <div>
                <div className="toggle-row-label">Has Purchased</div>
                <div className="toggle-row-sub">Grants full app access</div>
              </div>
              <Toggle active={editForm.hasPurchased} onChange={() => setEditForm(f => ({ ...f, hasPurchased: !f.hasPurchased }))} />
            </div>

            <div className="toggle-row">
              <div>
                <div className="toggle-row-label">Has Set Password</div>
                <div className="toggle-row-sub">Whether the user completed password setup</div>
              </div>
              <Toggle active={editForm.hasSetPassword} onChange={() => setEditForm(f => ({ ...f, hasSetPassword: !f.hasSetPassword }))} />
            </div>

            {editError && <div className="alert alert-error">{editError}</div>}

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditUser(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleEditSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Revoke Device Modal */}
      {showDeleteDevice && (
        <Modal title="Revoke Device" onClose={() => setShowDeleteDevice(null)} size="sm">
          <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 6, lineHeight: 1.6 }}>
            Revoke <strong>{showDeleteDevice.device.deviceName}</strong>?
          </p>
          <p style={{ fontSize: 13, color: 'var(--t4)', marginBottom: 20 }}>
            The user's device slot will be freed and they can register a new device on next login.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowDeleteDevice(null)}>Cancel</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={revokeDevice}>Revoke</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
