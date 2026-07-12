import { useEffect, useState } from 'react'
import { collection, getDocs, setDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'
import Modal from '../components/Modal'

interface PromoCode {
  id: string
  type: 'enterprise' | 'customer'
  active: boolean
  discount_percent: number
  institution_name?: string
  usage_limit: number
  used_count: number
  created_at: string
}

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function generateCode(type: 'enterprise' | 'customer', existing: Set<string>): string {
  const prefix = type === 'enterprise' ? 'E' : 'C'
  for (let i = 0; i < 100; i++) {
    let suffix = ''
    for (let j = 0; j < 6; j++) suffix += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    const code = prefix + suffix
    if (!existing.has(code)) return code
  }
  throw new Error('Could not generate unique code after 100 attempts')
}

const DEFAULT_FORM = {
  type: 'customer' as 'enterprise' | 'customer',
  institution_name: '',
  discount_percent: 0,
  usage_limit: -1,
}

function Toggle({ active, onChange }: { active: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`ds-toggle${active ? ' on' : ''}`}
      aria-pressed={active}
    />
  )
}

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState<PromoCode | null>(null)
  const [showDelete, setShowDelete] = useState<PromoCode | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [editForm, setEditForm] = useState<Partial<PromoCode>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [editError, setEditError] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const fetchCodes = async () => {
    setLoading(true)
    const snap = await getDocs(collection(db, 'promo_codes'))
    const list: PromoCode[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as PromoCode))
    list.sort((a, b) => b.created_at?.localeCompare(a.created_at ?? '') ?? 0)
    setCodes(list)
    setLoading(false)
  }

  useEffect(() => { fetchCodes() }, [])

  const handleCreate = async () => {
    setSaving(true); setError('')
    try {
      const existing = new Set(codes.map(c => c.id))
      const code = generateCode(form.type, existing)
      const docData: Omit<PromoCode, 'id'> = {
        type: form.type,
        active: true,
        discount_percent: form.discount_percent,
        usage_limit: form.usage_limit,
        used_count: 0,
        created_at: new Date().toISOString(),
        ...(form.type === 'enterprise' && { institution_name: form.institution_name }),
      }
      await setDoc(doc(db, 'promo_codes', code), docData)
      setShowCreate(false); setForm(DEFAULT_FORM)
      await fetchCodes()
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleEdit = async () => {
    if (!showEdit) return
    setSaving(true); setEditError('')
    try {
      await setDoc(doc(db, 'promo_codes', showEdit.id), editForm, { merge: true })
      setShowEdit(null)
      await fetchCodes()
    } catch (e) { setEditError((e as Error).message) }
    finally { setSaving(false) }
  }

  const toggleActive = async (code: PromoCode) => {
    try {
      await setDoc(doc(db, 'promo_codes', code.id), { active: !code.active }, { merge: true })
      setCodes(prev => prev.map(c => c.id === code.id ? { ...c, active: !c.active } : c))
    } catch (e) { alert('Failed to update: ' + (e as Error).message) }
  }

  const handleDelete = async () => {
    if (!showDelete) return
    setDeleting(true); setDeleteError('')
    try {
      await deleteDoc(doc(db, 'promo_codes', showDelete.id))
      setShowDelete(null)
      await fetchCodes()
    } catch (e) { setDeleteError((e as Error).message) }
    finally { setDeleting(false) }
  }

  const activeCount = codes.filter(c => c.active).length

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Promo Codes</h1>
          <p className="page-sub">{codes.length} total &nbsp;·&nbsp; {activeCount} active</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { setShowCreate(true); setForm(DEFAULT_FORM); setError('') }}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Code
        </button>
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
                  <th>Code</th>
                  <th>Type</th>
                  <th>Institution</th>
                  <th>Discount</th>
                  <th>Used / Limit</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.map(code => (
                  <tr key={code.id}>
                    <td>
                      <span className="mono" style={{ color: 'var(--brand-text)', fontWeight: 700, letterSpacing: '0.06em' }}>
                        {code.id}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${code.type === 'enterprise' ? 'badge-purple' : 'badge-teal'}`}>
                        {code.type}
                      </span>
                    </td>
                    <td style={{ color: 'var(--t3)' }}>{code.institution_name ?? '—'}</td>
                    <td style={{ color: 'var(--t2)', fontWeight: 600 }}>
                      {code.discount_percent > 0 ? `${code.discount_percent}%` : '—'}
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--t1)' }}>{code.used_count}</span>
                      <span style={{ color: 'var(--t4)' }}> / {code.usage_limit === -1 ? '∞' : code.usage_limit}</span>
                    </td>
                    <td>
                      <Toggle active={code.active} onChange={() => toggleActive(code)} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-sm btn-ghost-blue"
                          onClick={() => {
                            setShowEdit(code)
                            setEditForm({
                              institution_name: code.institution_name ?? '',
                              discount_percent: code.discount_percent,
                              usage_limit: code.usage_limit,
                              active: code.active,
                            })
                            setEditError('')
                          }}
                        >Edit</button>
                        <button
                          className="btn btn-sm btn-ghost-red"
                          onClick={() => { setShowDelete(code); setDeleteError('') }}
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {codes.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <div className="empty-state-title">No promo codes yet</div>
                        <div className="empty-state-sub">Create your first code to get started</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Create Promo Code" onClose={() => setShowCreate(false)}>
          <div className="form-section">
            <div className="form-field">
              <label className="form-label">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as 'enterprise' | 'customer' }))}
                className="form-select"
              >
                <option value="customer">Customer (discount code)</option>
                <option value="enterprise">Enterprise (referral, no discount)</option>
              </select>
            </div>

            {form.type === 'enterprise' && (
              <div className="form-field">
                <label className="form-label">Institution Name</label>
                <input
                  type="text"
                  value={form.institution_name}
                  onChange={e => setForm(f => ({ ...f, institution_name: e.target.value }))}
                  className="form-input"
                  placeholder="e.g. London Security College"
                />
              </div>
            )}

            {form.type === 'customer' && (
              <div className="form-field">
                <label className="form-label">Discount % <span className="form-label-hint">(display only)</span></label>
                <input
                  type="number" min={0} max={100}
                  value={form.discount_percent}
                  onChange={e => setForm(f => ({ ...f, discount_percent: parseInt(e.target.value) || 0 }))}
                  className="form-input"
                />
              </div>
            )}

            <div className="form-field">
              <label className="form-label">Usage Limit <span className="form-label-hint">(-1 = unlimited)</span></label>
              <input
                type="number" min={-1}
                value={form.usage_limit}
                onChange={e => setForm(f => ({ ...f, usage_limit: parseInt(e.target.value) || -1 }))}
                className="form-input"
              />
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating…' : 'Create Code'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <Modal title={`Edit Code — ${showEdit.id}`} onClose={() => setShowEdit(null)}>
          <div className="form-section">
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--r2)',
              background: 'var(--bg-muted)', border: '1px solid var(--border)',
              fontSize: 12, color: 'var(--t3)',
            }}>
              <span className="mono" style={{ fontWeight: 700, color: 'var(--brand-text)' }}>{showEdit.id}</span>
              &nbsp;·&nbsp;{showEdit.type}&nbsp;·&nbsp;{showEdit.used_count} uses
            </div>

            {showEdit.type === 'enterprise' && (
              <div className="form-field">
                <label className="form-label">Institution Name</label>
                <input
                  type="text"
                  value={editForm.institution_name ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, institution_name: e.target.value }))}
                  className="form-input"
                  placeholder="e.g. London Security College"
                />
              </div>
            )}

            {showEdit.type === 'customer' && (
              <div className="form-field">
                <label className="form-label">Discount % <span className="form-label-hint">(display only)</span></label>
                <input
                  type="number" min={0} max={100}
                  value={editForm.discount_percent ?? 0}
                  onChange={e => setEditForm(f => ({ ...f, discount_percent: parseInt(e.target.value) || 0 }))}
                  className="form-input"
                />
              </div>
            )}

            <div className="form-field">
              <label className="form-label">Usage Limit <span className="form-label-hint">(-1 = unlimited)</span></label>
              <input
                type="number" min={-1}
                value={editForm.usage_limit ?? -1}
                onChange={e => setEditForm(f => ({ ...f, usage_limit: parseInt(e.target.value) || -1 }))}
                className="form-input"
              />
            </div>

            <div className="form-field">
              <label className="form-label">Reset Used Count</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--t3)' }}>Current: <strong style={{ color: 'var(--t1)' }}>{showEdit.used_count}</strong></span>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setEditForm(f => ({ ...f, used_count: 0 }))}
                >Reset to 0</button>
              </div>
            </div>

            <div className="toggle-row">
              <div>
                <div className="toggle-row-label">Active</div>
                <div className="toggle-row-sub">Code can be used by customers</div>
              </div>
              <Toggle
                active={editForm.active ?? showEdit.active}
                onChange={() => setEditForm(f => ({ ...f, active: !(f.active ?? showEdit.active) }))}
              />
            </div>

            {editError && <div className="alert alert-error">{editError}</div>}

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowEdit(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      {showDelete && (
        <Modal title="Delete Promo Code" onClose={() => setShowDelete(null)} size="sm">
          <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 16, lineHeight: 1.6 }}>
            Permanently delete <span className="mono" style={{ fontWeight: 700, color: 'var(--brand-text)' }}>{showDelete.id}</span>?
            This cannot be undone.
          </p>
          {deleteError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{deleteError}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowDelete(null)}>Cancel</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
