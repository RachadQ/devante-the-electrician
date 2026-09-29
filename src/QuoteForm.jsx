import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'

const blank = () => ({ id: crypto.randomUUID(), name: '', description: '', source_url: '', quantity: '1', unit_price: '' })
const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'CAD' }).format(Number(value || 0))

export default function QuoteForm({ job, quote, onSave, onClose }) {
  const [title, setTitle] = useState(quote?.title || '')
  const [notes, setNotes] = useState(quote?.notes || '')
  const [items, setItems] = useState(quote?.items?.map(item => ({ id: crypto.randomUUID(), name: item.name, description: item.description || '', source_url: item.source_url || '', quantity: String(item.quantity), unit_price: String(item.unit_price) })) || [blank()])
  const [busy, setBusy] = useState(false)
  const [lookupIds, setLookupIds] = useState([])
  const attempted = useRef(new Set())
  const latestItems = useRef(items)
  latestItems.current = items
  const [error, setError] = useState('')
  
  const change = (index, field, value) => setItems(current => current.map((item, i) => i === index ? { ...item, [field]: value } : item))
  const urls = items.map(item => `${item.id}:${item.source_url.trim()}`).join('\n')

  useEffect(() => {
    const timers = latestItems.current.map(item => {
      const url = item.source_url.trim()
      if (!/^https?:\/\/[^\s.]+\.[^\s]+/i.test(url)) return null
      const key = `${item.id}:${url}`
      if (attempted.current.has(key)) return null
      return setTimeout(async () => {
        if (latestItems.current.find(current => current.id === item.id)?.source_url.trim() !== url) return
        attempted.current.add(key)
        setLookupIds(current => [...current, item.id])
        setError('')
        const before = latestItems.current.find(current => current.id === item.id)
        try {
          const info = await api(`/jobs/${job.id}/quotes/extract-item`, { method: 'POST', body: JSON.stringify({ url }) })
          const cadPrice = info.currency === 'CAD'
          setItems(current => current.map(existing => {
            if (existing.id !== item.id || existing.source_url.trim() !== url) return existing
            return { ...existing,
              name: existing.name === before.name ? (info.name || existing.name) : existing.name,
              description: existing.description === before.description ? (info.description || existing.description) : existing.description,
              unit_price: cadPrice && info.price != null && existing.unit_price === before.unit_price ? String(info.price) : existing.unit_price,
            }
          }))
          if (info.warning) setError(info.warning)
          else if (!cadPrice && info.price != null) setError(`Found a ${info.currency || 'currency unknown'} price of ${info.price}. Enter the CAD unit price manually.`)
        } catch (err) { setError(err.message) }
        finally { setLookupIds(current => current.filter(id => id !== item.id)) }
      }, 650)
    })
    return () => timers.forEach(timer => timer && clearTimeout(timer))
  }, [urls, job.id])

  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0)
  const hst = Math.round(subtotal * 0.13 * 100) / 100
  const totalDue = subtotal + hst

  const quoteRef = quote?.id ? `QTE-${quote.id.slice(0, 8).toUpperCase()}` : `QTE-DRAFT`
  const todayStr = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())

  const submit = async event => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSave({
        title: title.trim() || 'Electrical Quote',
        notes: notes.trim(),
        items: items.map(item => ({
          name: item.name.trim(),
          description: item.description.trim(),
          source_url: item.source_url.trim(),
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
        }))
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="modal wide quote-preview-modal" role="dialog" aria-modal="true" aria-label={`${quote ? 'Edit' : 'New'} quote`}>
        <header className="quote-modal-header">
          <div>
            <h2>{quote ? 'Edit quote' : 'New quote'} · {job.code}</h2>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
              Live document preview & editor. What you see is formatted directly into the PDF.
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">×</button>
        </header>

        {error && <div className="rfi-error" style={{ margin: '12px 24px 0' }} role="alert">{error}</div>}

        <form className="quote-sheet-form" onSubmit={submit}>
          {/* Main White PDF Preview Sheet */}
          <div className="quote-pdf-sheet">
            
            {/* Top Header: Company on Left, Document Metadata on Right */}
            <div className="quote-sheet-top">
              <div className="quote-sheet-company">
                <h3>Direct Connections</h3>
                <p className="company-sub">Devante Williams-Morris</p>
                <p>GST/HST #: 707729422RT0001</p>
                <p>906-2301 Derry Road West</p>
                <p>Mississauga, ON, Canada L5N 2R4</p>
                <p>647-836-9906 · Devantetheelectrician@gmail.com</p>
              </div>

              <div className="quote-sheet-meta">
                <div className="quote-sheet-badge">QUOTE</div>
                <div className="meta-row"><strong>Quote #:</strong> <span>{quoteRef}</span></div>
                <div className="meta-row"><strong>Ref Job:</strong> <span>{job.code}</span></div>
                <div className="meta-row"><strong>Date:</strong> <span>{todayStr}</span></div>
                <div className="meta-row"><strong>PO #:</strong> <span>{job.code}</span></div>
                <div className="meta-row"><strong>Currency:</strong> <span>CAD</span></div>
              </div>
            </div>

            {/* Blue Divider Line */}
            <div className="quote-sheet-divider" />

            {/* Bill To & Payment Info */}
            <div className="quote-sheet-parties">
              <div className="party-block">
                <span className="party-label">BILL TO</span>
                <strong className="party-name">{job.name}</strong>
                {job.company && <p className="party-sub">{job.company}</p>}
                {job.description && <p className="party-desc">{job.description}</p>}
              </div>

              <div className="party-block payment-block">
                <span className="party-label">PAYMENT</span>
                <strong className="party-name">Due on receipt</strong>
                <p className="party-sub">Please reference {quoteRef} / PO {job.code}</p>
              </div>
            </div>

            {/* Quote Title Field (Editable) */}
            <div className="quote-sheet-title-box">
              <label>
                Quote Title / Scope of Work
                <input
                  name="quote_title"
                  required
                  maxLength="200"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Potlights & Electrical Circuitry Upgrade"
                />
              </label>
            </div>

            {/* Line Items Table styled like the PDF */}
            <div className="quote-table-wrap">
              <table className="quote-sheet-table">
                <thead>
                  <tr>
                    <th className="col-desc">DESCRIPTION</th>
                    <th className="col-rate">RATE (CAD)</th>
                    <th className="col-qty">QTY</th>
                    <th className="col-discount">DISCOUNT</th>
                    <th className="col-amount">AMOUNT</th>
                    <th className="col-action" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className="quote-item-row-edit">
                      <td className="col-desc">
                        <input
                          className="item-name-input"
                          name={`items[${item.id}][name]`}
                          required
                          maxLength="200"
                          value={item.name}
                          onChange={e => change(index, 'name', e.target.value)}
                          placeholder="Item name (e.g. Potlights, 20A breakers)"
                        />
                        <textarea
                          className="item-desc-input"
                          name={`items[${item.id}][description]`}
                          rows="2"
                          maxLength="2000"
                          value={item.description}
                          onChange={e => change(index, 'description', e.target.value)}
                          placeholder="Details / specifications / labour included..."
                        />
                        <div className="item-url-row">
                          <input
                            className="item-url-input"
                            name={`items[${item.id}][source_url]`}
                            type="url"
                            maxLength="2000"
                            value={item.source_url}
                            onChange={e => change(index, 'source_url', e.target.value)}
                            placeholder="Supplier / Product link (optional, auto-fills price & details)"
                          />
                          {lookupIds.includes(item.id) && (
                            <span className="item-lookup-tag">✨ Extracting product info...</span>
                          )}
                        </div>
                      </td>
                      <td className="col-rate">
                        <div className="input-with-currency">
                          <span>$</span>
                          <input
                            name={`items[${item.id}][unit_price]`}
                            required
                            type="number"
                            min="0"
                            max="100000000"
                            step="0.01"
                            value={item.unit_price}
                            onChange={e => change(index, 'unit_price', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </td>
                      <td className="col-qty">
                        <input
                          className="qty-input"
                          name={`items[${item.id}][quantity]`}
                          required
                          type="number"
                          min="0.001"
                          max="1000000"
                          step="any"
                          value={item.quantity}
                          onChange={e => change(index, 'quantity', e.target.value)}
                          placeholder="1"
                        />
                      </td>
                      <td className="col-discount">
                        <span className="dim-dash">—</span>
                      </td>
                      <td className="col-amount">
                        <strong>
                          {money((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
                        </strong>
                      </td>
                      <td className="col-action">
                        {items.length > 1 && (
                          <button
                            type="button"
                            className="remove-row-btn"
                            title="Remove line item"
                            onClick={() => setItems(current => current.filter((_, i) => i !== index))}
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                type="button"
                className="add-line-item-btn"
                onClick={() => setItems(current => [...current, blank()])}
              >
                + Add line item
              </button>
            </div>

            {/* Summary & Totals Block (Subtotal, HST 13%, Total Due) */}
            <div className="quote-sheet-summary-section">
              <div className="quote-sheet-summary-table">
                <div className="summary-line">
                  <span>Subtotal</span>
                  <strong>{money(subtotal)} CAD</strong>
                </div>
                <div className="summary-line">
                  <span>HST (13%)</span>
                  <strong>{money(hst)} CAD</strong>
                </div>
                <div className="summary-total-bar">
                  <span className="total-label">TOTAL DUE (incl. tax)</span>
                  <strong className="total-amount">{money(totalDue)} CAD</strong>
                </div>
              </div>
            </div>

            {/* Footer Text & Notes */}
            <div className="quote-sheet-footer">
              <p className="footer-conversion-note">
                Converted from Quote {quoteRef} for Job {job.code}. Subtotal {money(subtotal)} + HST 13% {money(hst)} = CAD {money(totalDue)} total due. Thank you for your business.
              </p>

              <div className="quote-sheet-notes-field">
                <label>
                  Notes & Terms (Optional)
                  <textarea
                    name="quote_notes"
                    rows="2"
                    maxLength="5000"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. All work complies with Ontario Electrical Safety Code (OESC). ESA certificate provided upon completion."
                  />
                </label>
              </div>
            </div>

          </div>

          {/* Bottom Action Bar */}
          <div className="quote-modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="button" disabled={busy}>
              {busy ? 'Saving quote...' : quote ? 'Save changes' : 'Create quote'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
