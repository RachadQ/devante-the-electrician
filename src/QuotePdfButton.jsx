import { useState } from 'react'
import { api } from './api'

export default function QuotePdfButton({ jobId, quote }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const download = async () => {
    setBusy(true)
    setError('')
    try {
      const blob = await api(`/jobs/${jobId}/quotes/${quote.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = quote.pdf_filename || `quote-${quote.id}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return <div className="quote-pdf-download"><button type="button" className="button secondary" disabled={busy} onClick={download} aria-label={`Download PDF for ${quote.title}`}>{busy ? 'Preparing PDF...' : 'Download PDF'}</button>{error && <p className="rfi-error" role="alert">{error}</p>}</div>
}
