import { useEffect, useState } from 'react'
import {
  collection, getDocs, setDoc, deleteDoc, doc,
} from 'firebase/firestore'
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
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
        ${active ? 'bg-[#1565C0]' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform
        ${active ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

const inputCls = 'w-full px-4 py-2.5 rounded-xl bg-[#F5F7FA] text-sm text-[#2C3E50] border border-transparent focus:outline-none focus:ring-2 focus:ring-[#1565C0] focus:border-[#1565C0] transition'
const labelCls = 'block text-sm font-semibold text-[#2C3E50] mb-1.5'

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

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#2C3E50]">Promo Codes</h1>
          <p className="text-sm text-gray-400 mt-1">{codes.length} code{codes.length !== 1 ? 's' : ''} total</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setForm(DEFAULT_FORM); setError('') }}
          className="px-5 py-2.5 bg-[#1565C0] text-white rounded-xl text-sm font-semibold hover:bg-[#1251A3] transition shadow-sm"
        >
          + New Code
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-semibold">Code</th>
                <th className="text-left px-5 py-3 font-semibold">Type</th>
                <th className="text-left px-5 py-3 font-semibold">Institution</th>
                <th className="text-left px-5 py-3 font-semibold">Discount</th>
                <th className="text-left px-5 py-3 font-semibold">Used / Limit</th>
                <th className="text-left px-5 py-3 font-semibold">Active</th>
                <th className="text-left px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(code => (
                <tr key={code.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition">
                  <td className="px-5 py-3.5 font-mono font-semibold text-[#1565C0] tracking-wider">{code.id}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold
                      ${code.type === 'enterprise' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
                      {code.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{code.institution_name ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-700">{code.discount_percent > 0 ? `${code.discount_percent}%` : '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className="font-semibold text-[#2C3E50]">{code.used_count}</span>
                    <span className="text-gray-400"> / {code.usage_limit === -1 ? '∞' : code.usage_limit}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Toggle active={code.active} onChange={() => toggleActive(code)} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button
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
                        className="text-[#1565C0] text-xs font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { setShowDelete(code); setDeleteError('') }}
                        className="text-red-500 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {codes.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No promo codes yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Create Promo Code" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Type</label>
              <select value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as 'enterprise' | 'customer' }))}
                className={inputCls}>
                <option value="customer">Customer (discount)</option>
                <option value="enterprise">Enterprise (referral, no discount)</option>
              </select>
            </div>
            {form.type === 'enterprise' && (
              <div>
                <label className={labelCls}>Institution Name</label>
                <input type="text" value={form.institution_name}
                  onChange={e => setForm(f => ({ ...f, institution_name: e.target.value }))}
                  className={inputCls} placeholder="e.g. London Security College" />
              </div>
            )}
            {form.type === 'customer' && (
              <div>
                <label className={labelCls}>Discount % <span className="text-gray-400 font-normal text-xs">(display only)</span></label>
                <input type="number" min={0} max={100} value={form.discount_percent}
                  onChange={e => setForm(f => ({ ...f, discount_percent: parseInt(e.target.value) || 0 }))}
                  className={inputCls} />
              </div>
            )}
            <div>
              <label className={labelCls}>Usage Limit <span className="text-gray-400 font-normal text-xs">(-1 = unlimited)</span></label>
              <input type="number" min={-1} value={form.usage_limit}
                onChange={e => setForm(f => ({ ...f, usage_limit: parseInt(e.target.value) || -1 }))}
                className={inputCls} />
            </div>
            {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#1251A3] transition disabled:opacity-60">
                {saving ? 'Creating…' : 'Create Code'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <Modal title={`Edit ${showEdit.id}`} onClose={() => setShowEdit(null)}>
          <div className="space-y-4">
            <div className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-500 font-mono">
              Code: <span className="font-bold text-[#1565C0]">{showEdit.id}</span>
              &nbsp;·&nbsp;Type: <span className="font-bold text-[#2C3E50]">{showEdit.type}</span>
              &nbsp;·&nbsp;Used: <span className="font-bold text-[#2C3E50]">{showEdit.used_count}</span>
            </div>

            {showEdit.type === 'enterprise' && (
              <div>
                <label className={labelCls}>Institution Name</label>
                <input type="text" value={editForm.institution_name ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, institution_name: e.target.value }))}
                  className={inputCls} placeholder="e.g. London Security College" />
              </div>
            )}

            {showEdit.type === 'customer' && (
              <div>
                <label className={labelCls}>Discount % <span className="text-gray-400 font-normal text-xs">(display only)</span></label>
                <input type="number" min={0} max={100} value={editForm.discount_percent ?? 0}
                  onChange={e => setEditForm(f => ({ ...f, discount_percent: parseInt(e.target.value) || 0 }))}
                  className={inputCls} />
              </div>
            )}

            <div>
              <label className={labelCls}>Usage Limit <span className="text-gray-400 font-normal text-xs">(-1 = unlimited)</span></label>
              <input type="number" min={-1} value={editForm.usage_limit ?? -1}
                onChange={e => setEditForm(f => ({ ...f, usage_limit: parseInt(e.target.value) || -1 }))}
                className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Reset Used Count</label>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Current: <strong>{showEdit.used_count}</strong></span>
                <button
                  onClick={() => setEditForm(f => ({ ...f, used_count: 0 }))}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                >
                  Reset to 0
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-sm font-semibold text-[#2C3E50]">Active</span>
              <Toggle
                active={editForm.active ?? showEdit.active}
                onChange={() => setEditForm(f => ({ ...f, active: !(f.active ?? showEdit.active) }))}
              />
            </div>

            {editError && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">{editError}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowEdit(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleEdit} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#1251A3] transition disabled:opacity-60">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      {showDelete && (
        <Modal title="Delete Promo Code" onClose={() => setShowDelete(null)} size="sm">
          <p className="text-sm text-gray-600 mb-5">
            Delete <span className="font-mono font-semibold text-[#1565C0]">{showDelete.id}</span>? This cannot be undone.
          </p>
          {deleteError && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl mb-4">{deleteError}</p>}
          <div className="flex gap-3">
            <button onClick={() => setShowDelete(null)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition disabled:opacity-60">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
