import { useEffect, useRef, useState } from 'react'
import { API_URL, api } from './api.js'

const blank = () => ({ id: crypto.randomUUID(), name: '', description: '', source_url: '', quantity: '1', unit_price: '' })
const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'CAD' }).format(Number(value || 0))

export default function QuoteForm({ job, quote, receipts = [], onSave, onClose }) {
  // Company / Contractor profile state
  const [companyName, setCompanyName] = useState(quote?.company_name ?? 'Direct Connections')
  const [contactName, setContactName] = useState(quote?.contact_name ?? 'Devante Williams-Morris')
  const [taxNumber, setTaxNumber] = useState(quote?.tax_number ?? 'GST/HST #: 707729422RT0001')
  const [addressLine1, setAddressLine1] = useState(quote?.address_line1 ?? '906-2301 Derry Road West')
  const [addressLine2, setAddressLine2] = useState(quote?.address_line2 ?? 'Mississauga, ON, Canada L5N 2R4')
  const [contactPhoneEmail, setContactPhoneEmail] = useState(quote?.contact_phone_email ?? '647-836-9906 · Devantetheelectrician@gmail.com')

  // Document metadata state
  const defaultQuoteNum = quote?.quote_number || (quote?.id ? `QTE-${quote.id.slice(0, 8).toUpperCase()}` : 'QTE-DRAFT')
  const defaultDateStr = quote?.quote_date || new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())

  const defaultPaymentRef = quote?.payment_reference || `Please reference ${defaultQuoteNum} / PO ${quote?.po_number || job?.code || ''}`

  const [docType, setDocType] = useState(quote?.doc_type || 'QUOTE')
  const [quoteNumber, setQuoteNumber] = useState(defaultQuoteNum)
  const [quoteDate, setQuoteDate] = useState(defaultDateStr)
  const [poNumber, setPoNumber] = useState(quote?.po_number || job?.code || '')
  const [clientName, setClientName] = useState(quote?.client_name || job?.name || '')
  const [clientEmail, setClientEmail] = useState(quote?.client_email || '')
  const [clientCompany, setClientCompany] = useState(quote?.client_company || job?.company || '')
  const [paymentTerms, setPaymentTerms] = useState(quote?.payment_terms || 'Due on receipt')
  const [paymentReference, setPaymentReference] = useState(defaultPaymentRef)

  // Tax & Currency state (editable for different countries/regions)
  const [taxLabel, setTaxLabel] = useState(quote?.tax_label || 'HST')
  const [taxRate, setTaxRate] = useState(quote?.tax_rate != null ? String(quote.tax_rate) : '13')
  const [currency, setCurrency] = useState(quote?.currency || 'CAD')

  // Quote contents state
  const [title, setTitle] = useState(quote?.title || '')
  const [notes, setNotes] = useState(quote?.notes || '')
  const [items, setItems] = useState(quote?.items?.map(item => ({ id: crypto.randomUUID(), name: item.name, description: item.description || '', source_url: item.source_url || '', quantity: String(item.quantity), unit_price: String(item.unit_price) })) || [blank()])
  const [busy, setBusy] = useState(false)
  const [lookupIds, setLookupIds] = useState([])
  const [showReceiptPicker, setShowReceiptPicker] = useState(false)
  const [scanningReceipt, setScanningReceipt] = useState(false)
  const attempted = useRef(new Set())
  const latestItems = useRef(items)
  latestItems.current = items
  const [error, setError] = useState('')
  const receiptFileInputRef = useRef(null)
  
  const change = (index, field, value) => setItems(current => current.map((item, i) => i === index ? { ...item, [field]: value } : item))
  const urls = items.map(item => `${item.id}:${item.source_url.trim()}`).join('\n')

  // Explicit URL extraction function
  const extractUrl = async (itemId, inputUrl) => {
    const targetUrl = (inputUrl || latestItems.current.find(it => it.id === itemId)?.source_url || '').trim()
    if (!/^https?:\/\/[^\s.]+\.[^\s]+/i.test(targetUrl)) {
      setError('Please enter a valid HTTP or HTTPS product URL')
      return
    }
    setLookupIds(cur => [...new Set([...cur, itemId])])
    setError('')
    try {
      const before = latestItems.current.find(current => current.id === itemId)
      const info = await api(`/jobs/${job.id}/quotes/extract-item`, { method: 'POST', body: JSON.stringify({ url: targetUrl }) })
      const cadPrice = info.currency === 'CAD'
      setItems(current => current.map(existing => {
        if (existing.id !== itemId) return existing
        return {
          ...existing,
          name: existing.name === (before?.name || '') ? (info.name || existing.name) : (info.name || existing.name),
          description: existing.description === (before?.description || '') ? (info.description || existing.description) : (info.description || existing.description),
          unit_price: cadPrice && info.price != null ? String(info.price) : existing.unit_price,
        }
      }))
      if (info.warning) setError(info.warning)
      else if (!cadPrice && info.price != null) setError(`Found a ${info.currency || 'currency unknown'} price of ${info.price}. Enter the CAD unit price manually.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLookupIds(cur => cur.filter(id => id !== itemId))
    }
  }

  // Import existing job receipt into a quote line item
  const addFromReceipt = (rcpt) => {
    const rawVendor = (rcpt.vendor || rcpt.filename || 'Receipt Expense').replace(/\.[^/.]+$/, "")
    const dateStr = rcpt.incurred_at ? new Date(rcpt.incurred_at).toLocaleDateString() : ''
    const ocrSnippet = rcpt.ocr_text ? rcpt.ocr_text.split('\n').filter(Boolean).slice(0, 2).join(' · ') : ''
    const desc = ocrSnippet || `Receipt (${rcpt.category || 'expense'}) ${dateStr ? `on ${dateStr}` : ''}`
    
    setItems(current => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: rawVendor,
        description: desc,
        source_url: rcpt.web_url || '',
        quantity: '1',
        unit_price: rcpt.amount != null ? String(rcpt.amount) : '',
      }
    ])
    setShowReceiptPicker(false)
  }

  // Upload and OCR scan a receipt file directly into a quote line item
  const handleReceiptFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''
    setScanningReceipt(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_URL}/jobs/${job.id}/quotes/extract-receipt`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Receipt scan failed')
      }
      const data = await res.json()
      setItems(current => [
        ...current,
        {
          id: crypto.randomUUID(),
          name: data.name || file.name.replace(/\.[^/.]+$/, ""),
          description: data.description || 'Receipt scanned item',
          source_url: '',
          quantity: String(data.quantity || 1),
          unit_price: data.unit_price != null && data.unit_price > 0 ? String(data.unit_price) : '',
        }
      ])
    } catch (err) {
      setError(err.message)
    } finally {
      setScanningReceipt(false)
    }
  }

  // Auto-extraction debounce when typing / pasting URL
  useEffect(() => {
    const timers = latestItems.current.map(item => {
      const url = item.source_url.trim()
      if (!/^https?:\/\/[^\s.]+\.[^\s]+/i.test(url)) return null
      const key = `${item.id}:${url}`
      if (attempted.current.has(key)) return null
      return setTimeout(async () => {
        if (latestItems.current.find(current => current.id === item.id)?.source_url.trim() !== url) return
        attempted.current.add(key)
        extractUrl(item.id, url)
      }, 650)
    })
    return () => timers.forEach(timer => timer && clearTimeout(timer))
  }, [urls, job.id])

  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0)
  const taxPercent = Number(taxRate) >= 0 ? Number(taxRate) : 0
  const taxAmount = Math.round(subtotal * (taxPercent / 100) * 100) / 100
  const totalDue = subtotal + taxAmount

  const submit = async event => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSave({
        title: title.trim() || 'Electrical Quote',
        notes: notes.trim(),
        company_name: companyName.trim(),
        contact_name: contactName.trim(),
        tax_number: taxNumber.trim(),
        address_line1: addressLine1.trim(),
        address_line2: addressLine2.trim(),
        contact_phone_email: contactPhoneEmail.trim(),
        doc_type: docType.trim(),
        quote_number: quoteNumber.trim(),
        po_number: poNumber.trim(),
        quote_date: quoteDate.trim(),
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        client_company: clientCompany.trim(),
        payment_terms: paymentTerms.trim(),
        payment_reference: paymentReference.trim(),
        tax_label: taxLabel.trim() || 'Tax',
        tax_rate: Number(taxRate) >= 0 ? Number(taxRate) : 13,
        currency: currency.trim() || 'CAD',
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
            
            {/* Top Header: Company on Left, Document Metadata on Right (All Editable) */}
            <div className="quote-sheet-top">
              <div className="quote-sheet-company quote-sheet-editable-block">
                <input
                  className="sheet-inline-input sheet-company-title-input"
                  name="company_name"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Company Name"
                  title="Edit company name"
                />
                <input
                  className="sheet-inline-input sheet-contact-name-input"
                  name="contact_name"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="Contact Name"
                  title="Edit contact person"
                />
                <input
                  className="sheet-inline-input"
                  name="tax_number"
                  value={taxNumber}
                  onChange={e => setTaxNumber(e.target.value)}
                  placeholder="GST/HST # / Tax ID"
                  title="Edit tax registration number"
                />
                <input
                  className="sheet-inline-input"
                  name="address_line1"
                  value={addressLine1}
                  onChange={e => setAddressLine1(e.target.value)}
                  placeholder="Address line 1"
                  title="Edit street address"
                />
                <input
                  className="sheet-inline-input"
                  name="address_line2"
                  value={addressLine2}
                  onChange={e => setAddressLine2(e.target.value)}
                  placeholder="City, Province, Postal Code"
                  title="Edit city, province, postal code"
                />
                <input
                  className="sheet-inline-input"
                  name="contact_phone_email"
                  value={contactPhoneEmail}
                  onChange={e => setContactPhoneEmail(e.target.value)}
                  placeholder="Phone · Email"
                  title="Edit phone and email"
                />
              </div>

              <div className="quote-sheet-meta quote-sheet-editable-block">
                <input
                  className="sheet-badge-input"
                  name="doc_type"
                  value={docType}
                  onChange={e => setDocType(e.target.value.toUpperCase())}
                  placeholder="QUOTE"
                  title="Document type (e.g. QUOTE, INVOICE, ESTIMATE)"
                />
                <div className="meta-row">
                  <strong>Quote #:</strong>
                  <input
                    className="sheet-meta-input"
                    name="quote_number"
                    value={quoteNumber}
                    onChange={e => setQuoteNumber(e.target.value)}
                    placeholder="QTE-DRAFT"
                    title="Edit quote / invoice number"
                  />
                </div>
                <div className="meta-row">
                  <strong>Ref Job:</strong>
                  <span className="meta-static-val">{job.code}</span>
                </div>
                <div className="meta-row">
                  <strong>Date:</strong>
                  <input
                    className="sheet-meta-input"
                    name="quote_date"
                    value={quoteDate}
                    onChange={e => setQuoteDate(e.target.value)}
                    placeholder="Date"
                    title="Edit date"
                  />
                </div>
                <div className="meta-row">
                  <strong>PO #:</strong>
                  <input
                    className="sheet-meta-input"
                    name="po_number"
                    value={poNumber}
                    onChange={e => setPoNumber(e.target.value)}
                    placeholder={job.code || 'PO #'}
                    title="Edit Purchase Order number"
                  />
                </div>
                <div className="meta-row">
                  <strong>Currency:</strong>
                  <input
                    className="sheet-meta-input sheet-currency-input"
                    name="currency"
                    value={currency}
                    onChange={e => setCurrency(e.target.value.toUpperCase())}
                    placeholder="CAD"
                    title="Edit currency (e.g. CAD, USD, EUR)"
                  />
                </div>
              </div>
            </div>

            {/* Blue Divider Line */}
            <div className="quote-sheet-divider" />

            {/* Bill To & Payment Info (All Editable) */}
            <div className="quote-sheet-parties">
              <div className="party-block quote-sheet-editable-block">
                <span className="party-label">BILL TO</span>
                <input
                  className="sheet-inline-input sheet-client-name-input"
                  name="client_name"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder={job.name || 'Client / Recipient Name'}
                  title="Edit client or recipient name"
                />
                <input
                  className="sheet-inline-input sheet-client-email-input"
                  name="client_email"
                  type="email"
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  placeholder="Billing Email (e.g. client@email.com)"
                  title="Edit client email address"
                />
                <input
                  className="sheet-inline-input sheet-client-sub-input"
                  name="client_company"
                  value={clientCompany}
                  onChange={e => setClientCompany(e.target.value)}
                  placeholder={job.company || 'Company / Address (optional)'}
                  title="Edit client company / address details"
                />
                {job.description && <p className="party-desc">{job.description}</p>}
              </div>

              <div className="party-block payment-block quote-sheet-editable-block">
                <span className="party-label">PAYMENT</span>
                <input
                  className="sheet-inline-input sheet-payment-terms-input"
                  name="payment_terms"
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                  placeholder="Due on receipt"
                  title="Edit payment terms"
                />
                <input
                  className="sheet-inline-input sheet-payment-ref-input"
                  name="payment_reference"
                  value={paymentReference}
                  onChange={e => setPaymentReference(e.target.value)}
                  placeholder={`Please reference ${quoteNumber || 'QTE-DRAFT'} / PO ${poNumber || job.code}`}
                  title="Edit payment reference notice"
                />
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
              {/* Quick Line Item Action Toolbar */}
              <div className="quote-items-toolbar">
                <span className="toolbar-title">Line Items</span>
                <div className="toolbar-actions">
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => setItems(current => [...current, blank()])}
                  >
                    + Add item
                  </button>

                  {receipts.length > 0 && (
                    <button
                      type="button"
                      className={`toolbar-btn ${showReceiptPicker ? 'active' : ''}`}
                      onClick={() => setShowReceiptPicker(v => !v)}
                      title="Import item from existing job receipts"
                    >
                      🧾 Add from receipt ({receipts.length})
                    </button>
                  )}

                  <button
                    type="button"
                    className="toolbar-btn scan-btn"
                    disabled={scanningReceipt}
                    onClick={() => receiptFileInputRef.current?.click()}
                    title="Upload or take photo of a receipt to extract as a quote item"
                  >
                    {scanningReceipt ? '⏳ Scanning receipt...' : '📷 Scan receipt file'}
                  </button>

                  <input
                    type="file"
                    ref={receiptFileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*,application/pdf"
                    onChange={handleReceiptFileUpload}
                  />
                </div>
              </div>

              {/* Scanning status indicator */}
              {scanningReceipt && (
                <div className="quote-scanning-banner">
                  <span className="spinner small" />
                  <span>Scanning receipt OCR and extracting vendor & price into a new line item...</span>
                </div>
              )}

              {/* Job Receipts Picker Drawer */}
              {showReceiptPicker && (
                <div className="quote-receipt-picker">
                  <div className="picker-header">
                    <strong>Select a receipt from Job {job.code} to add:</strong>
                    <button type="button" className="picker-close-btn" onClick={() => setShowReceiptPicker(false)}>×</button>
                  </div>
                  <div className="picker-grid">
                    {receipts.map(rcpt => (
                      <div
                        key={rcpt.id}
                        className="picker-card"
                        onClick={() => addFromReceipt(rcpt)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="picker-card-top">
                          <strong>{rcpt.vendor || rcpt.filename || 'Receipt'}</strong>
                          <span className="picker-card-amount">{money(rcpt.amount, rcpt.currency || 'CAD')}</span>
                        </div>
                        <div className="picker-card-sub">
                          <span>{rcpt.incurred_at ? new Date(rcpt.incurred_at).toLocaleDateString() : 'Date N/A'}</span>
                          <span className="picker-card-cat">{rcpt.category || 'expense'}</span>
                        </div>
                        {rcpt.ocr_text && (
                          <p className="picker-card-ocr">{rcpt.ocr_text.slice(0, 80)}...</p>
                        )}
                        <span className="picker-card-add-hint">+ Add as line item</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                            placeholder="Supplier / Product URL (auto-extracts name & price)"
                          />
                          <button
                            type="button"
                            className="item-extract-btn"
                            disabled={lookupIds.includes(item.id) || !item.source_url.trim()}
                            onClick={() => extractUrl(item.id, item.source_url)}
                            title="Extract product details from URL"
                          >
                            {lookupIds.includes(item.id) ? '⏳ Extracting...' : '⚡ Extract URL'}
                          </button>
                          {lookupIds.includes(item.id) && (
                            <span className="item-lookup-tag">✨ Reading product page...</span>
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

              <div className="table-bottom-actions">
                <button
                  type="button"
                  className="add-line-item-btn"
                  onClick={() => setItems(current => [...current, blank()])}
                >
                  + Add line item
                </button>
                {receipts.length > 0 && (
                  <button
                    type="button"
                    className="add-receipt-item-btn"
                    onClick={() => setShowReceiptPicker(true)}
                  >
                    🧾 Add from receipt ({receipts.length})
                  </button>
                )}
              </div>
            </div>

            {/* Summary & Totals Block (Subtotal, Tax, Total Due - All Editable) */}
            <div className="quote-sheet-summary-section">
              <div className="quote-sheet-summary-table">
                <div className="summary-line">
                  <span>Subtotal</span>
                  <strong>{money(subtotal)} {currency}</strong>
                </div>
                <div className="summary-line summary-tax-line">
                  <div className="summary-tax-label-group">
                    <input
                      className="sheet-inline-input sheet-tax-label-input"
                      name="tax_label"
                      value={taxLabel}
                      onChange={e => setTaxLabel(e.target.value)}
                      placeholder="HST"
                      title="Edit tax name (e.g. HST, GST, VAT, Tax)"
                    />
                    <span className="tax-paren">(</span>
                    <input
                      className="sheet-inline-input sheet-tax-rate-input"
                      name="tax_rate"
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={taxRate}
                      onChange={e => setTaxRate(e.target.value)}
                      placeholder="13"
                      title="Edit tax percentage rate"
                    />
                    <span className="tax-percent-sign">%)</span>
                  </div>
                  <strong>{money(taxAmount)} {currency}</strong>
                </div>
                <div className="summary-total-bar">
                  <span className="total-label">TOTAL DUE (incl. tax)</span>
                  <strong className="total-amount">{money(totalDue)} {currency}</strong>
                </div>
              </div>
            </div>

            {/* Footer Text & Notes */}
            <div className="quote-sheet-footer">
              <p className="footer-conversion-note">
                Converted from Quote {quoteNumber || 'QTE-DRAFT'} for Job {poNumber || job.code}. Subtotal {money(subtotal)} + {taxLabel} {taxRate}% {money(taxAmount)} = {currency} {money(totalDue)} total due. Thank you for your business.
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
