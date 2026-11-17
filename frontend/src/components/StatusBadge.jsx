export default function StatusBadge({ children }) {
  const tone = String(children).toLowerCase().replaceAll(' ', '-')
  return <span className={`status status-${tone}`}>{children}</span>
}
