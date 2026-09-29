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
  const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0)
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await onSave({ title: title.trim(), notes: notes.trim(), items: items.map(item => ({ name: item.name.trim(), description: item.description.trim(), source_url: item.source_url.trim(), quantity: Number(item.quantity), unit_price: Number(item.unit_price) })) })
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="modal wide" role="dialog" aria-modal="true" aria-label={`${quote ? 'Edit' : 'New'} quote`}><header><h2>{quote ? 'Edit' : 'New'} quote for {job.code}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Close">×</button></header><form className="quote-form" onSubmit={submit}><p>{job.name}{job.company ? ` · ${job.company}` : ''}</p>{error && <p className="rfi-error" role="alert">{error}</p>}<label>Quote title<input name="quote_title" required maxLength="200" value={title} onChange={event => setTitle(event.target.value)} placeholder="Electrical installation"/></label><div className="quote-items-head"><h3>Items</h3><button type="button" className="button secondary" onClick={() => setItems(current => [...current, blank()])}>+ Add item</button></div>{items.map((item, index) => <fieldset className="quote-item" key={item.id}><legend>Item {index + 1}</legend><label>Item URL (optional)<input name={`items[${item.id}][source_url]`} type="url" maxLength="2000" value={item.source_url} onChange={event => change(index, 'source_url', event.target.value)} placeholder="https://supplier.example/product"/></label>{lookupIds.includes(item.id) && <small role="status">Extracting item info...</small>}<label>Item name<input name={`items[${item.id}][name]`} required maxLength="200" value={item.name} onChange={event => change(index, 'name', event.target.value)}/></label><label>Description<textarea name={`items[${item.id}][description]`} rows="2" maxLength="2000" value={item.description} onChange={event => change(index, 'description', event.target.value)}/></label><div className="quote-item-row"><label>Quantity<input name={`items[${item.id}][quantity]`} required type="number" min="0.001" max="1000000" step="any" value={item.quantity} onChange={event => change(index, 'quantity', event.target.value)}/></label><label>Unit price (CAD)<input name={`items[${item.id}][unit_price]`} required type="number" min="0" max="100000000" step="0.01" value={item.unit_price} onChange={event => change(index, 'unit_price', event.target.value)}/></label></div><div className="quote-item-foot"><strong>{money((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}</strong>{items.length > 1 && <button type="button" onClick={() => setItems(current => current.filter((_, i) => i !== index))}>Remove item</button>}</div></fieldset>)}<button type="button" className="button secondary quote-add-bottom" onClick={() => setItems(current => [...current, blank()])}>+ Add another item</button><label>Notes<textarea name="quote_notes" rows="3" maxLength="5000" value={notes} onChange={event => setNotes(event.target.value)}/></label><div className="quote-form-total"><span>Quote total</span><strong>{money(total)}</strong></div><div className="rfi-form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button" disabled={busy}>{busy ? 'Saving...' : 'Save quote'}</button></div></form></section></div>
}
