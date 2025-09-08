import { getStatusLabel, getStatusColor } from '@/lib/status'
import type { EscrowStatus } from '@/lib/status'

interface StatusBadgeProps {
  status: EscrowStatus
  size?: 'sm' | 'md' | 'lg'
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  }

  return (
    <span 
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]} ${getStatusColor(status)}`}
    >
      {getStatusLabel(status)}
    </span>
  )
}
