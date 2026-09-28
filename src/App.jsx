import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_URL, api, signInUrl } from './api.js'
import QuoteForm from './QuoteForm.jsx'
import JobBudget from './JobBudget.jsx'
import GasVehicles from './GasVehicles.jsx'
import dwLogo from './assets/dw-services-logo.png'

const NAV = [
  ['jobs', 'Jobs', 'J'],
  ['overview', 'Overview', '⌂'],
  ['reports', 'Financial reports', '↗'],
  ['users', 'Users', '♙'],
  ['roles', 'Roles & permissions', '◇'],
  ['audit', 'Audit log', '≡'],
]

const JOB_SECTIONS = [['quotes', 'Quotes'], ['receipts', 'Receipts'], ['gas', 'Gas & vehicles'], ['rfis', 'RFIs'], ['drawings', 'Drawings'], ['budget', 'Budget']]

const ALL_PERMISSIONS = [
  'CONFIG_USERS_READ', 'CONFIG_USERS_CREATE', 'CONFIG_USERS_UPDATE', 'CONFIG_USERS_DELETE',
  'CONFIG_ROLES_READ', 'CONFIG_ROLES_CREATE', 'CONFIG_ROLES_UPDATE', 'AUDIT_LOG_READ',
  'RECEIPTS_READ', 'RECEIPTS_CREATE', 'RECEIPTS_UPDATE', 'RECEIPTS_DELETE',
  'JOBS_READ', 'JOBS_CREATE', 'JOBS_UPDATE',
]

const initials = (name = '') => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U'
const fmtDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'

function Login({ status }) {
  const pending = status === 'ACCESS_PENDING'
  const bypass = import.meta.env.VITE_AUTH_MODE === 'bypass'
  return <main className="login-shell">
    <section className="login-card">
      <img className="brand-logo" src={dwLogo} alt="DW Services"/>
      <p className="eyebrow">DEVANTE</p>
      <h1>{pending ? 'Access request pending' : 'Welcome back'}</h1>
      <p className="muted">{pending ? 'Your account exists, but an administrator needs to activate it.' : bypass ? 'Development sign-in is bypassed. Start the backend and retry the connection.' : 'Sign in with your company Microsoft account to continue to the administration portal.'}</p>
      {!pending && !bypass && <a className="button microsoft" href={signInUrl}><span className="ms-grid">▪▪<br/>▪▪</span> Continue with Microsoft</a>}
      {!pending && bypass && <button className="button microsoft" onClick={() => location.reload()}>Connect to local backend</button>}
      {pending && <button className="button" onClick={() => location.assign('/login')}>Try again</button>}
      <p className="login-foot">Protected access</p>
    </section>
  </main>
}

function Modal({ title, children, onClose, wide = false }) {
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close">×</button></header>
      {children}
    </section>
  </div>
}

function UserForm({ roles, user, onSave, onClose }) {
  const [form, setForm] = useState({ full_name: user?.full_name || '', email: user?.email || '', is_active: user?.is_active ?? true, is_super_admin: user?.is_super_admin || false, role_ids: user?.role_ids || [] })
  const [busy, setBusy] = useState(false)
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await onSave(form) } finally { setBusy(false) } }
  return <form onSubmit={submit} className="form">
    <label>Full name<input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
    {!user && <label>Email address<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" /></label>}
    <label>Roles<select multiple value={form.role_ids} onChange={(e) => setForm({ ...form, role_ids: [...e.target.selectedOptions].map(o => o.value) })}>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select><small>Hold Ctrl or Cmd to select more than one.</small></label>
    <label className="check"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active account</label>
    <label className="check"><input type="checkbox" checked={form.is_super_admin} onChange={(e) => setForm({ ...form, is_super_admin: e.target.checked })} /> Super administrator</label>
    <footer><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button" disabled={busy}>{busy ? 'Saving…' : 'Save user'}</button></footer>
  </form>
}

function RoleForm({ role, onSave, onClose }) {
  const [form, setForm] = useState({ code: role?.code || '', name: role?.name || '', permissions: role?.permissions || [], is_active: role?.is_active ?? true })
  const toggle = (p) => setForm({ ...form, permissions: form.permissions.includes(p) ? form.permissions.filter(x => x !== p) : [...form.permissions, p] })
  return <form className="form" onSubmit={(e) => { e.preventDefault(); onSave(form) }}>
    <label>Role name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
    {!role && <label>Role code<input required pattern="[A-Z][A-Z0-9_]{1,63}" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} placeholder="TEAM_MANAGER" /></label>}
    <fieldset><legend>Permissions</legend><div className="permission-grid">{ALL_PERMISSIONS.map(p => <label className="check" key={p}><input type="checkbox" checked={form.permissions.includes(p)} onChange={() => toggle(p)} /> {p.replaceAll('_', ' ').toLowerCase()}</label>)}</div></fieldset>
    {role && <label className="check"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active role</label>}
    <footer><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button">Save role</button></footer>
  </form>
}

const CATEGORIES = [
  ['gas', 'Gas'], ['client_meals', 'Restaurant / client expenses'], ['maintenance', 'Maintenance'],
  ['job_expense', 'Job-related expenses'], ['other', 'Other'],
]

export function DropZone({
  onFilesSelected,
  multiple = true,
  accept = "image/*,application/pdf,.heic,.heif,.jpg,.jpeg,.png,.webp",
  title = "Drop files here or tap to browse",
  subtitle = "Supports images, camera photos & PDF",
  compact = false,
  allowCamera = true,
  currentFileName = "",
  icon = "⬆️",
}) {
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dragging) setDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }

  return (
    <div
      className={`app-dropzone ${compact ? 'app-dropzone-compact' : ''} ${dragging ? 'dragging' : ''}`}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFilesSelected(e.target.files)
            e.target.value = ''
          }
        }}
      />
      {allowCamera && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onFilesSelected(e.target.files)
              e.target.value = ''
            }
          }}
        />
      )}

      {currentFileName ? (
        <div className="app-dropzone-file-selected" onClick={(e) => e.stopPropagation()}>
          <span className="app-dropzone-icon" style={{ width: '36px', height: '36px', fontSize: '18px' }}>📄</span>
          <div className="app-dropzone-file-info">
            <strong>{currentFileName}</strong>
            <small>File selected · Tap Replace to change</small>
          </div>
          <button
            type="button"
            className="button secondary"
            style={{ padding: '6px 12px', fontSize: '11px', minHeight: '32px' }}
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
          >
            Replace
          </button>
        </div>
      ) : (
        <>
          <div className="app-dropzone-icon">
            <span>{icon}</span>
          </div>
          <div>
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </div>
          {allowCamera && (
            <div className="app-dropzone-actions" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="app-dropzone-chip"
                onClick={() => cameraInputRef.current?.click()}
              >
                📷 Take photo
              </button>
              <button
                type="button"
                className="app-dropzone-chip"
                onClick={() => fileInputRef.current?.click()}
              >
                🖼️ Choose files
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function UploadForm({ type, onSave, onClose, onJobQueued, backgroundJob, job, vehicles = [], forceGas = false }) {
  const restored = backgroundJob?.preview || {}
  const [form, setForm] = useState({
    document_type: type,
    transaction_type: restored.suggested_transaction_type || 'expense',
    category: forceGas ? 'gas' : (restored.suggested_category || (type === 'rfi' ? 'job_expense' : 'other')),
    incurred_at: restored.suggested_date || new Date().toISOString().slice(0, 10),
    amount: restored.suggested_amount || '',
    vendor: restored.suggested_vendor || '',
    currency: (restored.suggested_currency && restored.suggested_currency !== 'CHF') ? restored.suggested_currency : 'CAD',
    link_type: job ? 'job' : '',
    link_id: job?.code || '',
    link_label: job?.name || '',
    rfi_number: '',
    rfi_subject: '',
    rfi_question: '',
    rfi_to: '',
    rfi_attention_name: '',
    rfi_attention_phone: '',
    rfi_attention_email: '',
    rfi_due_at: '',
    vehicle_id: vehicles.find(vehicle => vehicle.is_default)?.id || '',
    fuel_litres: restored.suggested_fuel_litres || restored.suggested_litres || '',
    ocr_text_override: restored.ocr_text || '',
  })
  const [file, setFile] = useState(backgroundJob?.file || null)
  const [busy, setBusy] = useState(false)
  const [previewing, setPreviewing] = useState(['queued', 'processing'].includes(backgroundJob?.status))
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewImageFailed, setPreviewImageFailed] = useState(false)
  const [ocrMessage, setOcrMessage] = useState(backgroundJob?.status === 'completed' ? 'OCR is ready. Review the fields before confirming.' : backgroundJob?.error || '')
  const [previewReady, setPreviewReady] = useState(['completed', 'failed'].includes(backgroundJob?.status))
  const [detectedFields, setDetectedFields] = useState({})
  const previewRequest = useRef(0)

  useEffect(() => () => { previewRequest.current += 1 }, [])
  useEffect(() => {
    if (!file || !String(file.type || '').startsWith('image/')) return undefined
    const objectUrl = URL.createObjectURL(file)
    setPreviewImageFailed(false)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  useEffect(() => {
    if (file || !backgroundJob || !String(backgroundJob.mime_type || '').startsWith('image/')) return undefined
    const controller = new AbortController()
    let objectUrl = ''
    fetch(`${API_URL}/receipts/preview/${backgroundJob.job_id}/file`, { credentials: 'include', signal: controller.signal })
      .then(response => {
        const mime = response.headers.get('content-type') || ''
        if (!response.ok) throw new Error(`Preview request failed (${response.status})`)
        if (!mime.startsWith('image/')) throw new Error(`Preview returned ${mime || 'an unknown file type'}`)
        return response.blob()
      })
      .then(blob => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewImageFailed(false)
        setPreviewUrl(objectUrl)
      })
      .catch(error => { if (error.name !== 'AbortError') setPreviewImageFailed(true) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [backgroundJob?.job_id, backgroundJob?.mime_type, file])

  const selectFiles = async (selectedList) => {
    if (!selectedList || selectedList.length === 0) return
    const filesArray = Array.from(selectedList)
    const primaryFile = filesArray[0]
    const remainingFiles = filesArray.slice(1)

    // Queue any additional files in the background
    for (const extraFile of remainingFiles) {
      const extraData = new FormData()
      extraData.append('file', extraFile)
      extraData.append('document_type', type)
      api('/receipts/preview', { method: 'POST', body: extraData })
        .then(queued => {
          if (onJobQueued) onJobQueued({ ...queued, documentType: type, file: extraFile, filename: extraFile.name })
        })
        .catch(() => {})
    }

    const requestId = ++previewRequest.current
    setPreviewImageFailed(false)
    setFile(primaryFile)
    setPreviewUrl('')
    setPreviewing(true)
    setPreviewReady(false)
    setOcrMessage(filesArray.length > 1 ? `Queued ${filesArray.length} ${type === 'rfi' ? 'documents' : 'receipts'}! Reading first…` : `Reading ${type === 'rfi' ? 'document' : 'receipt'} and extracting details…`)

    const data = new FormData()
    data.append('file', primaryFile)
    data.append('document_type', type)
    try {
      const queued = await api('/receipts/preview', { method: 'POST', body: data })
      if (onJobQueued) onJobQueued({ ...queued, documentType: type, file: primaryFile, filename: primaryFile.name })
      let job = queued
      let attempts = 0
      while (requestId === previewRequest.current && ['queued', 'processing'].includes(job.status) && attempts < 300) {
        attempts += 1
        setOcrMessage(job.status === 'processing' ? `Reading ${type === 'rfi' ? 'document' : 'receipt'} in the background…` : 'Processing OCR…')
        await new Promise(resolve => setTimeout(resolve, 800))
        job = await api(`/receipts/preview/${queued.job_id}`)
      }
      if (requestId !== previewRequest.current) return
      if (['queued', 'processing'].includes(job.status)) throw new Error('OCR preview timed out.')
      if (job.status === 'failed') throw new Error(job.error || 'OCR preview failed')
      const result = job.preview || {}
      const extractedLitres = result.suggested_fuel_litres || result.suggested_litres || ''
      const isGas = forceGas || result.suggested_category === 'gas'

      setDetectedFields({
        vendor: result.suggested_vendor,
        amount: result.suggested_amount,
        fuel_litres: extractedLitres,
        category: result.suggested_category,
      })

      setForm(current => ({
        ...current,
        ocr_text_override: result.ocr_text || '',
        vendor: current.vendor || result.suggested_vendor || '',
        amount: current.amount || result.suggested_amount || '',
        incurred_at: result.suggested_date || current.incurred_at,
        category: isGas ? 'gas' : (result.suggested_category || current.category),
        currency: (result.suggested_currency && result.suggested_currency !== 'CHF') ? result.suggested_currency : (current.currency || 'CAD'),
        fuel_litres: current.fuel_litres || extractedLitres,
        transaction_type: result.suggested_transaction_type || current.transaction_type,
      }))
      setPreviewReady(true)
      const successMsg = extractedLitres
        ? `OCR extracted successfully (${extractedLitres} L detected). Review fields below.`
        : (result.ocr_text ? 'OCR extracted successfully. Review fields below.' : 'OCR finished with no detected text. You can enter details manually.')
      setOcrMessage(result.message || successMsg)
    } catch (error) {
      if (requestId === previewRequest.current) {
        setPreviewReady(true)
        setOcrMessage(`${error.message} You can enter details manually.`)
      }
    } finally {
      if (requestId === previewRequest.current) setPreviewing(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    const data = new FormData()
    Object.entries(form).forEach(([key, value]) => (value !== '' || key === 'ocr_text_override') && data.append(key, value))
    if (file) data.append('file', file)
    try {
      await onSave(data, backgroundJob?.job_id)
    } finally {
      setBusy(false)
    }
  }

  const hasUpload = Boolean(file || backgroundJob)
  const uploadMime = file?.type || backgroundJob?.mime_type || ''
  const uploadName = file?.name || backgroundJob?.filename

  return <form className="form" onSubmit={submit}>
    <DropZone
      multiple
      currentFileName={uploadName}
      title={type === 'rfi' ? 'Drop RFI screenshots or PDFs here' : 'Drop receipt images or PDFs here'}
      subtitle={type === 'rfi' ? 'Select or drop files · Tap to browse' : 'Supports multiple receipts, camera photos & PDF · OCR runs automatically'}
      icon={type === 'rfi' ? '📋' : '🧾'}
      allowCamera={true}
      onFilesSelected={selectFiles}
    />

    {hasUpload && <div className={`ocr-state ${previewing ? 'working' : ''}`}><i/>{ocrMessage}</div>}

    {hasUpload && (
      <details className="ocr-details-toggle" open>
        <summary className="ocr-toggle-summary">
          <span>🔍 View {type === 'rfi' ? 'document' : 'receipt'} preview & extracted text</span>
          <small className="ocr-toggle-badge">{previewing ? 'Reading…' : form.ocr_text_override ? 'Text captured' : 'Tap to collapse / expand'}</small>
        </summary>
        <section className="ocr-review">
          <div className="receipt-preview">
            {uploadMime.startsWith('image/') ? (
              previewImageFailed ? <div><span>!</span><strong>Image preview unavailable</strong></div> :
              previewUrl ? <img src={previewUrl} alt={type === 'rfi' ? 'Document preview' : 'Receipt preview'} onError={() => setPreviewImageFailed(true)}/> :
              <div><div className="spinner small"/><strong>Loading preview…</strong></div>
            ) : <div><span>PDF</span><strong>{uploadName}</strong></div>}
          </div>
          <div className="ocr-fields">
            <label>
              Extracted text <small>Edit this if OCR read anything incorrectly</small>
              <textarea
                rows="9"
                value={form.ocr_text_override}
                onChange={e => setForm({ ...form, ocr_text_override: e.target.value })}
                placeholder={type === 'rfi' ? 'No text detected—type RFI details here' : 'No text detected—type receipt details here'}
              />
            </label>
          </div>
        </section>
      </details>
    )}

    <div className="form-row">
      <label>Date<input required type="date" value={form.incurred_at} onChange={e => setForm({ ...form, incurred_at: e.target.value })}/></label>
      <label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>

    {type === 'receipt' && form.category === 'gas' && (
      <div className="form-row">
        <label>Vehicle<select required value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })}><option value="">Select vehicle</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></label>
        <label>
          Litres purchased {detectedFields.fuel_litres && <span style={{ color: '#21a977', fontWeight: 'normal', fontSize: '10px' }}>(✨ Auto-detected)</span>}
          <input required type="number" min="0.01" max="10000" step="0.01" placeholder="e.g. 45.20" value={form.fuel_litres} onChange={e => setForm({ ...form, fuel_litres: e.target.value })}/>
          <small>Required to calculate vehicle range</small>
        </label>
      </div>
    )}

    {type === 'receipt' && (
      <>
        <div className="form-row">
          <label>Record as<select value={form.transaction_type} onChange={e => setForm({ ...form, transaction_type: e.target.value })}><option value="expense">Expense</option><option value="income">Income</option></select></label>
          <label>
            Amount {detectedFields.amount && <span style={{ color: '#21a977', fontWeight: 'normal', fontSize: '10px' }}>(✨ Auto-detected)</span>}
            <input min="0" step="0.01" type="number" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}/>
          </label>
        </div>
        <label>
          Vendor {detectedFields.vendor && <span style={{ color: '#21a977', fontWeight: 'normal', fontSize: '10px' }}>(✨ Auto-detected)</span>}
          <input value={form.vendor} placeholder="e.g. Petro-Canada" onChange={e => setForm({ ...form, vendor: e.target.value })}/>
        </label>
      </>
    )}

    {type === 'rfi' && (
      <fieldset>
        <legend>RFI request</legend>
        <div className="form-row">
          <label>RFI number<input maxLength="80" value={form.rfi_number} onChange={e => setForm({ ...form, rfi_number: e.target.value })} placeholder="RFI 031"/></label>
          <label>Response required by<input type="date" value={form.rfi_due_at} onChange={e => setForm({ ...form, rfi_due_at: e.target.value })}/></label>
        </div>
        <label>Subject<input maxLength="200" value={form.rfi_subject} onChange={e => setForm({ ...form, rfi_subject: e.target.value })} placeholder="Thermostat locations"/></label>
        <label>To - company and mailing address<textarea rows="4" maxLength="1000" value={form.rfi_to} onChange={e => setForm({ ...form, rfi_to: e.target.value })} placeholder="Company name, address, and any additional recipients"/></label>
        <div className="form-row">
          <label>Attention<input maxLength="200" value={form.rfi_attention_name} onChange={e => setForm({ ...form, rfi_attention_name: e.target.value })} placeholder="Contact name"/></label>
          <label>Phone<input type="tel" maxLength="80" value={form.rfi_attention_phone} onChange={e => setForm({ ...form, rfi_attention_phone: e.target.value })}/></label>
        </div>
        <label>Attention email<input type="email" maxLength="200" value={form.rfi_attention_email} onChange={e => setForm({ ...form, rfi_attention_email: e.target.value })}/></label>
        <label>Information requested<textarea rows="5" maxLength="5000" value={form.rfi_question} onChange={e => setForm({ ...form, rfi_question: e.target.value })} placeholder="Describe the clarification needed"/></label>
      </fieldset>
    )}

    <fieldset>
      <legend>Link to work (optional)</legend>
      <div className="form-row">
        <label>Record type<select value={form.link_type} onChange={e => setForm({ ...form, link_type: e.target.value })}><option value="">Not linked</option><option value="job">Job</option><option value="quote">Quote</option><option value="estimate">Estimate</option></select></label>
        <label>Job / quote / estimate ID<input value={form.link_id} onChange={e => setForm({ ...form, link_id: e.target.value })} placeholder="e.g. JOB-1042"/></label>
      </div>
      <label>Description<input value={form.link_label} onChange={e => setForm({ ...form, link_label: e.target.value })} placeholder="Optional reference name"/></label>
    </fieldset>

    <footer>
      <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
      <button className="button" disabled={busy || previewing || !hasUpload}>
        {busy ? 'Uploading…' : previewing ? 'Reading…' : `Confirm & upload ${type === 'rfi' ? 'RFI' : 'receipt'}`}
      </button>
    </footer>
  </form>
}


export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('jobs')
  const [jobSection, setJobSection] = useState('quotes')
  const [users, setUsers] = useState([])
  const [jobs, setJobs] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [roles, setRoles] = useState([])
  const [logs, setLogs] = useState([])
  const [receipts, setReceipts] = useState([])
  const [receiptJobs, setReceiptJobs] = useState([])
  const [summary, setSummary] = useState(null)
  const [reportYear, setReportYear] = useState('all')
  const [reportJobId, setReportJobId] = useState('')
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState(null)
  const [query, setQuery] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const status = new URLSearchParams(location.search).get('status')

  const can = useCallback((permission) => session?.permissions?.includes('*') || session?.permissions?.includes(permission), [session])
  const load = useCallback(async (silent = false) => {
    if (silent !== true) setLoading(true)
    try {
      const bootstrap = await api('/auth/bootstrap')
      setSession(bootstrap)
      const requests = [canFrom(bootstrap, 'CONFIG_USERS_READ') ? api('/configuration/users') : [], canFrom(bootstrap, 'CONFIG_ROLES_READ') ? api('/configuration/roles') : [], canFrom(bootstrap, 'AUDIT_LOG_READ') ? api('/audit-logs?limit=100') : [], canFrom(bootstrap, 'RECEIPTS_READ') ? api('/receipts') : [], canFrom(bootstrap, 'RECEIPTS_READ') ? api(`/receipts/reports/summary?year=${reportYear}${reportJobId ? `&job_id=${encodeURIComponent(reportJobId)}` : ''}`) : null, canFrom(bootstrap, 'JOBS_READ') ? api('/jobs') : [], canFrom(bootstrap, 'RECEIPTS_READ') ? api('/vehicles') : []]
      const results = await Promise.allSettled(requests)
      const value = (index, fallback) => results[index].status === 'fulfilled' ? results[index].value : fallback
      setUsers(value(0, [])); setRoles(value(1, [])); setLogs(value(2, [])); setReceipts(value(3, [])); setSummary(value(4, null)); setJobs(value(5, [])); setVehicles(value(6, []))
      let dataUnavailable = results.some(result => result.status === 'rejected')
      if (canFrom(bootstrap, 'RECEIPTS_CREATE')) {
        try {
          const savedJobs = await api('/receipts/preview-jobs')
          setReceiptJobs(current => savedJobs.map(job => ({ ...job, file: current.find(item => item.job_id === job.job_id)?.file })))
        } catch {
          dataUnavailable = true
        }
      }
      if (dataUnavailable) {
        setNotice({ type: 'error', text: 'Connected in local mode, but some data is unavailable. Start MongoDB to enable saved records.' })
      }
    } catch (error) {
      if (error.status !== 401) setNotice({ type: 'error', text: error.message })
      setSession(null)
    } finally { if (silent !== true) setLoading(false) }
  }, [reportYear, reportJobId])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (!session) return; const timer = setInterval(() => api('/auth/heartbeat', { method: 'POST' }).catch(() => setSession(null)), 10 * 60 * 1000); return () => clearInterval(timer) }, [session])
  useEffect(() => {
    const active = receiptJobs.filter(job => ['queued', 'processing'].includes(job.status))
    if (!active.length) return undefined
    const timer = setTimeout(async () => {
      const updates = await Promise.all(active.map(async job => {
        try { return await api(`/receipts/preview/${job.job_id}`) } catch (error) { return error.status === 404 ? { job_id: job.job_id, status: 'failed', error: 'Preview expired. Open it to enter the details manually.' } : null }
      }))
      setReceiptJobs(current => current.map(job => {
        const update = updates.find(item => item?.job_id === job.job_id)
        return update ? { ...job, ...update, preview: update.preview || job.preview } : job
      }))
    }, 1000)
    return () => clearTimeout(timer)
  }, [receiptJobs])
  const filteredUsers = useMemo(() => users.filter(u => `${u.full_name} ${u.email}`.toLowerCase().includes(query.toLowerCase())), [users, query])
  const flash = (text, type = 'success') => { setNotice({ text, type }); setTimeout(() => setNotice(null), 3500) }
  const saveUser = async (form) => { try { if (modal.user) await api(`/configuration/users/${modal.user.id}`, { method: 'PATCH', body: JSON.stringify(form) }); else await api('/configuration/users', { method: 'POST', body: JSON.stringify(form) }); setModal(null); flash('User saved successfully.'); await load() } catch (e) { flash(e.message, 'error') } }
  const saveRole = async (form) => { try { if (modal.role) { const { code, ...body } = form; await api(`/configuration/roles/${modal.role.id}`, { method: 'PATCH', body: JSON.stringify(body) }) } else await api('/configuration/roles', { method: 'POST', body: JSON.stringify(form) }); setModal(null); flash('Role saved successfully.'); await load() } catch (e) { flash(e.message, 'error') } }
  const queueReceiptJob = (job) => { setReceiptJobs(current => [...current.filter(item => item.job_id !== job.job_id), job]); setModal(current => current?.type === 'upload' ? { ...current, backgroundJob: job } : current) }
  const startBackgroundReceipts = async (selectedFiles) => {
    const files = Array.from(selectedFiles || []).slice(0, 20)
    if (!files.length) return
    let queuedCount = 0; const failures = []
    for (let index = 0; index < files.length; index += 3) {
      await Promise.all(files.slice(index, index + 3).map(async file => {
        const data = new FormData(); data.append('file', file); data.append('document_type', 'receipt')
        try {
          const queued = await api('/receipts/preview', { method: 'POST', body: data })
          queueReceiptJob({ ...queued, documentType: 'receipt', file, filename: file.name, mime_type: file.type })
          queuedCount += 1
        } catch (error) { failures.push(`${file.name}: ${error.message}`) }
      }))
    }
    if (queuedCount) flash(`${queuedCount} receipt${queuedCount > 1 ? 's' : ''} uploaded. OCR is running in the background.`)
    if (failures.length) flash(`${failures.length} receipt${failures.length > 1 ? 's' : ''} could not be queued. ${failures[0]}`, 'error')
    if (Array.from(selectedFiles || []).length > 20) flash('Only the first 20 receipts were queued. Upload the remaining files as another batch.', 'error')
  }
  const createRfi = async (job, data, files) => {
    const created = await api(`/jobs/${job.id}/rfis`, { method: 'POST', body: JSON.stringify(data) })
    let failed = 0
    for (const file of files) {
      const body = new FormData(); body.append('file', file)
      try { await api(`/receipts/${created.id}/attachments`, { method: 'POST', body }) }
      catch { failed += 1 }
    }
    setModal(null)
    flash(failed ? `RFI created, but ${failed} attachment${failed === 1 ? '' : 's'} could not be added. Open the RFI to retry.` : 'RFI created.', failed ? 'error' : 'success')
    await load(true)
  }
  const uploadDocument = async (form, previewJobId) => { try { await api(previewJobId ? `/receipts/from-preview/${previewJobId}` : '/receipts', { method: 'POST', body: form }); if (previewJobId) setReceiptJobs(current => current.filter(job => job.job_id !== previewJobId)); setModal(null); flash('Upload saved with the reviewed OCR details.'); await load(true) } catch (e) { flash(e.message, 'error') } }
  const removeReceipt = async (item) => { if (!confirm(`Delete ${item.filename}?`)) return; try { await api(`/receipts/${item.id}`, { method: 'DELETE' }); flash('Document deleted.'); await load() } catch (e) { flash(e.message, 'error') } }
  const removeUser = async (user) => { if (!confirm(`Delete ${user.full_name}? This action disables their access.`)) return; try { await api(`/configuration/users/${user.id}`, { method: 'DELETE' }); flash('User deleted.'); await load() } catch (e) { flash(e.message, 'error') } }
  const logout = async () => { try { await api('/auth/logout', { method: 'POST' }) } finally { setReceiptJobs([]); setSession(null) } }

  if (loading) return <div className="loading"><div className="spinner"/><span>Loading Devante…</span></div>
  if (!session) return <Login status={status} />

  const changeView = (next) => { setView(next); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const activeJobCount = receiptJobs.filter(job => ['queued', 'processing'].includes(job.status)).length
  return <div className="shell">
    <aside>
      <div className="brand"><img className="brand-logo small" src={dwLogo} alt="DW Services"/><div><strong>Devante</strong><span>Administration</span></div></div>
      <nav>{NAV.map(([id, label, icon]) => <div className="nav-group" key={id}><button className={view === id ? 'active' : ''} onClick={() => changeView(id)}><span>{icon}</span>{label}</button>{id === 'jobs' && view === 'jobs' && <div className="job-subnav" role="navigation" aria-label="Job sections">{JOB_SECTIONS.map(([section, name]) => <button key={section} className={`${jobSection === section || (section === 'receipts' && jobSection === 'gas') ? 'active' : ''} ${section === 'gas' ? 'nested' : ''}`} onClick={() => setJobSection(section)}>{name}</button>)}</div>}</div>)}</nav>
      <div className="account"><div className="avatar">{initials(session.user.full_name)}</div><div><strong>{session.user.full_name}</strong><span>{session.user.email}</span></div><button onClick={logout} title="Sign out">↪</button></div>
    </aside>
    <header className="mobile-header"><img className="brand-logo small" src={dwLogo} alt="DW Services"/><div><strong>Devante</strong><span>{NAV.find(n => n[0] === view)?.[1]}</span></div><button onClick={logout} aria-label="Sign out">↪</button></header>
    <main className="content">
      <header className="topbar"><div><p className="eyebrow">ADMINISTRATION PORTAL</p><h1>{NAV.find(n => n[0] === view)?.[1]}</h1></div><div className={`live ${activeJobCount ? 'processing' : ''}`}><i/> {activeJobCount ? `Processing ${activeJobCount} receipt${activeJobCount > 1 ? 's' : ''}…` : 'Secure session'}</div></header>
      {notice && <div className={`notice ${notice.type}`}>{notice.text}<button onClick={() => setNotice(null)}>×</button></div>}
      {view === 'overview' && <Overview users={users} roles={roles} logs={logs} user={session.user} setView={setView} />}
      {view === 'users' && <section><div className="section-head"><div><h2>People with access</h2><p>Manage accounts, roles, and activation status.</p></div>{can('CONFIG_USERS_CREATE') && <button className="button" onClick={() => setModal({ type: 'user' })}>+ Add user</button>}</div><div className="toolbar"><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search users…"/><span>{filteredUsers.length} users</span></div><div className="table-wrap"><table><thead><tr><th>User</th><th>Roles</th><th>Status</th><th>Last activity</th><th/></tr></thead><tbody>{filteredUsers.map(u => <tr key={u.id}><td><div className="person"><div className="avatar soft">{initials(u.full_name)}</div><div><strong>{u.full_name}</strong><span>{u.email}</span></div></div></td><td>{u.is_super_admin ? <span className="tag purple">Super admin</span> : u.role_ids?.length ? <span className="tag">{u.role_ids.length} role{u.role_ids.length > 1 ? 's' : ''}</span> : <span className="dim">No role</span>}</td><td><span className={`status ${u.is_active ? 'on' : 'off'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td><td>{fmtDate(u.last_activity_at)}</td><td className="actions">{can('CONFIG_USERS_UPDATE') && <button onClick={() => setModal({ type: 'user', user: u })}>Edit</button>}{can('CONFIG_USERS_DELETE') && u.id !== session.user.id && <button className="danger-link" onClick={() => removeUser(u)}>Delete</button>}</td></tr>)}</tbody></table>{!filteredUsers.length && <Empty text="No users match your search."/>}</div></section>}
      {view === 'roles' && <section><div className="section-head"><div><h2>Roles & permissions</h2><p>Group permissions into reusable access profiles.</p></div>{can('CONFIG_ROLES_CREATE') && <button className="button" onClick={() => setModal({ type: 'role' })}>+ New role</button>}</div><div className="card-grid">{roles.map(r => <article className="role-card" key={r.id}><div className="role-icon">◇</div><div className="role-title"><h3>{r.name}</h3><span className={`status ${r.is_active ? 'on' : 'off'}`}>{r.is_active ? 'Active' : 'Inactive'}</span></div><code>{r.code}</code><p>{r.permissions?.length || 0} permissions assigned</p><div className="chips">{r.permissions?.slice(0, 3).map(p => <span key={p}>{p.replaceAll('_', ' ').toLowerCase()}</span>)}{r.permissions?.length > 3 && <span>+{r.permissions.length - 3} more</span>}</div>{can('CONFIG_ROLES_UPDATE') && <button className="text-button" onClick={() => setModal({ type: 'role', role: r })}>Edit role →</button>}</article>)}{!roles.length && <Empty text="No roles have been created."/>}</div></section>}
      {view === 'jobs' && <JobsView vehicles={vehicles} allReceipts={receipts} jobs={jobs} receiptJobs={receiptJobs} can={can} onCreateRfi={job => setModal({type:'rfi-create', job})} jobSection={jobSection} setJobSection={setJobSection} onRefresh={() => load(true)} onReceiptFiles={startBackgroundReceipts} onOpenPreview={(job, backgroundJob) => setModal({type:'upload', documentType:backgroundJob.documentType, backgroundJob, job})} onUploadDocument={(job, documentType) => setModal({type:'upload', documentType, job})} onViewReport={(job, receipt) => { setReportJobId(job.id); setReportYear(new Date(receipt.incurred_at).getUTCFullYear()); setView('reports') }}/>}
      {view === 'reports' && <Reports summary={summary} year={reportYear} setYear={setReportYear} jobs={jobs} receipts={receipts} jobId={reportJobId} setJobId={setReportJobId}/>} 
      {view === 'audit' && <section><div className="section-head"><div><h2>Audit log</h2><p>A chronological record of administrative activity.</p></div><button className="button secondary" onClick={load}>Refresh</button></div><div className="table-wrap"><table><thead><tr><th>Event</th><th>Resource</th><th>Actor</th><th>Date & time</th></tr></thead><tbody>{logs.map(log => <tr key={log.id}><td><strong>{log.action?.replaceAll('_', ' ') || 'EVENT'}</strong></td><td>{log.resource_type || '—'} <span className="dim">{log.resource_id?.slice?.(0, 8)}</span></td><td className="mono">{log.actor_id?.slice?.(0, 8) || 'System'}</td><td>{fmtDate(log.created_at)}</td></tr>)}</tbody></table>{!logs.length && <Empty text="No audit activity to show."/>}</div></section>}
    </main>
    {mobileMenu && <div className="mobile-more" onClick={() => setMobileMenu(false)}><div onClick={e => e.stopPropagation()}><header><strong>Administration</strong><button onClick={() => setMobileMenu(false)}>×</button></header>{NAV.filter(([id]) => ['overview','users','roles','audit'].includes(id)).map(([id,label,icon]) => <button key={id} onClick={() => changeView(id)}><span>{icon}</span>{label}<b>›</b></button>)}</div></div>}
    <nav className="mobile-nav" aria-label="Primary navigation">
      {NAV.filter(([id]) => ['jobs','reports'].includes(id)).map(([id,label,icon]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => changeView(id)}><span>{icon}</span><small>{label}</small></button>)}
      <button className={['overview','users','roles','audit'].includes(view) ? 'active' : ''} onClick={() => setMobileMenu(true)}><span>•••</span><small>More</small></button>
    </nav>
    {modal?.type === 'user' && <Modal title={modal.user ? 'Edit user' : 'Add a user'} onClose={() => setModal(null)}><UserForm roles={roles} user={modal.user} onSave={saveUser} onClose={() => setModal(null)}/></Modal>}
    {modal?.type === 'role' && <Modal title={modal.role ? 'Edit role' : 'Create a role'} onClose={() => setModal(null)}><RoleForm role={modal.role} onSave={saveRole} onClose={() => setModal(null)}/></Modal>}
    {modal?.type === 'rfi-create' && <RfiCreateForm job={modal.job} onSave={(data, files) => createRfi(modal.job, data, files)} onClose={() => setModal(null)}/>}
    {modal?.type === 'upload' && <Modal title={modal.documentType === 'rfi' ? 'Upload RFI screenshot' : 'Upload receipt'} onClose={() => setModal(null)}><UploadForm type={modal.documentType === 'gas-receipt' ? 'receipt' : modal.documentType} forceGas={modal.documentType === 'gas-receipt'} vehicles={vehicles} backgroundJob={modal.backgroundJob} job={modal.job} onJobQueued={queueReceiptJob} onSave={uploadDocument} onClose={() => setModal(null)}/></Modal>}
  </div>
}


function JobsView({ vehicles, allReceipts, jobs, receiptJobs, can, jobSection, setJobSection, onCreateRfi, onRefresh, onReceiptFiles, onOpenPreview, onUploadDocument, onViewReport }) {
  const [selectedId, setSelectedId] = useState(null)
  const [jobSearch, setJobSearch] = useState('')
  const [companyDraft, setCompanyDraft] = useState('')
  const [companySaving, setCompanySaving] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const jobDetailsRef = useRef(null)
  const createPanel = useRef(null)
  const [detail, setDetail] = useState(null)
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [quoteEditor, setQuoteEditor] = useState(null)
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState('')
  const [documentPreviewError, setDocumentPreviewError] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', company: '', description: '' })
  const [busy, setBusy] = useState(false)
  const selected = jobs.find(job => job.id === selectedId)
  useEffect(() => { setCompanyDraft(selected?.company || '') }, [selectedId, selected?.company])
  const saveCompany = async (event) => {
    event.preventDefault(); if (!selectedId) return
    setCompanySaving(true)
    try { await api(`/jobs/${selectedId}`, { method: 'PATCH', body: JSON.stringify({ company: companyDraft }) }); await onRefresh() }
    catch (error) { alert(error.message) } finally { setCompanySaving(false) }
  }
  const normalizeJobSearch = value => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const searchTerm = normalizeJobSearch(jobSearch)
  const saveBudget = async changes => {
    await api(`/jobs/${selectedId}`, { method: 'PATCH', body: JSON.stringify(changes) })
    await Promise.all([onRefresh(), refreshDetail()])
  }
  const matchingJobs = jobs.filter(job => normalizeJobSearch(`${job.code} ${job.name} ${job.company || ''}`).includes(searchTerm))
  const suggestions = matchingJobs.slice(0, 10)
  const shouldSuggestCreate = Boolean(jobSearch.trim() && matchingJobs.length === 0 && can('JOBS_CREATE'))
  const selectJob = (job) => {
    setSelectedId(job.id); setSelectedDocument(null); setJobSearch(`${job.code} - ${job.name}`); setSearchOpen(false)
    requestAnimationFrame(() => jobDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const openCreateForCompany = () => {
    if (!can('JOBS_CREATE')) return
    const company = matchingJobs.length ? '' : jobSearch.trim()
    setForm(current => ({ ...current, company }))
    setSearchOpen(false)
    if (createPanel.current) createPanel.current.open = true
    requestAnimationFrame(() => {
      createPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      createPanel.current?.querySelector('input')?.focus({ preventScroll: true })
    })
  }
  const onSearchKeyDown = event => {
    if (event.key === 'Escape') { setSearchOpen(false); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setSearchOpen(true)
      setActiveSuggestion(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % (suggestions.length || 1))
    }
    if (event.key === 'Enter' && searchOpen) {
      if (suggestions.length) { event.preventDefault(); selectJob(suggestions[activeSuggestion] || suggestions[0]) }
      else if (shouldSuggestCreate) { event.preventDefault(); openCreateForCompany() }
    }
  }
  useEffect(() => { if (jobs.length === 1 && !selectedId) setSelectedId(jobs[0].id) }, [jobs, selectedId])
  const refreshDetail = async (id = selectedId) => {
    if (!id) return
    try { setDetail(await api(`/jobs/${id}`)) } catch { setDetail(null) }
  }
  useEffect(() => { if (selectedId) refreshDetail(selectedId) }, [selectedId, jobs])
  useEffect(() => {
    setDocumentPreviewUrl(''); setDocumentPreviewError(false)
    if (!selectedDocument || selectedDocument.document_type === 'rfi' || selectedDocument.web_url || selectedDocument.mime_type?.startsWith('image/')) return undefined
    let active = true
    let objectUrl = ''
    fetch(`${API_URL}/receipts/${selectedDocument.id}/file`, { credentials: 'include' })
      .then(response => { if (!response.ok) throw new Error('Preview unavailable'); return response.blob() })
      .then(blob => { objectUrl = URL.createObjectURL(blob); if (active) setDocumentPreviewUrl(objectUrl); else URL.revokeObjectURL(objectUrl) })
      .catch(() => { if (active) setDocumentPreviewError(true) })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [selectedDocument])
  const create = async (event) => {
    event.preventDefault(); setBusy(true)
    try {
      const job = await api('/jobs', { method: 'POST', body: JSON.stringify(form) })
      setForm({ code: '', name: '', company: '', description: '' }); selectJob(job); if (createPanel.current) createPanel.current.open = false; await onRefresh()
    } catch (error) { alert(error.message) } finally { setBusy(false) }
  }
  const saveQuote = async payload => {
    await api(`/jobs/${selectedId}/quotes${quoteEditor?.id ? `/${quoteEditor.id}` : ''}`, {
      method: quoteEditor?.id ? 'PATCH' : 'POST', body: JSON.stringify(payload),
    })
    setQuoteEditor(null)
    await refreshDetail()
  }
  const removeQuote = async quote => {
    if (!confirm(`Remove quote ${quote.title}?`)) return
    try { await api(`/jobs/${selectedId}/quotes/${quote.id}`, { method: 'DELETE' }); await refreshDetail() }
    catch (error) { alert(error.message) }
  }
  const upload = async (kind, file) => {
    if (!file || !selectedId) return
    const body = new FormData(); body.append('kind', kind); body.append('file', file)
    try { await api(`/jobs/${selectedId}/files`, { method: 'POST', body }); await refreshDetail() }
    catch (error) { alert(error.message) }
  }
  const remove = async (file) => {
    if (!confirm(`Remove ${file.filename} from this job?`)) return
    try { await api(`/jobs/${selectedId}/files/${file.id}`, { method: 'DELETE' }); await refreshDetail() }
    catch (error) { alert(error.message) }
  }
  const section = (title, key, kind) => {
    if (key === 'rfis') {
      const items = detail?.rfis || []
      const waiting = items.filter(item => item.status !== 'closed' && !item.closed_at && (!item.responses || item.responses.length === 0))
      const closed = items.filter(item => item.status === 'closed' || item.closed_at || (item.responses && item.responses.length > 0))

      return <section className="panel job-section">
        <div className="section-head">
          <div><h2>{title}</h2><p>{waiting.length} waiting for reply · {closed.length} closed ({items.length} total)</p></div>
          {can('RECEIPTS_CREATE') && <button className="button" onClick={() => onCreateRfi(selected)}>+ Create RFI</button>}
        </div>
        {can('RECEIPTS_CREATE') && <DropZone compact multiple icon="📋" title="Drop RFI screenshots or PDFs here" subtitle="Upload and link existing RFI to this job" onFilesSelected={files => onUploadDocument(selected, 'rfi')}/>}

        <div className="rfi-waiting-section">
          <div className="rfi-waiting-header">
            <h3 className="rfi-waiting-title"><span>⏳</span> Waiting for reply ({waiting.length})</h3>
            {waiting.length > 0 && <span className="status off" style={{ fontSize: '11px' }}>Action required</span>}
          </div>
          {waiting.length > 0 ? (
            <div className="document-grid">
              {waiting.map(item => (
                <article className="document-card rfi-waiting-card" key={item.id}>
                  <button type="button" className="doc-main receipt-details-trigger" onClick={() => setSelectedDocument(item)} aria-label={`View details for ${item.rfi_subject || item.vendor || item.filename || item.rfi_number || 'RFI'}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px' }}>
                      <h3>{item.rfi_number ? `${item.rfi_number} · ${item.rfi_subject || item.filename}` : (item.rfi_subject || item.vendor || item.filename)}</h3>
                      <span className="status off" style={{ whiteSpace: 'nowrap', fontSize: '10px' }}>Waiting for reply</span>
                    </div>
                    <p>{item.rfi_to ? `To: ${item.rfi_to}` : (item.filename || 'Created in app')}</p>
                    <div className="doc-meta">
                      {item.rfi_due_at && <span className="rfi-due-badge">Due: {fmtDate(item.rfi_due_at)}</span>}
                      <span>Created: {fmtDate(item.created_at || item.incurred_at)}</span>
                    </div>
                    <span className="receipt-view-hint" style={{ color: '#b45309', fontWeight: 600 }}>Respond / View details →</span>
                  </button>
                  {(item.web_url || item.mime_type) && <a className="open-file" href={item.web_url || `${API_URL}/receipts/${item.id}/file`} target="_blank" rel="noreferrer">Open</a>}
                </article>
              ))}
            </div>
          ) : (
            <div style={{ padding: '14px', background: '#ffffff', borderRadius: '8px', border: '1px dashed #fcd34d', textAlign: 'center', color: '#78350f', fontSize: '13px' }}>
              ✓ All RFIs have received a reply. None currently waiting.
            </div>
          )}
        </div>

        {closed.length > 0 && (
          <div className="rfi-closed-section">
            <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px 0', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>✓</span> Closed & answered ({closed.length})
            </h3>
            <div className="document-grid">
              {closed.map(item => (
                <article className="document-card" key={item.id} style={{ opacity: 0.9 }}>
                  <button type="button" className="doc-main receipt-details-trigger" onClick={() => setSelectedDocument(item)} aria-label={`View details for ${item.rfi_subject || item.vendor || item.filename || item.rfi_number || 'RFI'}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px' }}>
                      <h3>{item.rfi_number ? `${item.rfi_number} · ${item.rfi_subject || item.filename}` : (item.rfi_subject || item.vendor || item.filename)}</h3>
                      <span className="status on" style={{ whiteSpace: 'nowrap', fontSize: '10px' }}>Closed</span>
                    </div>
                    <p>{item.filename || item.rfi_subject || 'Created in app'}</p>
                    <div className="doc-meta">
                      <span>Answered: {fmtDate(item.closed_at || item.created_at)}</span>
                    </div>
                    <span className="receipt-view-hint">View details</span>
                  </button>
                  {(item.web_url || item.mime_type) && <a className="open-file" href={item.web_url || `${API_URL}/receipts/${item.id}/file`} target="_blank" rel="noreferrer">Open</a>}
                </article>
              ))}
            </div>
          </div>
        )}

        {!items.length && <Empty text="No RFIs created or attached yet."/>}
      </section>
    }

    return <section className="panel job-section"><div className="section-head"><div><h2>{title}</h2><p>{detail?.[key]?.length || 0} attached</p></div>{key === 'quotes' && can('JOBS_UPDATE') && <button type="button" className="button" onClick={() => setQuoteEditor({})}>+ New quote</button>}{!kind && can('RECEIPTS_CREATE') && (key === 'rfis' ? <button className="button" onClick={() => onCreateRfi(selected)}>+ Create RFI</button> : <button className="button" onClick={() => onUploadDocument(selected, 'receipt')}>+ Add receipt</button>)}</div>{kind && can('JOBS_UPDATE') && <DropZone compact multiple={false} icon="📐" title={`Drop ${kind} file here or browse`} subtitle={`Attach ${kind} image or PDF to ${selected.code}`} onFilesSelected={files => upload(kind, files[0])}/>}{key === 'receipts' && can('RECEIPTS_CREATE') && <DropZone compact multiple icon="🧾" title="Drop receipts here to attach to this job" subtitle="Uploads and extracts details with OCR automatically" onFilesSelected={onReceiptFiles}/>}{key === 'receipts' && receiptJobs.length > 0 && <details className="job-previews-details ocr-details-toggle" open style={{ marginTop: '16px', marginBottom: '16px' }}><summary className="ocr-toggle-summary" style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: 600, color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}><span>🧾</span> Receipt previews ({receiptJobs.length})</span><small className="ocr-toggle-badge" style={{ background: '#dcfce7', color: '#15803d' }}>{receiptJobs.some(j => ['queued', 'processing'].includes(j.status)) ? 'Reading receipts…' : 'Tap to collapse / expand'}</small></summary><div style={{ marginTop: '12px', paddingLeft: '4px', paddingRight: '4px' }}><p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#555e70' }}>Review and confirm previews before they are finalized into this job.</p>{receiptJobs.map(preview => <div className={`background-job ${preview.status}`} key={preview.job_id} style={{ marginBottom: '8px' }}><div className={['queued','processing'].includes(preview.status) ? 'spinner small' : 'job-ready'}>{preview.status === 'completed' ? '✓' : preview.status === 'failed' ? '!' : ''}</div><div><strong>{preview.filename}</strong><span>{preview.status === 'completed' ? 'OCR preview ready · Tap Review to finalize' : preview.status === 'failed' ? (preview.error || 'OCR failed—manual review available') : 'Processing receipt in the background…'}</span></div><button className="button secondary" onClick={() => onOpenPreview(selected, preview)} disabled={!['completed','failed'].includes(preview.status)}>Review</button></div>)}</div></details>}<div className="document-grid">{(detail?.[key] || []).map(item => item.record_type === 'structured_quote' ? <article className="document-card quote-card" key={item.id}><div className="doc-main"><h3>{item.title}</h3><p>{item.items?.length || 0} items · {money(item.total, item.currency || 'CAD')}</p><ul>{item.items?.slice(0, 3).map((line, index) => <li key={index}>{line.quantity} × {line.name}</li>)}</ul></div>{can('JOBS_UPDATE') && <div className="quote-card-actions"><button type="button" className="open-file" onClick={() => setQuoteEditor(item)}>Edit quote</button><button type="button" className="delete-file" onClick={() => removeQuote(item)} aria-label={`Remove ${item.title}`}>×</button></div>}</article> : <article className="document-card" key={item.id}><button type="button" className="doc-main receipt-details-trigger" onClick={() => !kind && setSelectedDocument(item)} aria-label={`View details for ${item.rfi_subject || item.vendor || item.filename || item.rfi_number || 'RFI'}`} disabled={Boolean(kind)}><h3>{item.rfi_number || item.rfi_subject || item.vendor || item.filename}</h3><p>{item.filename || item.rfi_subject || 'Created in app'}</p><div className="doc-meta">{item.document_type === 'rfi' && <span className={`status ${item.status === 'closed' || item.closed_at ? 'on' : 'off'}`}>{item.status === 'closed' || item.closed_at ? 'Closed' : 'Open'}</span>}{item.document_type === 'receipt' ? <><span>Receipt date: {fmtDate(item.incurred_at)}</span><span>Uploaded: {fmtDate(item.created_at)}</span></> : <span>{fmtDate(item.created_at || item.incurred_at)}</span>}{item.amount != null && item.document_type === 'receipt' && <span>{money(item.amount, item.currency)}</span>}</div>{!kind && <span className="receipt-view-hint">View details</span>}</button>{kind ? <a className="open-file" href={item.web_url || `${API_URL}/jobs/${selectedId}/files/${item.id}`} target="_blank" rel="noreferrer">Open</a> : (item.web_url || item.mime_type) && <a className="open-file" href={item.web_url || `${API_URL}/receipts/${item.id}/file`} target="_blank" rel="noreferrer">Open</a>}{item.document_type === 'receipt' && item.amount != null && <button type="button" className="open-file" onClick={() => onViewReport(selected, item)}>View in report</button>}{kind && can('JOBS_UPDATE') && <button className="delete-file" onClick={() => remove(item)} aria-label={`Remove ${item.filename}`}>x</button>}</article>)}{!detail?.[key]?.length && <Empty text={`No ${title.toLowerCase()} attached yet.`}/>}</div></section>
  }
  return <section><div className="section-head"><div><h2>Jobs</h2><p>Keep receipts, quotes, drawings, and RFIs together.</p></div></div><div className="job-selector panel"><label htmlFor="job-search">Search jobs</label><div className="job-search-wrap" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false) }}><input id="job-search" type="search" role="combobox" aria-autocomplete="list" aria-expanded={searchOpen} aria-controls="job-suggestions" aria-activedescendant={searchOpen && suggestions.length ? `job-option-${suggestions[activeSuggestion]?.id}` : undefined} autoComplete="off" value={jobSearch} onFocus={() => setSearchOpen(true)} onChange={event => { setJobSearch(event.target.value); setActiveSuggestion(0); setSearchOpen(true) }} onKeyDown={onSearchKeyDown} placeholder="Search by job or code, or create a job"/>{searchOpen && <div id="job-suggestions" className="job-suggestions" role="listbox">{suggestions.map((job, index) => <button type="button" role="option" aria-selected={index === activeSuggestion} id={`job-option-${job.id}`} key={job.id} className={index === activeSuggestion ? 'active' : ''} onMouseEnter={() => setActiveSuggestion(index)} onClick={() => selectJob(job)}><strong>{job.code} · {job.name}</strong><span>{job.company || 'Company not set'}</span></button>)}{!suggestions.length && <p>No jobs match your search.</p>}{shouldSuggestCreate && <button type="button" className="job-create-suggestion" onClick={openCreateForCompany}><strong>+ Create job for {jobSearch.trim()}</strong><span>Company will be filled in for you</span></button>}{matchingJobs.length > suggestions.length && <small>Keep typing to narrow {matchingJobs.length} matches.</small>}</div>}</div><div className="job-search-footer"><small>{selected ? `Selected: ${selected.code} · ${selected.name}` : `${jobs.length} jobs available`}</small>{can('JOBS_CREATE') && <button type="button" className="button secondary" onClick={openCreateForCompany}>+ Create job</button>}</div></div>{can('JOBS_CREATE') && <details className="job-create panel" ref={createPanel}><summary>+ Create job</summary><form className="form" onSubmit={create}><div className="form-row"><label>Job code<input required maxLength="80" value={form.code} onChange={event => setForm({...form, code: event.target.value})} placeholder="JOB-1042"/></label><label>Job name<input required maxLength="200" value={form.name} onChange={event => setForm({...form, name: event.target.value})} placeholder="Project name"/></label></div><label>Company<input maxLength="200" value={form.company} onChange={event => setForm({...form, company: event.target.value})} placeholder="Client or company name"/></label><label>Description<input maxLength="2000" value={form.description} onChange={event => setForm({...form, description: event.target.value})}/></label><button className="button" disabled={busy}>{busy ? 'Creating...' : '+ Create job'}</button></form></details>}{!jobs.length && <Empty text="No jobs yet. Create one to attach its documents."/>}{selected && <div className="job-details" ref={jobDetailsRef}><h2>{selected.code}: {selected.name}</h2>{can('JOBS_UPDATE') ? <form className="job-company-editor" onSubmit={saveCompany}><label>Company<input maxLength="200" value={companyDraft} onChange={event => setCompanyDraft(event.target.value)} placeholder="Add company name"/></label><button type="submit" className="button secondary" disabled={companySaving || companyDraft.trim() === (selected.company || '')}>{companySaving ? 'Saving...' : 'Save company'}</button></form> : <p className="job-company-label">{selected.company || 'Company not set'}</p>}<div className="job-tabs" role="tablist" aria-label="Job documents">{JOB_SECTIONS.filter(([key]) => key !== 'gas').map(([key,label]) => <button type="button" role="tab" aria-selected={jobSection === key || (key === 'receipts' && jobSection === 'gas')} className={jobSection === key || (key === 'receipts' && jobSection === 'gas') ? 'active' : ''} key={key} onClick={() => setJobSection(key)}>{label}{key !== 'budget' && <span>{detail?.[key]?.length || 0}</span>}</button>)}</div><div role="tabpanel">{jobSection === 'budget' && <JobBudget job={selected} summary={detail?.budget} canEdit={can('JOBS_UPDATE')} onSave={saveBudget}/>} {jobSection === 'quotes' && section('Quotes', 'quotes', 'quote')}{jobSection === 'receipts' && section('Receipts', 'receipts')}{jobSection === 'gas' && <GasVehicles vehicles={vehicles} receipts={(allReceipts || []).filter(item => item.category === 'gas' && item.vehicle_id)} canCreate={can('RECEIPTS_CREATE')} canDelete={can('RECEIPTS_DELETE')} onRefresh={() => onRefresh()} onAddReceipt={() => onUploadDocument(selected, 'gas-receipt')}/>}{jobSection === 'rfis' && section('RFIs', 'rfis')}{jobSection === 'drawings' && section('Drawings', 'drawings', 'drawing')}</div></div>}{quoteEditor && selected && <QuoteForm job={selected} quote={quoteEditor.id ? quoteEditor : null} onSave={saveQuote} onClose={() => setQuoteEditor(null)}/>}{selectedDocument?.document_type === 'rfi' && <RfiDetails rfi={selectedDocument} job={selected} can={can} onClose={() => setSelectedDocument(null)}/>}
       {selectedDocument && selectedDocument.document_type !== 'rfi' && <Modal title="Receipt details" onClose={() => setSelectedDocument(null)}><div className="receipt-info"><h3>{selectedDocument.vendor || selectedDocument.filename}</h3><details className="ocr-details-toggle" style={{ marginBottom: '16px' }}><summary className="ocr-toggle-summary" style={{ padding: '12px 16px', background: '#f4f5fa', border: '1px solid var(--line)', borderRadius: '10px', cursor: 'pointer' }}><span>🔍 View image / document preview</span><small className="ocr-toggle-badge">Tap to expand</small></summary><div className="receipt-info-preview" style={{ margin: '12px 0 0 0' }}>{selectedDocument.web_url ? <p>Original file is stored in Google Drive. Use the link below to view it.</p> : selectedDocument.mime_type?.startsWith('image/') && !documentPreviewError ? <img src={`${API_URL}/receipts/${selectedDocument.id}/file`} alt={`Preview of ${selectedDocument.filename}`} onError={() => setDocumentPreviewError(true)}/> : documentPreviewUrl && selectedDocument.mime_type === 'application/pdf' ? <iframe title="Document preview" src={documentPreviewUrl}/> : documentPreviewError ? <p>Preview unavailable. Open the original file below.</p> : <p>Loading preview...</p>}</div></details><dl><div><dt>File</dt><dd>{selectedDocument.filename}</dd></div><div><dt>Receipt date</dt><dd>{fmtDate(selectedDocument.incurred_at)}</dd></div><div><dt>Uploaded</dt><dd>{fmtDate(selectedDocument.created_at)}</dd></div>{selectedDocument.document_type === 'receipt' && <><div><dt>Amount</dt><dd>{selectedDocument.amount == null ? 'Not recorded' : money(selectedDocument.amount, selectedDocument.currency)}</dd></div><div><dt>Type</dt><dd>{selectedDocument.transaction_type || 'Expense'}</dd></div></>}<div><dt>Category</dt><dd>{categoryLabel(selectedDocument.category)}</dd></div><div><dt>Job</dt><dd>{selected?.code || selectedDocument.link_id}</dd></div></dl>{selectedDocument.ocr_text && <details className="ocr-details-toggle" style={{ marginBottom: '16px' }}><summary className="ocr-toggle-summary" style={{ padding: '12px 16px', background: '#f4f5fa', border: '1px solid var(--line)', borderRadius: '10px', cursor: 'pointer' }}><span>📝 Extracted text</span><small className="ocr-toggle-badge">Tap to view</small></summary><pre style={{ margin: '12px 0 0 0' }}>{selectedDocument.ocr_text}</pre></details>}<a className="button" href={selectedDocument.web_url || `${API_URL}/receipts/${selectedDocument.id}/file`} target="_blank" rel="noreferrer">Open original file</a></div></Modal>}</section>
}

function RfiCreateForm({ job, onSave, onClose }) {
  const [form, setForm] = useState({ rfi_number: '', rfi_subject: '', rfi_question: '', rfi_to: '', rfi_attention_name: '', rfi_attention_phone: '', rfi_attention_email: '', incurred_at: new Date().toISOString().slice(0, 10), rfi_due_at: '' })
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    const data = { ...form, rfi_due_at: form.rfi_due_at || null }
    try { await onSave(data, files) } catch (cause) { setError(cause.message) } finally { setBusy(false) }
  }
  return <Modal wide title={`New RFI for ${job.code}`} onClose={onClose}><form className="rfi-response-form rfi-create-form" onSubmit={submit}><p>Project: <strong>{job.name}</strong></p>{error && <p className="rfi-error">{error}</p>}<div className="form-row"><label>RFI number<input maxLength="80" value={form.rfi_number} onChange={e => setForm({...form, rfi_number: e.target.value})} placeholder="RFI 031"/></label><label>Request date<input required type="date" value={form.incurred_at} onChange={e => setForm({...form, incurred_at: e.target.value})}/></label></div><label>Subject<input required maxLength="200" value={form.rfi_subject} onChange={e => setForm({...form, rfi_subject: e.target.value})} placeholder="Thermostat locations"/></label><label>To - company and mailing address<textarea rows="4" maxLength="1000" value={form.rfi_to} onChange={e => setForm({...form, rfi_to: e.target.value})} placeholder="Company name, address, and any additional recipients"/></label><div className="form-row"><label>Attention<input maxLength="200" value={form.rfi_attention_name} onChange={e => setForm({...form, rfi_attention_name: e.target.value})} placeholder="Contact name"/></label><label>Phone<input type="tel" maxLength="80" value={form.rfi_attention_phone} onChange={e => setForm({...form, rfi_attention_phone: e.target.value})}/></label></div><label>Attention email<input type="email" maxLength="200" value={form.rfi_attention_email} onChange={e => setForm({...form, rfi_attention_email: e.target.value})}/></label><label>Information requested<textarea required rows="7" maxLength="5000" value={form.rfi_question} onChange={e => setForm({...form, rfi_question: e.target.value})} placeholder="Describe the clarification needed"/></label><label>Response required by<input type="date" value={form.rfi_due_at} onChange={e => setForm({...form, rfi_due_at: e.target.value})}/></label><div style={{marginTop:'8px'}}><label style={{display:'block',fontSize:'12px',fontWeight:600,color:'#555e70',marginBottom:'6px'}}>Supporting images or PDFs</label><DropZone compact multiple icon="📎" title="Drop supporting files here or browse" subtitle={files.length > 0 ? `${files.length} file(s) attached: ${files.map(f => f.name).join(', ')}` : "Select or drop multiple files (PDF/images)"} onFilesSelected={selectedFiles => setFiles(cur => [...cur, ...Array.from(selectedFiles)])}/></div><div className="rfi-form-actions" style={{marginTop:'18px'}}><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button" disabled={busy}>{busy ? 'Creating...' : 'Create RFI'}</button></div></form></Modal>
}

function RfiDetails({ rfi, job, can, onClose }) {
  const [responses, setResponses] = useState([])
  const [shareUrl, setShareUrl] = useState('')
  const [shareBusy, setShareBusy] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const [attachmentError, setAttachmentError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const [responseFile, setResponseFile] = useState(null)
  const [answer, setAnswer] = useState({ responder_name: '', response_text: '', responded_at: new Date().toISOString().slice(0, 10) })
  const fileInput = useRef(null)
  useEffect(() => {
    let active = true
    api(`/receipts/${rfi.id}/attachments`)
      .then(items => { if (active) setAttachments(items) })
      .catch(error => { if (active) setAttachmentError(error.message) })
    api(`/receipts/${rfi.id}/responses`)
      .then(items => { if (active) setResponses(items) })
      .catch(error => { if (active) setLoadError(error.message) })
    return () => { active = false }
  }, [rfi.id])
  const submit = async (event) => {
    event.preventDefault(); setBusy(true)
    const data = new FormData()
    Object.entries(answer).forEach(([key, value]) => data.append(key, value))
    if (responseFile) data.append('file', responseFile)
    try {
      const saved = await api(`/receipts/${rfi.id}/responses`, { method: 'POST', body: data })
      setResponses(current => [...current, saved])
      setAnswer({ responder_name: '', response_text: '', responded_at: new Date().toISOString().slice(0, 10) })
      setResponseFile(null)
      if (fileInput.current) fileInput.current.value = ''
      setLoadError('')
    } catch (error) { setLoadError(error.message) } finally { setBusy(false) }
  }
  const addAttachments = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    setAttachmentBusy(true); setAttachmentError('')
    try {
      for (const file of files) {
        const body = new FormData()
        body.append('file', file)
        const saved = await api(`/receipts/${rfi.id}/attachments`, { method: 'POST', body })
        setAttachments(current => [...current, saved])
      }
    } catch (error) { setAttachmentError(error.message) }
    finally { setAttachmentBusy(false); if (event.target.value) event.target.value = '' }
  }
  const removeAttachment = async (id) => {
    if (!window.confirm('Remove this supporting file?')) return
    try {
      await api(`/receipts/${rfi.id}/attachments/${id}`, { method: 'DELETE' })
      setAttachments(current => current.filter(item => item.id !== id))
      setAttachmentError('')
    } catch (error) { setAttachmentError(error.message) }
  }
  const createShareLink = async () => {
    setShareBusy(true)
    try {
      const result = await api(`/receipts/${rfi.id}/share-link`, { method: 'POST' })
      setShareUrl(`${window.location.origin}/rfi/respond#${result.token}`)
      setLoadError('')
    } catch (error) { setLoadError(error.message) } finally { setShareBusy(false) }
  }
  const revokeShareLink = async () => {
    try {
      await api(`/receipts/${rfi.id}/share-link`, { method: 'DELETE' })
      setShareUrl('')
      setLoadError('')
    } catch (error) { setLoadError(error.message) }
  }
  const originalUrl = rfi.web_url || `${API_URL}/receipts/${rfi.id}/file`
  const isClosed = responses.length > 0 || rfi.status === 'closed' || Boolean(rfi.closed_at)
  return <Modal wide title={rfi.rfi_number || 'RFI details'} onClose={onClose}><div className="rfi-detail"><header className="rfi-heading"><div><span>REQUEST FOR INFORMATION</span><h3>{rfi.rfi_subject || rfi.vendor || rfi.filename}</h3><p>{job?.name || rfi.link_label || rfi.link_id || 'Project'} · {fmtDate(rfi.incurred_at)}</p></div><strong className={isClosed ? 'status on' : 'status off'} style={{fontSize:'12px',padding:'6px 14px'}}>{isClosed ? '✓ Closed (Answered)' : 'Open (Awaiting response)'}</strong></header><dl className="rfi-fields"><div><dt>RFI number</dt><dd>{rfi.rfi_number || 'Not recorded'}</dd></div><div><dt>Status</dt><dd><span className={`status ${isClosed ? 'on' : 'off'}`}>{isClosed ? 'Closed' : 'Open'}</span></dd></div><div><dt>Response required by</dt><dd>{rfi.rfi_due_at ? fmtDate(rfi.rfi_due_at) : 'Not set'}</dd></div><div><dt>Job</dt><dd>{job?.code || rfi.link_id}</dd></div></dl><section className="rfi-recipient"><div><h4>To</h4><p>{rfi.rfi_to || 'Not recorded'}</p></div><div><h4>Attention</h4><p>{rfi.rfi_attention_name || 'Not recorded'}</p>{rfi.rfi_attention_phone && <p>{rfi.rfi_attention_phone}</p>}{rfi.rfi_attention_email && <p><a href={`mailto:${rfi.rfi_attention_email}`}>{rfi.rfi_attention_email}</a></p>}</div></section><section className="rfi-question"><h4>Information requested</h4><p>{rfi.rfi_question || rfi.ocr_text || 'No question text captured. Open the original RFI below.'}</p></section>{(rfi.web_url || rfi.mime_type) && <section className="rfi-original"><h4>Original RFI</h4>{rfi.web_url ? <p>Stored in Google Drive. Open the original file below.</p> : previewError ? <p>Preview unavailable. Open the original file below.</p> : rfi.mime_type?.startsWith('image/') ? <img src={originalUrl} alt={`Preview of ${rfi.filename}`} onError={() => setPreviewError(true)}/> : rfi.mime_type === 'application/pdf' ? <iframe title="Original RFI" src={originalUrl}/> : null}<a href={originalUrl} target="_blank" rel="noreferrer">Open original file</a></section>}<section className="rfi-attachments"><h4>Supporting images and PDFs</h4>{attachmentError && <p className="rfi-error">{attachmentError}</p>}{attachments.length ? <div className="rfi-attachment-grid">{attachments.map(item => { const url = item.web_url || `${API_URL}/receipts/${rfi.id}/attachments/${item.id}/file`; return <article key={item.id}>{item.mime_type?.startsWith('image/') && !item.web_url && <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={item.filename}/></a>}<a href={url} target="_blank" rel="noreferrer">{item.filename}</a>{can('RECEIPTS_UPDATE') && <button type="button" className="button secondary" onClick={() => removeAttachment(item.id)}>Remove</button>}</article> })}</div> : <p>No supporting files added yet.</p>}{can('RECEIPTS_UPDATE') && <div style={{marginTop:'10px'}}><DropZone compact multiple icon="📎" title="Drop supporting files here to add" subtitle={attachmentBusy ? "Uploading attachments..." : "Select or drop multiple files (PDF/images)"} onFilesSelected={files => addAttachments({ target: { files } })}/></div>}</section>{can('RECEIPTS_UPDATE') && <section className="rfi-sharing"><h4>External response link</h4><p>Anyone with this link can view this RFI and submit a response without signing in. The link expires in 30 days.</p><button type="button" className="button secondary" disabled={shareBusy} onClick={createShareLink}>{shareBusy ? 'Creating...' : 'Create new link'}</button>{shareUrl && <><label>Share this link<input readOnly value={shareUrl} onFocus={e => e.target.select()}/></label><div className="rfi-share-actions"><button type="button" className="button secondary" onClick={() => navigator.clipboard.writeText(shareUrl).catch(() => setLoadError('Select and copy the link above.'))}>Copy link</button><button type="button" className="button secondary" onClick={revokeShareLink}>Revoke link</button></div></>}</section>}<section className="rfi-answers"><h4>Responses</h4>{loadError && <p className="rfi-error">{loadError}</p>}{responses.length ? responses.map(item => <article key={item.id}><header><strong>{item.responder_name}</strong><time>{fmtDate(item.responded_at)}</time></header>{item.response_text && <p>{item.response_text}</p>}{item.filename && <a href={item.web_url || `${API_URL}/receipts/${rfi.id}/responses/${item.id}/file`} target="_blank" rel="noreferrer">View response file: {item.filename}</a>}</article>) : <p>No response has been added yet.</p>}</section>{can('RECEIPTS_UPDATE') && <form className="rfi-response-form" onSubmit={submit}><h4>Add a response</h4><label>Answered by<input required maxLength="200" value={answer.responder_name} onChange={e => setAnswer({...answer, responder_name: e.target.value})} placeholder="Name or company"/></label><label>Response date<input required type="date" value={answer.responded_at} onChange={e => setAnswer({...answer, responded_at: e.target.value})}/></label><label>Answer<textarea rows="5" maxLength="10000" required={!responseFile} value={answer.response_text} onChange={e => setAnswer({...answer, response_text: e.target.value})} placeholder="Provide the clarification or decision"/></label><label>Response file (optional)<DropZone compact multiple={false} currentFileName={responseFile?.name} title="Drop response file here or browse" subtitle="Supports PDF and images" onFilesSelected={files => setResponseFile(files[0] || null)}/></label><button className="button" disabled={busy}>{busy ? 'Saving...' : 'Add response'}</button></form>}</div></Modal>
}

function DocumentsView({ type, items, jobs, can, onUpload, onReceiptFiles, onOpenJob, onDelete }) {
  const shown = items.filter(item => item.document_type === type)
  const pending = jobs.filter(job => job.documentType === type)
  const waitingRfis = type === 'rfi' ? shown.filter(item => item.status !== 'closed' && !item.closed_at && (!item.responses || item.responses.length === 0)) : []
  const closedRfis = type === 'rfi' ? shown.filter(item => item.status === 'closed' || item.closed_at || (item.responses && item.responses.length > 0)) : []

  return <section><div className="section-head"><div><h2>{type === 'rfi' ? 'Requests for information' : 'Receipts & transactions'}</h2><p>{type === 'rfi' ? `${waitingRfis.length} waiting for reply · ${closedRfis.length} closed (${shown.length} total)` : 'Upload, categorize, and track every business receipt.'}</p></div>{can('RECEIPTS_CREATE') && (type === 'receipt' ? <button type="button" className="button upload-top" onClick={() => onUpload()}>+ Upload receipt</button> : <button type="button" className="button upload-top" onClick={onUpload}>+ New RFI</button>)}</div>{can('RECEIPTS_CREATE') && <DropZone multiple icon={type === 'rfi' ? '📋' : '＋'} title={type === 'rfi' ? 'Tap or drop RFI documents & screenshots here' : 'Tap to scan or drop receipts here'} subtitle={type === 'rfi' ? 'Select or drop up to 20 files to upload · Mobile camera & PDF supported' : 'Select or drop up to 20 files · OCR runs in the background'} onFilesSelected={onReceiptFiles}/>}{pending.length > 0 && <details className="job-previews-details ocr-details-toggle" open style={{ marginTop: '16px', marginBottom: '16px' }}><summary className="ocr-toggle-summary" style={{ padding: '10px 14px', background: type === 'rfi' ? '#fffdf5' : '#f0fdf4', border: `1px solid ${type === 'rfi' ? '#fde68a' : '#bbf7d0'}`, borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: 600, color: type === 'rfi' ? '#92400e' : '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}><span>{type === 'rfi' ? '📋' : '🧾'}</span> {type === 'rfi' ? 'Document' : 'Receipt'} previews ({pending.length})</span><small className="ocr-toggle-badge" style={{ background: type === 'rfi' ? '#fef3c7' : '#dcfce7', color: type === 'rfi' ? '#b45309' : '#15803d' }}>{pending.some(j => ['queued', 'processing'].includes(j.status)) ? 'Processing…' : 'Tap to collapse / expand'}</small></summary><div style={{ marginTop: '12px' }}>{pending.map(job => <div className={`background-job ${job.status}`} key={job.job_id}><div className={['queued','processing'].includes(job.status) ? 'spinner small' : 'job-ready'}>{job.status === 'completed' ? '✓' : job.status === 'failed' ? '!' : ''}</div><div><strong>{job.filename}</strong><span>{job.status === 'completed' ? 'OCR preview is ready' : job.status === 'failed' ? (job.error || 'OCR failed—manual review is available') : `Processing ${type === 'rfi' ? 'document' : 'receipt'} in the background…`}</span></div>{['completed','failed'].includes(job.status) && <button className="button secondary" onClick={() => onOpenJob(job)}>Open preview</button>}</div>)}</div></details>}
  {type === 'rfi' && (
    <>
      <div className="rfi-waiting-section">
        <div className="rfi-waiting-header">
          <h3 className="rfi-waiting-title"><span>⏳</span> Waiting for reply ({waitingRfis.length})</h3>
          {waitingRfis.length > 0 && <span className="status off" style={{ fontSize: '11px' }}>Action required</span>}
        </div>
        {waitingRfis.length > 0 ? (
          <div className="document-grid">
            {waitingRfis.map(item => (
              <article className="document-card rfi-waiting-card" key={item.id}>
                <div className="file-icon">?</div>
                <div className="doc-main">
                  <div className="doc-title"><h3>{item.rfi_number ? `${item.rfi_number} · ${item.rfi_subject || item.filename}` : (item.rfi_subject || item.vendor || item.link_label || item.filename)}</h3><span className="status off" style={{ whiteSpace: 'nowrap', fontSize: '10px' }}>Waiting for reply</span></div>
                  <p>{item.filename}</p>
                  <div className="doc-meta">
                    {item.rfi_due_at && <span className="rfi-due-badge">Due: {fmtDate(item.rfi_due_at)}</span>}
                    <span>{fmtDate(item.incurred_at || item.created_at)}</span>
                    {item.link_id && <span className="linked">{item.link_type}: {item.link_id}</span>}
                  </div>
                </div>
                {item.web_url && <a className="open-file" href={item.web_url} target="_blank" rel="noreferrer">Open ↗</a>}
                {can('RECEIPTS_DELETE') && <button className="delete-file" onClick={() => onDelete(item)}>×</button>}
              </article>
            ))}
          </div>
        ) : (
          <div style={{ padding: '14px', background: '#ffffff', borderRadius: '8px', border: '1px dashed #fcd34d', textAlign: 'center', color: '#78350f', fontSize: '13px' }}>
            ✓ All RFIs have received a reply. None currently waiting.
          </div>
        )}
      </div>

      {closedRfis.length > 0 && (
        <div className="rfi-closed-section">
          <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px 0', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>✓</span> Closed & answered ({closedRfis.length})
          </h3>
          <div className="document-grid">
            {closedRfis.map(item => (
              <article className="document-card" key={item.id} style={{ opacity: 0.9 }}>
                <div className="file-icon">?</div>
                <div className="doc-main">
                  <div className="doc-title"><h3>{item.rfi_number ? `${item.rfi_number} · ${item.rfi_subject || item.filename}` : (item.rfi_subject || item.vendor || item.link_label || item.filename)}</h3><span className="status on" style={{ whiteSpace: 'nowrap', fontSize: '10px' }}>Closed</span></div>
                  <p>{item.filename}</p>
                  <div className="doc-meta">
                    <span>Answered: {fmtDate(item.closed_at || item.created_at)}</span>
                    {item.link_id && <span className="linked">{item.link_type}: {item.link_id}</span>}
                  </div>
                </div>
                {item.web_url && <a className="open-file" href={item.web_url} target="_blank" rel="noreferrer">Open ↗</a>}
                {can('RECEIPTS_DELETE') && <button className="delete-file" onClick={() => onDelete(item)}>×</button>}
              </article>
            ))}
          </div>
        </div>
      )}
      {!shown.length && !pending.length && <Empty text="No RFI screenshots uploaded yet."/>}
    </>
  )}
  {type !== 'rfi' && (
    <div className="document-grid">{shown.map(item => <article className="document-card" key={item.id}><div className="file-icon">▧</div><div className="doc-main"><div className="doc-title"><h3>{item.vendor || item.link_label || item.filename}</h3>{item.amount != null && <strong className={item.transaction_type === 'income' ? 'income' : ''}>{item.transaction_type === 'income' ? '+' : '−'}{money(item.amount, item.currency)}</strong>}</div><p>{item.filename}</p><div className="doc-meta"><span>{categoryLabel(item.category)}</span><span>{fmtDate(item.incurred_at)}</span><span>{item.storage_provider === 'google_drive' ? 'Google Drive' : 'Local storage'}</span>{item.link_id && <span className="linked">{item.link_type}: {item.link_id}</span>}</div>{item.ocr_text && <details><summary>OCR text</summary><pre>{item.ocr_text}</pre></details>}</div>{item.web_url && <a className="open-file" href={item.web_url} target="_blank" rel="noreferrer">Open ↗</a>}{can('RECEIPTS_DELETE') && <button className="delete-file" onClick={() => onDelete(item)}>×</button>}</article>)}{!shown.length && !pending.length && <Empty text="No receipts uploaded yet."/>}</div>
  )}
  {can('RECEIPTS_CREATE') && (type === 'receipt' ? <button type="button" className="mobile-fab" onClick={() => onUpload()}><span>＋</span>Add receipts</button> : <button type="button" className="mobile-fab" onClick={onUpload}><span>＋</span>New RFI</button>)}</section>
}

function Reports({ summary, year, setYear, jobs, receipts, jobId, setJobId }) {
  if (!summary) return <Empty text="Financial reports require receipt read access."/>
  const reportYears = [...new Set([...(year === 'all' ? [] : [year]), new Date().getFullYear(), ...receipts
    .filter(item => item.document_type === 'receipt' && item.amount != null && item.incurred_at)
    .map(item => new Date(item.incurred_at).getUTCFullYear())
    .filter(Number.isInteger)])].sort((a, b) => b - a)
  const periods = (year === 'all' ? summary.years : summary.months)?.filter(m => m.income || m.expenses) || []
  const max = Math.max(1, ...periods.flatMap(m => [m.income, m.expenses]))

  return <section><div className="section-head"><div><h2>Profit & loss</h2><p>Weekly, monthly, and yearly totals from uploaded transactions.</p></div><div className="report-filters"><label>Job<select value={jobId} onChange={e => setJobId(e.target.value)}><option value="">All jobs</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.code} - {job.name}{job.company ? ` (${job.company})` : ''}</option>)}</select></label><label>Year<select value={year} onChange={e => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}><option value="all">All years</option>{reportYears.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div></div><div className="stats finance-stats"><article><span>Total income</span><strong className="income">{money(summary.income, summary.currency)}</strong><small>{year === 'all' ? 'All years' : year} recorded income</small></article><article><span>Total expenses</span><strong>{money(summary.expenses, summary.currency)}</strong><small>{year === 'all' ? 'All years' : year} categorized spend</small></article><article><span>Net profit / loss</span><strong className={summary.profit_loss >= 0 ? 'income' : 'loss'}>{money(summary.profit_loss, summary.currency)}</strong><small>Income minus expenses</small></article></div><div className="report-grid"><article className="panel"><h3>{year === 'all' ? 'Yearly overview' : 'Monthly overview'}</h3><p>Income and expenses by {year === 'all' ? 'year' : 'month'}</p><div className="bars">{periods.length ? periods.map(m => <div className="bar-row" key={year === 'all' ? m.year : m.month}><span>{year === 'all' ? m.year : new Intl.DateTimeFormat(undefined,{month:'short'}).format(new Date(2024,m.month-1))}</span><div><i className="expense-bar" style={{width:`${m.expenses/max*100}%`}}/><i className="income-bar" style={{width:`${m.income/max*100}%`}}/></div><strong>{money(m.income-m.expenses, summary.currency)}</strong></div>) : <Empty text="No transactions in this selection."/>}</div></article><article className="panel"><h3>Expense categories</h3><p>{year === 'all' ? 'Spending across all years' : 'Year-to-date spending'}</p><div className="category-totals">{Object.entries(summary.categories || {}).map(([name,value]) => <div key={name}><span>{categoryLabel(name)}</span><strong>{money(value, summary.currency)}</strong></div>)}</div><h3 className="weekly-title">{year === 'all' ? 'Yearly totals' : 'Weekly totals'}</h3><div className="weekly-list">{(year === 'all' ? summary.years : summary.weeks)?.slice(-6).reverse().map(w => <div key={year === 'all' ? w.year : w.week}><span>{year === 'all' ? w.year : `Week ${w.week}`}</span><strong>{money(w.income-w.expenses, summary.currency)}</strong></div>)}{!(year === 'all' ? summary.years : summary.weeks)?.length && <span className="dim">No activity</span>}</div></article></div></section>
}

function categoryLabel(value) { return CATEGORIES.find(([id]) => id === value)?.[1] || value?.replaceAll('_',' ') || 'Other' }
function money(value, currency='CAD') { const code = (!currency || currency === 'CHF') ? 'CAD' : currency; return new Intl.NumberFormat(undefined,{style:'currency',currency: code}).format(Number(value || 0)) }

function canFrom(session, permission) { return session.permissions?.includes('*') || session.permissions?.includes(permission) }
function Empty({ text }) { return <div className="empty"><span>◇</span><p>{text}</p></div> }
function Overview({ users, roles, logs, user, setView }) {
  const active = users.filter(u => u.is_active).length
  return <section><div className="welcome"><div><p className="eyebrow">WELCOME BACK</p><h2>Good to see you, {user.full_name?.split(' ')[0]}.</h2><p>Here’s what’s happening across your administration workspace.</p></div><div className="date-card"><span>Today</span><strong>{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</strong></div></div><div className="stats"><article><span>Managed users</span><strong>{users.length}</strong><small>{active} currently active</small></article><article><span>Access roles</span><strong>{roles.length}</strong><small>{roles.filter(r => r.is_active).length} available</small></article><article><span>Recent events</span><strong>{logs.length}</strong><small>Latest 100 audit entries</small></article></div><div className="overview-grid"><article className="panel"><div className="panel-head"><div><h3>Recent activity</h3><p>Latest administrative events</p></div><button onClick={() => setView('audit')}>View all</button></div><div className="activity">{logs.slice(0, 5).map(log => <div key={log.id}><i/><div><strong>{log.action?.replaceAll('_', ' ')}</strong><span>{log.resource_type || 'System event'}</span></div><time>{fmtDate(log.created_at)}</time></div>)}{!logs.length && <Empty text="No recent activity."/>}</div></article><article className="panel quick"><h3>Quick actions</h3><p>Jump to a common task</p><button onClick={() => setView('users')}><span>♙</span><div><strong>Manage users</strong><small>Add, update, or deactivate access</small></div>→</button><button onClick={() => setView('roles')}><span>◇</span><div><strong>Configure roles</strong><small>Review role permissions</small></div>→</button></article></div></section>
}

