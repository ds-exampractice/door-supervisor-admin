import { useEffect, useState } from 'react'
import {
  collection, getDocs, setDoc, deleteDoc, doc, addDoc,
  query, where,
} from 'firebase/firestore'
import { db } from '../firebase'
import Modal from '../components/Modal'

const MODULES = ['PWPSI', 'PWDSPSI', 'ACMIPSI', 'APISPSI']
const EXAMS = [1, 2, 3, 4]

// Order ranges per module per exam — matches ExamPage ranges in the Flutter app
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
  Question: '', Options: ['A. ', 'B. ', 'C. ', 'D. '],
  CorrectAnswer: 'A', Explanation: '', Order: '', imageName: '',
}

const BLANK_TRAINING: Omit<TrainingQuestion, 'id'> = {
  questionText: '', options: { A: '', B: '', C: '' },
  correctAnswer: 'A', explanation: '', questionType: 'Foundational',
  learningOutcomeTitle: '', sectionNumber: 1, moduleCode: 'PWPSI', chapterNumber: 1,
}

export default function QuestionsPage() {
  const [tab, setTab] = useState<'mock' | 'training'>('mock')

  // Mock state
  const [mockModule, setMockModule] = useState('PWPSI')
  const [mockExam, setMockExam] = useState(1)
  const [mockQuestions, setMockQuestions] = useState<MockQuestion[]>([])
  const [mockLoading, setMockLoading] = useState(false)

  // Training state
  const [trainModule, setTrainModule] = useState('PWPSI')
  const [trainChapter, setTrainChapter] = useState(1)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [trainQuestions, setTrainQuestions] = useState<TrainingQuestion[]>([])
  const [trainLoading, setTrainLoading] = useState(false)

  // Modal state
  const [editMock, setEditMock] = useState<MockQuestion | null>(null)
  const [editTraining, setEditTraining] = useState<TrainingQuestion | null>(null)
  const [mockForm, setMockForm] = useState<Omit<MockQuestion, 'id'>>(BLANK_MOCK)
  const [trainForm, setTrainForm] = useState<Omit<TrainingQuestion, 'id'>>(BLANK_TRAINING)
  const [showDeleteMock, setShowDeleteMock] = useState<MockQuestion | null>(null)
  const [showDeleteTraining, setShowDeleteTraining] = useState<TrainingQuestion | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  // Fetch mock questions for selected module + exam
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

  // Fetch chapters for selected training module
  const fetchChapters = async () => {
    const snap = await getDocs(collection(db, 'Training Modules', trainModule, 'Chapters'))
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Chapter))
      .sort((a, b) => a.chapterNumber - b.chapterNumber)
    setChapters(list)
    if (list.length > 0) setTrainChapter(list[0].chapterNumber)
  }

  // Fetch training questions for selected module + chapter.
  // Client-side sort avoids requiring a composite Firestore index on
  // (moduleCode, chapterNumber, sectionNumber).
  const fetchTraining = async () => {
    setTrainLoading(true)
    const q = query(
      collection(db, 'Training Questions'),
      where('moduleCode', '==', trainModule),
      where('chapterNumber', '==', trainChapter),
    )
    const snap = await getDocs(q)
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as TrainingQuestion))
      .sort((a, b) => (a.sectionNumber ?? 0) - (b.sectionNumber ?? 0))
    setTrainQuestions(list)
    setTrainLoading(false)
  }

  useEffect(() => { if (tab === 'mock') fetchMock() }, [mockModule, mockExam, tab])
  useEffect(() => { if (tab === 'training') fetchChapters() }, [trainModule, tab])
  useEffect(() => { if (tab === 'training' && chapters.length > 0) fetchTraining() }, [trainChapter, tab])

  // Mock save
  const saveMock = async () => {
    setSaving(true); setModalError('')
    try {
      const order = mockForm.Order.padStart(4, '0')
      const ref = doc(db, 'Module Questions', 'Modules', mockModule, 'Type', 'BIIAB', order)
      await setDoc(ref, { ...mockForm, Order: order })
      setEditMock(null)
      await fetchMock()
    } catch (e) { setModalError((e as Error).message) }
    finally { setSaving(false) }
  }

  // Training save
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

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-[#2C3E50] mb-6">Questions</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 w-fit shadow-sm border border-gray-100">
        {(['mock', 'training'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition capitalize
              ${tab === t ? 'bg-[#1565C0] text-white' : 'text-gray-500 hover:text-[#2C3E50]'}`}>
            {t === 'mock' ? 'Mock Exam' : 'Training'}
          </button>
        ))}
      </div>

      {tab === 'mock' && (
        <>
          <div className="flex gap-3 mb-5 flex-wrap">
            <select value={mockModule} onChange={e => setMockModule(e.target.value)}
              className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#1565C0]">
              {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={mockExam} onChange={e => setMockExam(parseInt(e.target.value))}
              className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#1565C0]">
              {EXAMS.map(n => <option key={n} value={n}>Exam {n}</option>)}
            </select>
            <button
              onClick={() => { setMockForm({ ...BLANK_MOCK }); setEditMock({ id: '__new__', ...BLANK_MOCK }); setModalError('') }}
              className="ml-auto px-4 py-2 bg-[#1565C0] text-white rounded-xl text-sm font-semibold hover:bg-[#1251A3] transition">
              + Add Question
            </button>
          </div>

          {mockLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-5 py-3 font-semibold w-16">Order</th>
                    <th className="text-left px-5 py-3 font-semibold">Question</th>
                    <th className="text-left px-5 py-3 font-semibold w-24">Answer</th>
                    <th className="text-left px-5 py-3 font-semibold w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mockQuestions.map(q => (
                    <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-mono text-gray-500">{q.Order}</td>
                      <td className="px-5 py-3 text-[#2C3E50] max-w-md truncate">{q.Question}</td>
                      <td className="px-5 py-3 font-semibold text-[#1565C0]">{q.CorrectAnswer}</td>
                      <td className="px-5 py-3 flex gap-3">
                        <button onClick={() => { setMockForm({ ...q }); setEditMock(q); setModalError('') }}
                          className="text-[#1565C0] hover:underline text-xs font-semibold">Edit</button>
                        <button onClick={() => setShowDeleteMock(q)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {mockQuestions.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-10 text-gray-400">No questions in this range</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'training' && (
        <>
          <div className="flex gap-3 mb-5 flex-wrap">
            <select value={trainModule} onChange={e => setTrainModule(e.target.value)}
              className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#1565C0]">
              {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={trainChapter} onChange={e => setTrainChapter(parseInt(e.target.value))}
              className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#1565C0]">
              {chapters.map(c => <option key={c.id} value={c.chapterNumber}>Chapter {c.chapterNumber} — {c.chapterTitle}</option>)}
            </select>
            <button
              onClick={() => { setTrainForm({ ...BLANK_TRAINING, moduleCode: trainModule, chapterNumber: trainChapter }); setEditTraining({ id: '__new__', ...BLANK_TRAINING }); setModalError('') }}
              className="ml-auto px-4 py-2 bg-[#1565C0] text-white rounded-xl text-sm font-semibold hover:bg-[#1251A3] transition">
              + Add Question
            </button>
          </div>

          {trainLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-5 py-3 font-semibold w-8">#</th>
                    <th className="text-left px-5 py-3 font-semibold">Question</th>
                    <th className="text-left px-5 py-3 font-semibold w-28">Type</th>
                    <th className="text-left px-5 py-3 font-semibold w-20">Answer</th>
                    <th className="text-left px-5 py-3 font-semibold w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trainQuestions.map(q => (
                    <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3 text-gray-400">{q.sectionNumber}</td>
                      <td className="px-5 py-3 text-[#2C3E50] max-w-md truncate">{q.questionText}</td>
                      <td className="px-5 py-3 text-xs text-gray-500">{q.questionType}</td>
                      <td className="px-5 py-3 font-semibold text-[#1565C0]">{q.correctAnswer}</td>
                      <td className="px-5 py-3 flex gap-3">
                        <button onClick={() => { setTrainForm({ ...q }); setEditTraining(q); setModalError('') }}
                          className="text-[#1565C0] hover:underline text-xs font-semibold">Edit</button>
                        <button onClick={() => setShowDeleteTraining(q)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {trainQuestions.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-10 text-gray-400">No questions in this chapter</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Mock Question Modal */}
      {editMock && (
        <Modal title={editMock.id === '__new__' ? 'Add Mock Question' : 'Edit Mock Question'} onClose={() => setEditMock(null)} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Order (e.g. 0042)</label>
                <input value={mockForm.Order} onChange={e => setMockForm(f => ({ ...f, Order: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#1565C0]"
                  placeholder="0001" disabled={editMock.id !== '__new__'} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Correct Answer</label>
                <select value={mockForm.CorrectAnswer} onChange={e => setMockForm(f => ({ ...f, CorrectAnswer: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#1565C0]">
                  {['A','B','C','D'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Question</label>
              <textarea rows={3} value={mockForm.Question} onChange={e => setMockForm(f => ({ ...f, Question: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1565C0]" />
            </div>
            {['A','B','C','D'].map((letter, i) => (
              <div key={letter}>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Option {letter}</label>
                <input value={mockForm.Options[i]} onChange={e => setMockForm(f => {
                  const opts = [...f.Options]; opts[i] = e.target.value; return { ...f, Options: opts }
                })} className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#1565C0]"
                  placeholder={`${letter}. `} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Explanation</label>
              <textarea rows={2} value={mockForm.Explanation} onChange={e => setMockForm(f => ({ ...f, Explanation: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1565C0]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Image Name (optional)</label>
              <input value={mockForm.imageName ?? ''} onChange={e => setMockForm(f => ({ ...f, imageName: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#1565C0]"
                placeholder="fire_types.png" />
            </div>
            {modalError && <p className="text-red-600 text-sm">{modalError}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditMock(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={saveMock} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#1251A3] transition disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Training Question Modal */}
      {editTraining && (
        <Modal title={editTraining.id === '__new__' ? 'Add Training Question' : 'Edit Training Question'} onClose={() => setEditTraining(null)} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Section Number</label>
                <input type="number" value={trainForm.sectionNumber} onChange={e => setTrainForm(f => ({ ...f, sectionNumber: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#1565C0]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Question Type</label>
                <select value={trainForm.questionType} onChange={e => setTrainForm(f => ({ ...f, questionType: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#1565C0]">
                  {['Foundational','Scenario','Deep Learning'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Learning Outcome Title</label>
              <input value={trainForm.learningOutcomeTitle} onChange={e => setTrainForm(f => ({ ...f, learningOutcomeTitle: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#1565C0]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Question</label>
              <textarea rows={3} value={trainForm.questionText} onChange={e => setTrainForm(f => ({ ...f, questionText: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1565C0]" />
            </div>
            {['A','B','C'].map(letter => (
              <div key={letter}>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Option {letter}</label>
                <input value={trainForm.options[letter] ?? ''} onChange={e => setTrainForm(f => ({ ...f, options: { ...f.options, [letter]: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#1565C0]" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Correct Answer</label>
              <select value={trainForm.correctAnswer} onChange={e => setTrainForm(f => ({ ...f, correctAnswer: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#1565C0]">
                {['A','B','C'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Explanation</label>
              <textarea rows={2} value={trainForm.explanation ?? ''} onChange={e => setTrainForm(f => ({ ...f, explanation: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F7FA] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1565C0]" />
            </div>
            {modalError && <p className="text-red-600 text-sm">{modalError}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditTraining(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={saveTraining} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#1251A3] transition disabled:opacity-60">
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
            <button onClick={() => setShowDeleteMock(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
            <button onClick={deleteMock} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">Delete</button>
          </div>
        </Modal>
      )}
      {showDeleteTraining && (
        <Modal title="Delete Question" onClose={() => setShowDeleteTraining(null)} size="sm">
          <p className="text-sm text-gray-600 mb-5">Delete this training question? This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteTraining(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
            <button onClick={deleteTraining} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
