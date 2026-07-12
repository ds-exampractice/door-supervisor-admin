import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

interface VersionConfig {
  latestBuild: number
  minBuild: number
  storeUrl: string
}

const DEFAULT: VersionConfig = { latestBuild: 0, minBuild: 0, storeUrl: '' }

function InfoCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#2C3E50]">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function AppSettingsPage() {
  const [config, setConfig] = useState<VersionConfig>(DEFAULT)
  const [form, setForm] = useState<VersionConfig>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const snap = await getDoc(doc(db, 'app_config', 'version'))
      if (snap.exists()) {
        const data = snap.data() as VersionConfig
        setConfig(data)
        setForm(data)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConfig() }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await setDoc(doc(db, 'app_config', 'version'), form)
      setConfig(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // Derive what update status users on any given build would see
  const updatePreview = (build: number) => {
    if (build < form.minBuild) return { label: 'Force update', color: 'text-red-600 bg-red-50 border-red-200' }
    if (build < form.latestBuild) return { label: 'Optional update prompt', color: 'text-amber-600 bg-amber-50 border-amber-200' }
    return { label: 'Up to date', color: 'text-green-600 bg-green-50 border-green-200' }
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl bg-[#F5F7FA] text-sm text-[#2C3E50] border border-transparent focus:outline-none focus:ring-2 focus:ring-[#1565C0] focus:border-[#1565C0] transition'
  const labelCls = 'block text-sm font-semibold text-[#2C3E50] mb-1.5'

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#2C3E50]">App Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Control version gating and update prompts shown to users</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : (
        <>
          {/* Current live values */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <InfoCard label="Latest Build" value={config.latestBuild} sub="Shown as current version" />
            <InfoCard label="Min Build" value={config.minBuild} sub="Below this = force update" />
            <InfoCard
              label="Current App"
              value="1.5.1 (45)"
              sub="Installed version code"
            />
          </div>

          {/* Update preview */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 mb-8">
            <h2 className="text-sm font-bold text-[#2C3E50] mb-4">Update Behaviour Preview</h2>
            <div className="space-y-2">
              {[form.minBuild - 1, form.minBuild, form.latestBuild - 1, form.latestBuild].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map(build => {
                const p = updatePreview(build)
                return (
                  <div key={build} className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm ${p.color}`}>
                    <span className="font-mono font-semibold">Build {build}</span>
                    <span className="font-semibold">{p.label}</span>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Build &lt; minBuild → mandatory (cannot dismiss) · Build &lt; latestBuild → dismissable prompt · Otherwise → no prompt
            </p>
          </div>

          {/* Edit form */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6">
            <h2 className="text-sm font-bold text-[#2C3E50] mb-5">Edit Version Config</h2>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    Latest Build <span className="text-gray-400 font-normal text-xs">(versionCode of newest release)</span>
                  </label>
                  <input
                    type="number" min={0}
                    value={form.latestBuild}
                    onChange={e => setForm(f => ({ ...f, latestBuild: parseInt(e.target.value) || 0 }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Min Build <span className="text-gray-400 font-normal text-xs">(below this = force update)</span>
                  </label>
                  <input
                    type="number" min={0}
                    value={form.minBuild}
                    onChange={e => setForm(f => ({ ...f, minBuild: parseInt(e.target.value) || 0 }))}
                    className={inputCls}
                  />
                </div>
              </div>

              {form.minBuild > form.latestBuild && (
                <p className="text-amber-600 text-sm bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
                  ⚠️ Min build is higher than latest build — all users would be force-updated.
                </p>
              )}

              <div>
                <label className={labelCls}>Play Store URL</label>
                <input
                  type="url"
                  value={form.storeUrl}
                  onChange={e => setForm(f => ({ ...f, storeUrl: e.target.value }))}
                  className={inputCls}
                  placeholder="https://play.google.com/store/apps/details?id=..."
                />
              </div>

              {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl border border-red-200">{error}</p>}

              <div className="flex items-center gap-4 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#1565C0] text-white rounded-xl text-sm font-semibold hover:bg-[#1251A3] transition disabled:opacity-60 shadow-sm"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                {saved && (
                  <span className="text-green-600 text-sm font-semibold flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
