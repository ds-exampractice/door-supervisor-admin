import { useEffect, useState } from 'react'
import {
  collection, getDocs, setDoc, deleteDoc, doc, addDoc,
  query, where,
} from 'firebase/firestore'
import { db } from '../firebase'
import Modal from '../components/Modal'

const MODULES = ['PWPSI', 'PWDSPSI', 'ACMIPSI', 'APISPSI']
const EXAMS   = [1, 2, 3, 4]

const EXAM_RANGES: Record<string, Record<number, [string, string]>> = {
  PWPSI:   { 1: ['0001','0072'], 2: ['0073','0144'], 3: ['0145','0216'], 4: ['0217','0288'] },
  PWDSPSI: { 1: ['0001','0050'], 2: ['0051','0100'], 3: ['0101','0150'], 4: ['0151','0200'] },
  ACMIPSI: { 1: ['0001','0020'], 2: ['0021','0040'], 3: ['0041','0060'], 4: ['0061','0080'] },
  APISPSI: { 1: ['0001','0030'], 2: ['0031','0060'], 3: ['0061','0090'], 4: ['0091','0120'] },
}

interface MockQuestion {
  id: string; Question: string; Options: string[]
  CorrectAnswer: string; Explanation: string; Order: string; imageName?: string
}
interface TrainingQuestion {
  id: string; questionText: string; options: Record<string, string>
  correctAnswer: string; explanation?: string; questionType: string
  learningOutcomeTitle: string; sectionNumber: number; moduleCode: string; chapterNumber: number
}
interface Chapter { id: string; chapterNumber: number; chapterTitle: string }

const BLANK_MOCK: Omit<MockQuestion, 'id'> = {
  Question: '', Options: ['', '', '', ''], CorrectAnswer: 'A', Explanation: '', Order: '', imageName: '',
}
const BLANK_TRAINING: Omit<TrainingQuestion, 'id'> = {
  questionText: '', options: { A: '', B: '', C: '' }, correctAnswer: 'A',
  explanation: '', questionType: 'Foundational',
  learningOutcomeTitle: '', sectionNumber: 1, moduleCode: 'PWPSI', chapterNumber: 1,
}

function AnswerBadge({ letter, isCorrect }: { letter: string; isCorrect: boolean }) {
  return (
    <span className={`answer-badge ${isCorrect ? 'answer-badge-correct' : 'answer-badge-wrong'}`}>
      {letter}
    </span>
  )
}

function Toggle({ active, onChange }: { active: boolean; onChange: () => void }) {
  return <button onClick={onChange} className={`ds-toggle${active ? ' on' : ''}`} aria-pressed={active} />
}

export default function QuestionsPage() {
  const [tab, setTab] = useState<'mock' | 'training'>('mock')

  const [mockModule, setMockModule] = useState('PWPSI')
  const [mockExam, setMockExam] = useState(1)
  const [mockQuestions, setMockQuestions] = useState<MockQuestion[]>([])
  const [mockLoading, setMockLoading] = useState(false)
  const [expandedMock, setExpandedMock] = useState<string | null>(null)

  const [trainModule, setTrainModule] = useState('PWPSI')
  const [trainChapter, setTrainChapter] = useState(1)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [trainQuestions, setTrainQuestions] = useState<TrainingQuestion[]>([])
  const [trainLoading, setTrainLoading] = useState(false)
  const [expandedTrain, setExpandedTrain] = useState<string | null>(null)

  const [editMock, setEditMock] = useState<MockQuestion | null>(null)
  const [editTraining, setEditTraining] = useState<TrainingQuestion | null>(null)
  const [mockForm, setMockForm] = useState<Omit<MockQuestion, 'id'>>(BLANK_MOCK)
  const [trainForm, setTrainForm] = useState<Omit<TrainingQuestion, 'id'>>(BLANK_TRAINING)
  const [showDeleteMock, setShowDeleteMock] = useState<MockQuestion | null>(null)
  const [showDeleteTraining, setShowDeleteTraining] = useState<TrainingQuestion | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  const fetchMock = async () => {
    setMockLoading(true)
    const [start, end] = EXAM_RANGES[mockModule][mockExam]
    const ref = collection(db, 'Module Questions', 'Modules', mockModule, 'Type', 'BIIAB')
    const snap = await getDocs(ref)
    const list = snap.docs
      .filter(d => d.id >= start && d.id <= end)
      .map(d => ({ id: d.id, ...d.data() } as MockQuestion))
      .sort((a, b) => a.Order.localeCompare(b.Order))
    setMockQuestions(list)
    setMockLoading(false)
  }

  const fetchChapters = async () => {
    const snap = await getDocs(collection(db, 'Training Modules', trainModule, 'Chapters'))
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Chapter))
      .sort((a, b) => a.chapterNumber - b.chapterNumber)
    setChapters(list)
    if (list.length > 0) setTrainChapter(list[0].chapterNumber)
  }

  const fetchTraining = async () => {
    setTrainLoading(true)
    // Single-field where avoids composite index requirement; chapter filtered client-side
    const q = query(collection(db, 'Training Questions'), where('moduleCode', '==', trainModule))
    const snap = await getDocs(q)
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as TrainingQuestion))
      .filter(q => q.chapterNumber === trainChapter)
      .sort((a, b) => (a.sectionNumber ?? 0) - (b.sectionNumber ?? 0))
    setTrainQuestions(list)
    setTrainLoading(false)
  }

  useEffect(() => { if (tab === 'mock') fetchMock() }, [mockModule, mockExam, tab])
  useEffect(() => { if (tab === 'training') fetchChapters() }, [trainModule, tab])
  useEffect(() => { if (tab === 'training' && chapters.length > 0) fetchTraining() }, [trainChapter, tab])

  const saveMock = async () => {
    setSaving(true); setModalError('')
    try {
      const isNew = editMock?.id === '__new__'
      const order = mockForm.Order.padStart(4, '0')
      const ref = doc(db, 'Module Questions', 'Modules', mockModule, 'Type', 'BIIAB', isNew ? order : editMock!.id)
      await setDoc(ref, { ...mockForm, Order: isNew ? order : editMock!.id })
      setEditMock(null); await fetchMock()
    } catch (e) { setModalError((e as Error).message) }
    finally { setSaving(false) }
  }

  const saveTraining = async () => {
    setSaving(true); setModalError('')
    try {
      const data = { ...trainForm, moduleCode: trainModule, chapterNumber: trainChapter }
      if (editTraining?.id && editTraining.id !== '__new__') {
        await setDoc(doc(db, 'Training Questions', editTraining.id), data)
      } else {
        await addDoc(collection(db, 'Training Questions'), data)
      }
      setEditTraining(null); await fetchTraining()
    } catch (e) { setModalError((e as Error).message) }
    finally { setSaving(false) }
  }

  const deleteMock = async () => {
    if (!showDeleteMock) return
    await deleteDoc(doc(db, 'Module Questions', 'Modules', mockModule, 'Type', 'BIIAB', showDeleteMock.id))
    setShowDeleteMock(null); await fetchMock()
  }

  const deleteTraining = async () => {
    if (!showDeleteTraining) return
    await deleteDoc(doc(db, 'Training Questions', showDeleteTraining.id))
    setShowDeleteTraining(null); await fetchTraining()
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Questions</h1>
          <p className="page-sub">Manage mock exam and training question banks</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab-btn${tab === 'mock' ? ' active' : ''}`} onClick={() => setTab('mock')}>Mock Exam</button>
        <button className={`tab-btn${tab === 'training' ? ' active' : ''}`} onClick={() => setTab('training')}>Training</button>
      </div>

      {/* ── MOCK TAB ── */}
      {tab === 'mock' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={mockModule} onChange={e => setMockModule(e.target.value)} className="form-select" style={{ width: 'auto' }}>
              {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={mockExam} onChange={e => setMockExam(parseInt(e.target.value))} className="form-select" style={{ width: 'auto' }}>
              {EXAMS.map(n => <option key={n} value={n}>Exam {n}</option>)}
            </select>
            <span style={{ fontSize: 12, color: 'var(--t4)' }}>{mockQuestions.length} questions</span>
            <div style={{ marginLeft: 'auto' }}>
              <button
                className="btn btn-primary"
                onClick={() => { setMockForm({ ...BLANK_MOCK }); setEditMock({ id: '__new__', ...BLANK_MOCK }); setModalError('') }}
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Question
              </button>
            </div>
          </div>

          {mockLoading
            ? <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
            : (
              <div className="card">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr>
                      <th style={{ width: 70 }}>Order</th>
                      <th>Question</th>
                      <th style={{ width: 80 }}>Answer</th>
                      <th style={{ width: 140 }}>Actions</th>
                    </tr></thead>
                    <tbody>
                      {mockQuestions.map(q => (
                        <>
                          <tr
                            key={q.id}
                            onClick={() => setExpandedMock(expandedMock === q.id ? null : q.id)}
                            style={{ cursor: 'pointer' }}
                            className={expandedMock === q.id ? 'row-expanded' : ''}
                          >
                            <td><span className="mono" style={{ color: 'var(--t4)' }}>{q.Order}</span></td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <svg
                                  style={{ width: 14, height: 14, color: 'var(--t4)', flexShrink: 0, transform: expandedMock === q.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480, color: 'var(--t1)' }}>{q.Question}</span>
                              </div>
                            </td>
                            <td><AnswerBadge letter={q.CorrectAnswer} isCorrect={true} /></td>
                            <td onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-sm btn-ghost-blue" onClick={() => { setMockForm({ ...q }); setEditMock(q); setModalError('') }}>Edit</button>
                                <button className="btn btn-sm btn-ghost-red" onClick={() => setShowDeleteMock(q)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                          {expandedMock === q.id && (
                            <tr key={`${q.id}-exp`}>
                              <td style={{ padding: 0, background: '#F8FAFF' }} />
                              <td colSpan={3} style={{ padding: 0, background: '#F8FAFF' }}>
                                <div className="row-detail">
                                  {q.Options.map((opt, i) => {
                                    const letter = ['A','B','C','D'][i]
                                    const correct = q.CorrectAnswer === letter
                                    return (
                                      <div key={letter} className={`detail-option${correct ? ' correct' : ''}`}>
                                        <AnswerBadge letter={letter} isCorrect={correct} />
                                        <span className="detail-option-text">{opt}</span>
                                      </div>
                                    )
                                  })}
                                  {q.Explanation && (
                                    <div className="detail-explanation">
                                      <strong>Explanation: </strong>{q.Explanation}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                      {mockQuestions.length === 0 && (
                        <tr><td colSpan={4}>
                          <div className="empty-state">
                            <div className="empty-state-title">No questions in this range</div>
                            <div className="empty-state-sub">Try a different module or exam number</div>
                          </div>
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          }
        </>
      )}

      {/* ── TRAINING TAB ── */}
      {tab === 'training' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={trainModule} onChange={e => setTrainModule(e.target.value)} className="form-select" style={{ width: 'auto' }}>
              {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={trainChapter} onChange={e => setTrainChapter(parseInt(e.target.value))} className="form-select" style={{ width: 'auto', maxWidth: 260 }}>
              {chapters.map(c => <option key={c.id} value={c.chapterNumber}>Ch {c.chapterNumber} — {c.chapterTitle}</option>)}
            </select>
            <span style={{ fontSize: 12, color: 'var(--t4)' }}>{trainQuestions.length} questions</span>
            <div style={{ marginLeft: 'auto' }}>
              <button
                className="btn btn-primary"
                onClick={() => { setTrainForm({ ...BLANK_TRAINING, moduleCode: trainModule, chapterNumber: trainChapter }); setEditTraining({ id: '__new__', ...BLANK_TRAINING }); setModalError('') }}
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Question
              </button>
            </div>
          </div>

          {trainLoading
            ? <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
            : (
              <div className="card">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr>
                      <th style={{ width: 50 }}>#</th>
                      <th>Question</th>
                      <th style={{ width: 110 }} className="hidden-mobile">Type</th>
                      <th style={{ width: 80 }}>Answer</th>
                      <th style={{ width: 140 }}>Actions</th>
                    </tr></thead>
                    <tbody>
                      {trainQuestions.map(q => (
                        <>
                          <tr
                            key={q.id}
                            onClick={() => setExpandedTrain(expandedTrain === q.id ? null : q.id)}
                            style={{ cursor: 'pointer' }}
                            className={expandedTrain === q.id ? 'row-expanded' : ''}
                          >
                            <td style={{ color: 'var(--t4)', fontSize: 12 }}>{q.sectionNumber}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <svg
                                  style={{ width: 14, height: 14, color: 'var(--t4)', flexShrink: 0, transform: expandedTrain === q.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400, color: 'var(--t1)' }}>{q.questionText}</span>
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${q.questionType === 'Foundational' ? 'badge-sky' : q.questionType === 'Scenario' ? 'badge-amber' : 'badge-purple'}`}>
                                {q.questionType}
                              </span>
                            </td>
                            <td><AnswerBadge letter={q.correctAnswer} isCorrect={true} /></td>
                            <td onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-sm btn-ghost-blue" onClick={() => { setTrainForm({ ...q }); setEditTraining(q); setModalError('') }}>Edit</button>
                                <button className="btn btn-sm btn-ghost-red" onClick={() => setShowDeleteTraining(q)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                          {expandedTrain === q.id && (
                            <tr key={`${q.id}-exp`}>
                              <td style={{ padding: 0, background: '#F8FAFF' }} />
                              <td colSpan={4} style={{ padding: 0, background: '#F8FAFF' }}>
                                <div className="row-detail">
                                  {q.learningOutcomeTitle && (
                                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--t3)', marginBottom: 10 }}>{q.learningOutcomeTitle}</p>
                                  )}
                                  {Object.entries(q.options).sort().map(([letter, text]) => {
                                    const correct = q.correctAnswer === letter
                                    return (
                                      <div key={letter} className={`detail-option${correct ? ' correct' : ''}`}>
                                        <AnswerBadge letter={letter} isCorrect={correct} />
                                        <span className="detail-option-text">{text}</span>
                                      </div>
                                    )
                                  })}
                                  {q.explanation && (
                                    <div className="detail-explanation">
                                      <strong>Explanation: </strong>{q.explanation}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                      {trainQuestions.length === 0 && (
                        <tr><td colSpan={5}>
                          <div className="empty-state">
                            <div className="empty-state-title">No questions in this chapter</div>
                            <div className="empty-state-sub">Add questions or select a different chapter</div>
                          </div>
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          }
        </>
      )}

      {/* ── MOCK EDIT MODAL ── */}
      {editMock && (
        <Modal title={editMock.id === '__new__' ? 'Add Mock Question' : `Edit Question ${editMock.id}`} onClose={() => setEditMock(null)} size="lg">
          <div className="form-section">
            <div className="form-row-2">
              <div className="form-field">
                <label className="form-label">Order (e.g. 0042)</label>
                <input value={mockForm.Order} onChange={e => setMockForm(f => ({ ...f, Order: e.target.value }))}
                  className="form-input" placeholder="0001" disabled={editMock.id !== '__new__'} />
              </div>
              <div className="form-field">
                <label className="form-label">Correct Answer</label>
                <select value={mockForm.CorrectAnswer} onChange={e => setMockForm(f => ({ ...f, CorrectAnswer: e.target.value }))} className="form-select">
                  {['A','B','C','D'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Question</label>
              <textarea rows={3} value={mockForm.Question} onChange={e => setMockForm(f => ({ ...f, Question: e.target.value }))} className="form-textarea" />
            </div>
            <div className="form-row-2">
              {['A','B','C','D'].map((letter, i) => (
                <div key={letter} className="form-field">
                  <label className="form-label">Option {letter}</label>
                  <input value={mockForm.Options[i] ?? ''} onChange={e => setMockForm(f => {
                    const opts = [...f.Options]; opts[i] = e.target.value; return { ...f, Options: opts }
                  })} className="form-input" placeholder={`Option ${letter}`} />
                </div>
              ))}
            </div>
            <div className="form-field">
              <label className="form-label">Explanation</label>
              <textarea rows={2} value={mockForm.Explanation} onChange={e => setMockForm(f => ({ ...f, Explanation: e.target.value }))} className="form-textarea" />
            </div>
            <div className="form-field">
              <label className="form-label">Image Name <span className="form-label-hint">(optional)</span></label>
              <input value={mockForm.imageName ?? ''} onChange={e => setMockForm(f => ({ ...f, imageName: e.target.value }))} className="form-input" placeholder="fire_types.png" />
            </div>
            {modalError && <div className="alert alert-error">{modalError}</div>}
            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditMock(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveMock} disabled={saving}>{saving ? 'Saving…' : 'Save Question'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── TRAINING EDIT MODAL ── */}
      {editTraining && (
        <Modal title={editTraining.id === '__new__' ? 'Add Training Question' : 'Edit Training Question'} onClose={() => setEditTraining(null)} size="lg">
          <div className="form-section">
            <div className="form-row-2">
              <div className="form-field">
                <label className="form-label">Section Number</label>
                <input type="number" value={trainForm.sectionNumber} onChange={e => setTrainForm(f => ({ ...f, sectionNumber: parseInt(e.target.value) || 1 }))} className="form-input" />
              </div>
              <div className="form-field">
                <label className="form-label">Question Type</label>
                <select value={trainForm.questionType} onChange={e => setTrainForm(f => ({ ...f, questionType: e.target.value }))} className="form-select">
                  {['Foundational','Scenario','Deep Learning'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Learning Outcome Title</label>
              <input value={trainForm.learningOutcomeTitle} onChange={e => setTrainForm(f => ({ ...f, learningOutcomeTitle: e.target.value }))} className="form-input" />
            </div>
            <div className="form-field">
              <label className="form-label">Question</label>
              <textarea rows={3} value={trainForm.questionText} onChange={e => setTrainForm(f => ({ ...f, questionText: e.target.value }))} className="form-textarea" />
            </div>
            <div className="form-row-3">
              {['A','B','C'].map(letter => (
                <div key={letter} className="form-field">
                  <label className="form-label">Option {letter}</label>
                  <input value={trainForm.options[letter] ?? ''} onChange={e => setTrainForm(f => ({ ...f, options: { ...f.options, [letter]: e.target.value } }))} className="form-input" />
                </div>
              ))}
            </div>
            <div className="form-field">
              <label className="form-label">Correct Answer</label>
              <select value={trainForm.correctAnswer} onChange={e => setTrainForm(f => ({ ...f, correctAnswer: e.target.value }))} className="form-select">
                {['A','B','C'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Explanation</label>
              <textarea rows={2} value={trainForm.explanation ?? ''} onChange={e => setTrainForm(f => ({ ...f, explanation: e.target.value }))} className="form-textarea" />
            </div>
            {modalError && <div className="alert alert-error">{modalError}</div>}
            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditTraining(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveTraining} disabled={saving}>{saving ? 'Saving…' : 'Save Question'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirmations */}
      {showDeleteMock && (
        <Modal title="Delete Question" onClose={() => setShowDeleteMock(null)} size="sm">
          <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 20, lineHeight: 1.6 }}>
            Delete question <span className="mono" style={{ fontWeight: 700 }}>{showDeleteMock.Order}</span>? This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowDeleteMock(null)}>Cancel</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={deleteMock}>Delete</button>
          </div>
        </Modal>
      )}
      {showDeleteTraining && (
        <Modal title="Delete Question" onClose={() => setShowDeleteTraining(null)} size="sm">
          <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 20, lineHeight: 1.6 }}>
            Delete this training question? This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowDeleteTraining(null)}>Cancel</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={deleteTraining}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
