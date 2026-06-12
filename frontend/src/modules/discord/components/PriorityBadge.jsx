import { priorityLabel } from '../priority.js'

export function PriorityBadge({ band }) {
  return <span className={`dsc-prio dsc-prio--${band}`}>{priorityLabel(band)}</span>
}
