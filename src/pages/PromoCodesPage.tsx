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

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showDelete, setShowDelete] = useState<PromoCode | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
    setSaving(true)
    setError('')
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
      setShowCreate(false)
      setForm(DEFAULT_FORM)
      await fetchCodes()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (code: PromoCode) => {
    await setDoc(doc(db, 'promo_codes', code.id), { active: !code.active }, { merge: true })
    setCodes(prev => prev.map(c => c.id === code.id ? { ...c, active: !c.active } : c))
  }

  const handleDelete = async () => {
    if (!showDelete) return
    await deleteDoc(doc(db, 'promo_codes', showDelete.id))
    setShowDelete(null)
    await fetchCodes()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#2C3E50]">Promo Codes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{codes.length} codes total</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setForm(DEFAULT_FORM); setError('') }}
          className="px-4 py-2 bg-[#1565C0] text-white rounded-xl text-sm font-semibold hover:bg-[#1251A3] transition"
        >
          + New Code
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
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
                <tr key={code.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                  <td className="px-5 py-3 font-mono font-semibold text-[#1565C0]">{code.id}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                      ${code.type === 'enterprise' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-[#26A69A]'}`}>
                      {code.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{code.institution_name ?? '—'}</td>
                  <td className="px-5 py-3">{code.discount_percent > 0 ? `${code.discount_percent}%` : '—'}</td>
                  <td className="px-5 py-3">
                    {code.used_count} / {code.usage_limit === -1 ? '∞' : code.usage_limit}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleActive(code)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                        ${code.active ? 'bg-[#1565C0]' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
                        ${code.active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => setShowDelete(code)}
                      className="text-red-500 hover:text-red-700 text-xs font-semibold transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {codes.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No promo codes yet</td></tr>
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
              <label className="block text-sm font-semibold text-[#2C3E50] mb-1.5">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as 'enterprise' | 'customer' }))}
                className="w-full px-4 py-2.5 rounded-xl bg-[#F5F7FA] text-sm text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#1565C0]"
              >
                <option value="customer">Customer (discount)</option>
                <option value="enterprise">Enterprise (referral, no discount)</option>
              </select>
            </div>

            {form.type === 'enterprise' && (
              <div>
                <label className="block text-sm font-semibold text-[#2C3E50] mb-1.5">Institution Name</label>
                <input
                  type="text"
                  value={form.institution_name}
                  onChange={e => setForm(f => ({ ...f, institution_name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F5F7FA] text-sm text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#1565C0]"
                  placeholder="e.g. London Security College"
                />
              </div>
            )}

            {form.type === 'customer' && (
              <div>
                <label className="block text-sm font-semibold text-[#2C3E50] mb-1.5">
                  Discount % <span className="text-gray-400 font-normal">(display only — actual price set in Play Console)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.discount_percent}
                  onChange={e => setForm(f => ({ ...f, discount_percent: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F5F7FA] text-sm text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#1565C0]"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-[#2C3E50] mb-1.5">
                Usage Limit <span className="text-gray-400 font-normal">(-1 = unlimited)</span>
              </label>
              <input
                type="number"
                min={-1}
                value={form.usage_limit}
                onChange={e => setForm(f => ({ ...f, usage_limit: parseInt(e.target.value) || -1 }))}
                className="w-full px-4 py-2.5 rounded-xl bg-[#F5F7FA] text-sm text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#1565C0]"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#1251A3] transition disabled:opacity-60"
              >
                {saving ? 'Creating…' : 'Create Code'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDelete && (
        <Modal title="Delete Promo Code" onClose={() => setShowDelete(null)} size="sm">
          <p className="text-sm text-gray-600 mb-5">
            Are you sure you want to delete <span className="font-mono font-semibold text-[#1565C0]">{showDelete.id}</span>?
            This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDelete(null)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
