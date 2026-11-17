import { Sparkles } from 'lucide-react'

export default function Brand({ compact = false }) {
  return <div className="brand"><span className="brand-mark">+</span>{!compact && <span>Medi<span>Mind</span></span>}<Sparkles size={13} className="brand-spark" /></div>
}
