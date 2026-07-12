import { useEffect, useState } from 'react'
import {
  collection, getDocs, setDoc, deleteDoc, doc, addDoc,
  query, where,
} from 'firebase/firestore'
// query and where used in fetchTraining for single-field filter
import { db } from '../firebase'
import Modal from '../components/Modal'

const MODULES = ['PWPSI', 'PWDSPSI', 'ACMIPSI', 'APISPSI']
const EXAMS = [1, 2, 3, 4]

const EXAM_RANGES: Record<string, Record<number, [string, string]>> = {
  PWPSI:   { 1: ['0001','0072'], 2: ['0073','0144'], 3: ['0145','0216'], 4: ['0217','0288'] },
  PWDSPSI: { 1: ['0001','0050'], 2: ['0051','0100'], 3: ['0101','0150'], 4: ['0151','0200'] },
  ACMIPSI: { 1: ['0001','0020'], 2: ['0021','0040'], 3: ['0041','0060'], 4: ['0061','0080'] },
  APISPSI: { 1: ['0001','0030'], 2: ['0031','0060'], 3: ['0061','0090'], 4: ['0091','0120'] },
}

interface MockQuestion {
  id: string
  Question: string
  Options: string[]
  CorrectAnswer: string
  Explanation: string
  Order: string
  imageName?: string
}

interface TrainingQuestion {
  id: string
  questionText: string
  options: Record<string, string>
  correctAnswer: string
  explanation?: string
  questionType: string
  learningOutcomeTitle: string
  sectionNumber: number
  moduleCode: string
  chapterNumber: number
}

interface Chapter { id: string; chapterNumber: number; chapterTitle: string }

const BLANK_MOCK: Omit<MockQuestion, 'id'> = {
  Question: '', Options: ['', '', '', ''],
  CorrectAnswer: 'A', Explanation: '', Order: '', imageName: '',
}

const BLANK_TRAINING: Omit<TrainingQuestion, 'id'> = {
  questionText: '', options: { A: '', B: '', C: '' },
  correctAnswer: 'A', explanation: '', questionType: 'Foundational',
  learningOutcomeTitle: '', sectionNumber: 1, moduleCode: 'PWPSI', chapterNumber: 1,
}

const inputCls = 'w-full px-4 py-3.5 rounded-xl bg-[#F5F7FA] text-sm text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#1565C0] border border-gray-200 focus:border-[#1565C0]'
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2'

function AnswerBadge({ letter, isCorrect }: { letter: string; isCorrect: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0
      ${isCorrect ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'bg-gray-100 text-gray-500'}`}>
      {letter}
    </span>
  )
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
    // Single-field where avoids the composite index requirement; chapter filtered client-side
    const q = query(
      collection(db, 'Training Questions'),
      where('moduleCode', '==', trainModule),
    )
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
      setEditMock(null)
      await fetchMock()
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
      setEditTraining(null)
      await fetchTraining()
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

  const selectCls = 'px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#1565C0] shadow-sm'

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#2C3E50]">Questions</h1>
        <p className="text-sm text-gray-400 mt-1">Manage mock exam and training question banks</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 w-fit shadow-sm border border-gray-100">
        {(['mock', 'training'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition
              ${tab === t ? 'bg-[#1565C0] text-white shadow-sm' : 'text-gray-500 hover:text-[#2C3E50]'}`}>
            {t === 'mock' ? 'Mock Exam' : 'Training'}
          </button>
        ))}
      </div>

      {/* ── MOCK TAB ── */}
      {tab === 'mock' && (
        <>
          <div className="flex gap-3 mb-5 flex-wrap items-center">
            <select value={mockModule} onChange={e => setMockModule(e.target.value)} className={selectCls}>
              {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={mockExam} onChange={e => setMockExam(parseInt(e.target.value))} className={selectCls}>
              {EXAMS.map(n => <option key={n} value={n}>Exam {n}</option>)}
            </select>
            <span className="text-xs text-gray-400 ml-1">{mockQuestions.length} questions</span>
            <button
              onClick={() => { setMockForm({ ...BLANK_MOCK }); setEditMock({ id: '__new__', ...BLANK_MOCK }); setModalError('') }}
              className="ml-auto px-4 py-2.5 bg-[#1565C0] text-white rounded-xl text-sm font-semibold hover:bg-[#1251A3] transition shadow-sm">
              + Add Question
            </button>
          </div>

          {mockLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-6 py-4 font-semibold w-16">Order</th>
                    <th className="text-left px-6 py-4 font-semibold">Question</th>
                    <th className="text-left px-6 py-4 font-semibold w-20">Answer</th>
                    <th className="text-left px-6 py-4 font-semibold w-36">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mockQuestions.map(q => (
                    <>
                      <tr
                        key={q.id}
                        onClick={() => setExpandedMock(expandedMock === q.id ? null : q.id)}
                        className="border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition"
                      >
                        <td className="px-6 py-5 font-mono text-gray-500 text-xs">{q.Order}</td>
                        <td className="px-6 py-5 text-[#2C3E50]">
                          <div className="flex items-center gap-2">
                            <svg className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform ${expandedMock === q.id ? 'rotate-90' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="truncate max-w-xs md:max-w-md">{q.Question}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <AnswerBadge letter={q.CorrectAnswer} isCorrect={true} />
                        </td>
                        <td className="px-6 py-5" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <button onClick={() => { setMockForm({ ...q }); setEditMock(q); setModalError('') }}
                              className="text-[#1565C0] text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-50 border border-blue-100 transition">Edit</button>
                            <button onClick={() => setShowDeleteMock(q)}
                              className="text-red-500 text-sm font-semibold px-3 py-2 rounded-lg hover:bg-red-50 border border-red-100 transition">Delete</button>
                          </div>
                        </td>
                      </tr>
                      {expandedMock === q.id && (
                        <tr key={`${q.id}-exp`} className="bg-blue-50/20 border-b border-gray-100">
                          <td />
                          <td colSpan={3} className="px-5 py-4">
                            <div className="space-y-2">
                              {q.Options.map((opt, i) => {
                                const letter = ['A','B','C','D'][i]
                                const isCorrect = q.CorrectAnswer === letter
                                return (
                                  <div key={letter} className={`flex items-start gap-3 px-3 py-2 rounded-xl text-sm
                                    ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-100'}`}>
                                    <AnswerBadge letter={letter} isCorrect={isCorrect} />
                                    <span className={isCorrect ? 'text-green-800 font-medium' : 'text-gray-600'}>{opt}</span>
                                  </div>
                                )
                              })}
                              {q.Explanation && (
                                <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                                  <span className="font-semibold">Explanation: </span>{q.Explanation}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {mockQuestions.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-12 text-gray-400">No questions in this range</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── TRAINING TAB ── */}
      {tab === 'training' && (
        <>
          <div className="flex gap-3 mb-5 flex-wrap items-center">
            <select value={trainModule} onChange={e => setTrainModule(e.target.value)} className={selectCls}>
              {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={trainChapter} onChange={e => setTrainChapter(parseInt(e.target.value))} className={selectCls}>
              {chapters.map(c => <option key={c.id} value={c.chapterNumber}>Ch {c.chapterNumber} — {c.chapterTitle}</option>)}
            </select>
            <span className="text-xs text-gray-400 ml-1">{trainQuestions.length} questions</span>
            <button
              onClick={() => { setTrainForm({ ...BLANK_TRAINING, moduleCode: trainModule, chapterNumber: trainChapter }); setEditTraining({ id: '__new__', ...BLANK_TRAINING }); setModalError('') }}
              className="ml-auto px-4 py-2.5 bg-[#1565C0] text-white rounded-xl text-sm font-semibold hover:bg-[#1251A3] transition shadow-sm">
              + Add Question
            </button>
          </div>

          {trainLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-6 py-4 font-semibold w-10">#</th>
                    <th className="text-left px-6 py-4 font-semibold">Question</th>
                    <th className="text-left px-6 py-4 font-semibold w-28 hidden md:table-cell">Type</th>
                    <th className="text-left px-6 py-4 font-semibold w-20">Answer</th>
                    <th className="text-left px-6 py-4 font-semibold w-36">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trainQuestions.map(q => (
                    <>
                      <tr
                        key={q.id}
                        onClick={() => setExpandedTrain(expandedTrain === q.id ? null : q.id)}
                        className="border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition"
                      >
                        <td className="px-6 py-5 text-gray-400 text-xs">{q.sectionNumber}</td>
                        <td className="px-6 py-5 text-[#2C3E50]">
                          <div className="flex items-center gap-2">
                            <svg className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform ${expandedTrain === q.id ? 'rotate-90' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="truncate max-w-xs md:max-w-md">{q.questionText}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-xs text-gray-500 hidden md:table-cell">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                            ${q.questionType === 'Foundational' ? 'bg-blue-50 text-blue-600' :
                              q.questionType === 'Scenario' ? 'bg-orange-50 text-orange-600' :
                              'bg-purple-50 text-purple-600'}`}>
                            {q.questionType}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <AnswerBadge letter={q.correctAnswer} isCorrect={true} />
                        </td>
                        <td className="px-6 py-5" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <button onClick={() => { setTrainForm({ ...q }); setEditTraining(q); setModalError('') }}
                              className="text-[#1565C0] text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-50 border border-blue-100 transition">Edit</button>
                            <button onClick={() => setShowDeleteTraining(q)}
                              className="text-red-500 text-sm font-semibold px-3 py-2 rounded-lg hover:bg-red-50 border border-red-100 transition">Delete</button>
                          </div>
                        </td>
                      </tr>
                      {expandedTrain === q.id && (
                        <tr key={`${q.id}-exp`} className="bg-blue-50/20 border-b border-gray-100">
                          <td />
                          <td colSpan={4} className="px-5 py-4">
                            {q.learningOutcomeTitle && (
                              <p className="text-xs text-gray-500 mb-3 font-medium">{q.learningOutcomeTitle}</p>
                            )}
                            <div className="space-y-2">
                              {Object.entries(q.options).sort().map(([letter, text]) => {
                                const isCorrect = q.correctAnswer === letter
                                return (
                                  <div key={letter} className={`flex items-start gap-3 px-3 py-2 rounded-xl text-sm
                                    ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-100'}`}>
                                    <AnswerBadge letter={letter} isCorrect={isCorrect} />
                                    <span className={isCorrect ? 'text-green-800 font-medium' : 'text-gray-600'}>{text}</span>
                                  </div>
                                )
                              })}
                              {q.explanation && (
                                <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                                  <span className="font-semibold">Explanation: </span>{q.explanation}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {trainQuestions.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-12 text-gray-400">No questions in this chapter</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── MOCK EDIT MODAL ── */}
      {editMock && (
        <Modal title={editMock.id === '__new__' ? 'Add Mock Question' : `Edit Question ${editMock.id}`} onClose={() => setEditMock(null)} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Order (e.g. 0042)</label>
                <input value={mockForm.Order} onChange={e => setMockForm(f => ({ ...f, Order: e.target.value }))}
                  className={inputCls} placeholder="0001" disabled={editMock.id !== '__new__'} />
              </div>
              <div>
                <label className={labelCls}>Correct Answer</label>
                <select value={mockForm.CorrectAnswer} onChange={e => setMockForm(f => ({ ...f, CorrectAnswer: e.target.value }))}
                  className={inputCls}>
                  {['A','B','C','D'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Question</label>
              <textarea rows={3} value={mockForm.Question} onChange={e => setMockForm(f => ({ ...f, Question: e.target.value }))}
                className={`${inputCls} resize-none`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['A','B','C','D'].map((letter, i) => (
                <div key={letter}>
                  <label className={labelCls}>Option {letter}</label>
                  <input value={mockForm.Options[i] ?? ''} onChange={e => setMockForm(f => {
                    const opts = [...f.Options]; opts[i] = e.target.value; return { ...f, Options: opts }
                  })} className={inputCls} placeholder={`Option ${letter}`} />
                </div>
              ))}
            </div>
            <div>
              <label className={labelCls}>Explanation</label>
              <textarea rows={2} value={mockForm.Explanation} onChange={e => setMockForm(f => ({ ...f, Explanation: e.target.value }))}
                className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className={labelCls}>Image Name (optional)</label>
              <input value={mockForm.imageName ?? ''} onChange={e => setMockForm(f => ({ ...f, imageName: e.target.value }))}
                className={inputCls} placeholder="fire_types.png" />
            </div>
            {modalError && <p className="text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl">{modalError}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditMock(null)}
                className="flex-1 py-3.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={saveMock} disabled={saving}
                className="flex-1 py-3.5 rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#1251A3] transition disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── TRAINING EDIT MODAL ── */}
      {editTraining && (
        <Modal title={editTraining.id === '__new__' ? 'Add Training Question' : 'Edit Training Question'} onClose={() => setEditTraining(null)} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Section Number</label>
                <input type="number" value={trainForm.sectionNumber}
                  onChange={e => setTrainForm(f => ({ ...f, sectionNumber: parseInt(e.target.value) || 1 }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Question Type</label>
                <select value={trainForm.questionType} onChange={e => setTrainForm(f => ({ ...f, questionType: e.target.value }))}
                  className={inputCls}>
                  {['Foundational','Scenario','Deep Learning'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Learning Outcome Title</label>
              <input value={trainForm.learningOutcomeTitle}
                onChange={e => setTrainForm(f => ({ ...f, learningOutcomeTitle: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Question</label>
              <textarea rows={3} value={trainForm.questionText}
                onChange={e => setTrainForm(f => ({ ...f, questionText: e.target.value }))}
                className={`${inputCls} resize-none`} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {['A','B','C'].map(letter => (
                <div key={letter}>
                  <label className={labelCls}>Option {letter}</label>
                  <input value={trainForm.options[letter] ?? ''}
                    onChange={e => setTrainForm(f => ({ ...f, options: { ...f.options, [letter]: e.target.value } }))}
                    className={inputCls} />
                </div>
              ))}
            </div>
            <div>
              <label className={labelCls}>Correct Answer</label>
              <select value={trainForm.correctAnswer} onChange={e => setTrainForm(f => ({ ...f, correctAnswer: e.target.value }))}
                className={inputCls}>
                {['A','B','C'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Explanation</label>
              <textarea rows={2} value={trainForm.explanation ?? ''}
                onChange={e => setTrainForm(f => ({ ...f, explanation: e.target.value }))}
                className={`${inputCls} resize-none`} />
            </div>
            {modalError && <p className="text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl">{modalError}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditTraining(null)}
                className="flex-1 py-3.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={saveTraining} disabled={saving}
                className="flex-1 py-3.5 rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#1251A3] transition disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirmations */}
      {showDeleteMock && (
        <Modal title="Delete Question" onClose={() => setShowDeleteMock(null)} size="sm">
          <p className="text-sm text-gray-600 mb-5">Delete question <span className="font-mono font-semibold">{showDeleteMock.Order}</span>? This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteMock(null)} className="flex-1 py-3.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={deleteMock} className="flex-1 py-3.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">Delete</button>
          </div>
        </Modal>
      )}
      {showDeleteTraining && (
        <Modal title="Delete Question" onClose={() => setShowDeleteTraining(null)} size="sm">
          <p className="text-sm text-gray-600 mb-5">Delete this training question? This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteTraining(null)} className="flex-1 py-3.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={deleteTraining} className="flex-1 py-3.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
