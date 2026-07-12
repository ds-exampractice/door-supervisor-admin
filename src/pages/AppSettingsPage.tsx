import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

interface VersionConfig { latestBuild: number; minBuild: number; storeUrl: string }
interface Announcement { message: string; active: boolean; type: 'info' | 'warning' | 'maintenance' }

const DEFAULT: VersionConfig     = { latestBuild: 0, minBuild: 0, storeUrl: '' }
const DEFAULT_ANN: Announcement  = { message: '', active: false, type: 'info' }

function Toggle({ active, onChange }: { active: boolean; onChange: () => void }) {
  return <button onClick={onChange} className={`ds-toggle${active ? ' on' : ''}`} aria-pressed={active} />
}

export default function AppSettingsPage() {
  const [config, setConfig] = useState<VersionConfig>(DEFAULT)
  const [form, setForm] = useState<VersionConfig>(DEFAULT)
  const [ann, setAnn] = useState<Announcement>(DEFAULT_ANN)
  const [annForm, setAnnForm] = useState<Announcement>(DEFAULT_ANN)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [annSaving, setAnnSaving] = useState(false)
  const [annSaved, setAnnSaved] = useState(false)
  const [error, setError] = useState('')
  const [annError, setAnnError] = useState('')

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const [versionSnap, annSnap] = await Promise.all([
        getDoc(doc(db, 'app_config', 'version')),
        getDoc(doc(db, 'app_config', 'announcement')),
      ])
      if (versionSnap.exists()) { const d = versionSnap.data() as VersionConfig; setConfig(d); setForm(d) }
      if (annSnap.exists())     { const d = annSnap.data() as Announcement;       setAnn(d);    setAnnForm(d) }
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchConfig() }, [])

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      await setDoc(doc(db, 'app_config', 'version'), form)
      setConfig(form); setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleAnnSave = async () => {
    setAnnSaving(true); setAnnError(''); setAnnSaved(false)
    try {
      await setDoc(doc(db, 'app_config', 'announcement'), annForm)
      setAnn(annForm); setAnnSaved(true)
      setTimeout(() => setAnnSaved(false), 3000)
    } catch (e) { setAnnError((e as Error).message) }
    finally { setAnnSaving(false) }
  }

  const updatePreview = (build: number) => {
    if (build < form.minBuild)    return { label: 'Force update',        cls: 'badge-red' }
    if (build < form.latestBuild) return { label: 'Optional update',     cls: 'badge-amber' }
    return                               { label: 'Up to date',          cls: 'badge-green' }
  }

  const annColor = annForm.type === 'warning' ? 'var(--amber)' : annForm.type === 'maintenance' ? 'var(--red)' : 'var(--brand)'

  if (loading) {
    return (
      <div className="page-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
          <div className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">App Settings</h1>
          <p className="page-sub">Version gating, update prompts, and in-app announcements</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
        {/* Version config card */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Version Configuration</div>
              <div className="card-sub">Controls which builds trigger update prompts</div>
            </div>
          </div>
          <div className="card-body">
            {/* Live values summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Latest Build', value: config.latestBuild, sub: 'Current release' },
                { label: 'Min Build', value: config.minBuild, sub: 'Below → force update' },
                { label: 'App Version', value: '1.5.2 (46)', sub: 'Currently installed' },
              ].map(c => (
                <div key={c.label} style={{
                  padding: '12px 16px', borderRadius: 'var(--r2)',
                  background: 'var(--bg-muted)', border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t4)', marginBottom: 6 }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', fontVariantNumeric: 'tabular-nums' }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 3 }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Update preview */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--t4)', marginBottom: 10 }}>
                Update Behaviour Preview
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[form.minBuild - 1, form.minBuild, form.latestBuild - 1, form.latestBuild]
                  .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
                  .map(build => {
                    const p = updatePreview(build)
                    return (
                      <div key={build} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 'var(--r2)',
                        border: '1px solid var(--border)', background: 'var(--bg-surface)',
                      }}>
                        <span className="mono" style={{ fontWeight: 600, color: 'var(--t2)', fontSize: 13 }}>Build {build}</span>
                        <span className={`badge ${p.cls}`}>{p.label}</span>
                      </div>
                    )
                  })}
              </div>
              <p style={{ fontSize: 11, color: 'var(--t4)', marginTop: 10 }}>
                build &lt; minBuild → mandatory (undismissable) &nbsp;·&nbsp; build &lt; latestBuild → optional prompt
              </p>
            </div>

            {/* Form */}
            <div className="form-section">
              <div className="form-row-2">
                <div className="form-field">
                  <label className="form-label">Latest Build <span className="form-label-hint">(versionCode)</span></label>
                  <input type="number" min={0} value={form.latestBuild}
                    onChange={e => setForm(f => ({ ...f, latestBuild: parseInt(e.target.value) || 0 }))}
                    className="form-input" />
                </div>
                <div className="form-field">
                  <label className="form-label">Min Build <span className="form-label-hint">(below → force)</span></label>
                  <input type="number" min={0} value={form.minBuild}
                    onChange={e => setForm(f => ({ ...f, minBuild: parseInt(e.target.value) || 0 }))}
                    className="form-input" />
                </div>
              </div>

              {form.minBuild > form.latestBuild && (
                <div className="alert alert-warning">
                  Min build exceeds latest build — all users would be force-updated.
                </div>
              )}

              <div className="form-field">
                <label className="form-label">Play Store URL</label>
                <input type="url" value={form.storeUrl}
                  onChange={e => setForm(f => ({ ...f, storeUrl: e.target.value }))}
                  className="form-input" placeholder="https://play.google.com/store/apps/details?id=…" />
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Version Config'}
                </button>
                {saved && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Announcement card */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">In-App Announcement</div>
              <div className="card-sub">Shown as a dismissable dialog when users open the app</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: annForm.active ? 'var(--green)' : 'var(--t4)', fontWeight: 600 }}>
                {annForm.active ? 'Live' : 'Off'}
              </span>
              <Toggle active={annForm.active} onChange={() => setAnnForm(f => ({ ...f, active: !f.active }))} />
            </div>
          </div>
          <div className="card-body">
            <div className="form-section">
              <div className="form-field">
                <label className="form-label">Type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['info', 'warning', 'maintenance'] as const).map(t => (
                    <button key={t} onClick={() => setAnnForm(f => ({ ...f, type: t }))}
                      className="btn btn-sm"
                      style={{
                        background: annForm.type === t ? annColor : 'var(--bg-muted)',
                        color: annForm.type === t ? '#fff' : 'var(--t3)',
                        border: `1.5px solid ${annForm.type === t ? annColor : 'var(--border)'}`,
                        textTransform: 'capitalize',
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">Message</label>
                <textarea rows={3} value={annForm.message}
                  onChange={e => setAnnForm(f => ({ ...f, message: e.target.value }))}
                  className="form-textarea"
                  placeholder="e.g. We're updating our question bank this weekend. Some questions may be temporarily unavailable." />
              </div>

              {annForm.active && annForm.message && (
                <div style={{
                  padding: '12px 16px', borderRadius: 'var(--r2)',
                  borderLeft: `3px solid ${annColor}`,
                  background: annForm.type === 'warning' ? 'var(--amber-bg)' : annForm.type === 'maintenance' ? 'var(--red-bg)' : 'var(--brand-subtle)',
                  border: `1px solid ${annForm.type === 'warning' ? 'var(--amber-bd)' : annForm.type === 'maintenance' ? 'var(--red-bd)' : 'var(--brand-border)'}`,
                }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: annColor, marginBottom: 5 }}>
                    Preview — {annForm.type}
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>{annForm.message}</p>
                </div>
              )}

              {annError && <div className="alert alert-error">{annError}</div>}

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button className="btn btn-primary" onClick={handleAnnSave} disabled={annSaving}>
                  {annSaving ? 'Saving…' : 'Save Announcement'}
                </button>
                {annSaved && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
