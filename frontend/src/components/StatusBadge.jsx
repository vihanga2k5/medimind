import { statusLabel } from '../utils/format'

export default function StatusBadge({ children }) {
  const label = statusLabel(children)
  const tone = label.toLowerCase().replaceAll(' ', '-')
  return <span className={`status status-${tone}`}>{label}</span>
}
