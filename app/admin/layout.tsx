import React from 'react'
import { ReactNode } from 'react'

// Keep admin routes server-rendered so middleware runs before HTML is produced
export const dynamic = 'force-dynamic'

type Props = { children: ReactNode }

export default function AdminLayout({ children }: Props) {
  return <>{children}</>
}
