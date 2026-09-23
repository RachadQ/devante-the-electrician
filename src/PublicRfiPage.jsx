import { useEffect, useState } from 'react'
import { API_URL } from './api.js'

const token = window.location.hash.slice(1)

export default function PublicRfiPage() {
  const [rfi, setRfi] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [name, setName] = useState('')
  const [answer, setAnswer] = useState('')
  const [file, setFile] = useState(null)
  const [attachmentUrls, setAttachmentUrls] = useState({})
  useEffect(() => {
    fetch(`${API_URL}/public/rfi`, { credentials: 'omit', headers: { 'X-RFI-Token': token } })
      .then(async response => { if (!response.ok) throw new Error('This RFI link is unavailable or has expired.'); return response.json() })
      .then(setRfi).catch(e => setError(e.message))
  }, [])
  useEffect(() => {
    if (!rfi) return undefined
    let active = true
    const urls = []
    Promise.all(rfi.attachments.map(async item => {
      const response = await fetch(`${API_URL}/public/rfi/attachments/${item.id}/file`, { credentials: 'omit', headers: { 'X-RFI-Token': token } })
      if (!response.ok) return [item.id, null]
      const url = URL.createObjectURL(await response.blob())
      urls.push(url)
      return [item.id, url]
    })).then(entries => { if (active) setAttachmentUrls(Object.fromEntries(entries)) })
    return () => { active = false; urls.forEach(URL.revokeObjectURL) }
  }, [rfi])
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('')
    const body = new FormData()
    body.append('responder_name', name)
    body.append('response_text', answer)
    if (file) body.append('file', file)
    try {
      const response = await fetch(`${API_URL}/public/rfi/responses`, { method: 'POST', body, credentials: 'omit', headers: { 'X-RFI-Token': token } })
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.detail || 'Could not submit your response') }
      setDone(true)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <main className="public-rfi-page"><section className="public-rfi-card"><div className="brand-mark">D</div><p className="eyebrow">DEVANTE · REQUEST FOR INFORMATION</p>{!rfi && !error && <p>Loading RFI...</p>}{rfi && <><h1>{rfi.rfi_subject || rfi.rfi_number || 'RFI'}</h1><p className="muted">{rfi.project || 'Project'}{rfi.rfi_number ? ` · ${rfi.rfi_number}` : ''}</p><div className="rfi-recipient"><div><h4>To</h4><p>{rfi.rfi_to || '—'}</p></div><div><h4>Attention</h4><p>{rfi.rfi_attention_name || '—'}</p></div></div><section className="rfi-question"><h4>Information requested</h4><p>{rfi.rfi_question || 'See the supporting files.'}</p></section>{rfi.rfi_due_at && <p className="muted">Response requested by {new Date(rfi.rfi_due_at).toLocaleDateString()}</p>}{rfi.attachments?.length > 0 && <section className="rfi-attachments"><h4>Supporting files</h4><div className="rfi-attachment-grid">{rfi.attachments.map(item => { const url = attachmentUrls[item.id]; return <article key={item.id}>{url && item.mime_type?.startsWith('image/') && <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={item.filename}/></a>}{url ? <a href={url} download={item.filename}>{item.filename}</a> : <span>{item.filename} (unavailable)</span>}</article> })}</div></section>}{done ? <p className="public-rfi-success" role="status">Your response was submitted. Thank you.</p> : <form className="rfi-response-form" onSubmit={submit}><h4>Your response</h4><label>Your name or company<input required maxLength="200" value={name} onChange={e => setName(e.target.value)}/></label><label>Answer<textarea rows="6" maxLength="10000" required={!file} value={answer} onChange={e => setAnswer(e.target.value)}/></label><label>File (optional: image or PDF)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)}/></label><button className="button" disabled={busy}>{busy ? 'Submitting...' : 'Submit response'}</button></form>}</>}{error && <p className="rfi-error" role="alert">{error}</p>}</section></main>
}
