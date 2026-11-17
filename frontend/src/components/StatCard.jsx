import { TrendingUp } from 'lucide-react'

export default function StatCard({ icon: Icon, label, value, change, tone = 'teal' }) {
  return <article className={`stat-card tone-${tone}`}><div className="stat-icon"><Icon size={20} /></div><div><p>{label}</p><h3>{value}</h3>{change && <small><TrendingUp size={13} /> {change}</small>}</div></article>
}
