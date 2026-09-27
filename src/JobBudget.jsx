import { useEffect, useState } from 'react'

const money = (value, currency) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value || 0))

export default function JobBudget({ job, summary, canEdit, onSave }) {
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(job.budget_amount == null ? '' : String(job.budget_amount))
  const [currency, setCurrency] = useState(job.budget_currency || summary?.currency || 'CAD')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setAmount(job.budget_amount == null ? '' : String(job.budget_amount))
    setCurrency(job.budget_currency || summary?.currency || 'CAD')
  }, [job.id, job.budget_amount, job.budget_currency, summary?.currency])
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try { await onSave({ budget_amount: Number(amount), budget_currency: currency.toUpperCase() }); setEditing(false) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const clear = async () => {
    setBusy(true); setError('')
    try { await onSave({ budget_amount: null, budget_currency: currency.toUpperCase() }); setEditing(false) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const hasBudget = summary?.amount != null
  const percentage = hasBudget && summary?.spent != null ? summary.amount > 0 ? Math.min(100, summary.spent / summary.amount * 100) : summary.spent > 0 ? 100 : 0 : 0
  return <section className={`panel job-budget ${summary?.over_budget ? 'over' : ''}`}><header><div><h3>Job budget</h3><p><strong>{job.company || 'Company not set'}</strong> · {job.code} · Only receipts attached to this job are applied.</p></div>{canEdit && !editing && <button type="button" className="button secondary" onClick={() => setEditing(true)}>{hasBudget ? 'Edit budget' : '+ Set budget'}</button>}</header>{editing ? <form className="job-budget-form" onSubmit={save}><label>Budget amount<input required type="number" min="0" max="1000000000" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00"/></label><label>Currency<input required maxLength="3" pattern="[A-Za-z]{3}" value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} placeholder="CAD"/></label><div className="job-budget-actions"><button className="button" disabled={busy}>{busy ? 'Saving...' : 'Save budget'}</button><button type="button" className="button secondary" onClick={() => setEditing(false)}>Cancel</button>{hasBudget && <button type="button" className="button secondary" disabled={busy} onClick={clear}>Remove budget</button>}</div>{error && <p className="rfi-error" role="alert">{error}</p>}</form> : <>{hasBudget ? <><div className="job-budget-stats"><div><span>Budget</span><strong>{money(summary.amount, summary.currency)}</strong></div><div><span>Spent</span><strong>{summary.spent == null ? 'Unavailable' : money(summary.spent, summary.currency)}</strong>{summary.receipt_count != null && <small>{summary.receipt_count} receipt{summary.receipt_count === 1 ? '' : 's'} applied</small>}</div><div><span>{summary.over_budget ? 'Over budget' : 'Remaining'}</span><strong className={summary.over_budget ? 'budget-warning' : ''}>{summary.remaining == null ? 'Unavailable' : money(Math.abs(summary.remaining), summary.currency)}</strong></div></div>{summary.spent != null && <div className="job-budget-track" role="progressbar" aria-label="Budget used" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(percentage)}><span style={{ width: `${percentage}%` }}/></div>}{summary.over_budget && <p className="job-budget-alert" role="alert">Warning: this job is over budget by {money(Math.abs(summary.remaining), summary.currency)}.</p>}</> : <p className="job-budget-empty">No budget is set for this job.</p>}{summary?.requires_receipt_access && <p className="job-budget-note">Receipt read access is needed to calculate spending.</p>}{summary?.converted_currencies?.length > 0 && <p className="job-budget-note">Converted {summary.converted_currencies.join(', ')} receipts to {summary.currency} using the latest reference exchange rate.</p>}{summary?.other_currencies?.length > 0 && <p className="job-budget-note">Expenses in {summary.other_currencies.join(', ')} could not be converted and are temporarily excluded.</p>}</>}</section>
}

