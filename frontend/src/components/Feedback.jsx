import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'

export function ErrorMessage({ children }) {
  if (!children) return null
  return <p className="error-message" role="alert"><AlertCircle size={16} /> {children}</p>
}

export function EmptyState({ loading, children }) {
  return <p className="empty-state">{loading ? 'Loading…' : children}</p>
}

export function Pager({ pagination, onChange }) {
  if (!pagination || pagination.totalPages <= 1) return null
  const { page, totalPages, total } = pagination
  return <div className="pager"><button className="outline-button" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /> Previous</button><span>Page {page} of {totalPages} · {total} total</span><button className="outline-button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next <ChevronRight size={16} /></button></div>
}
