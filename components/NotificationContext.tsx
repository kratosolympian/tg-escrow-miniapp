'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface NotificationData {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  escrowId?: string
  escrowCode?: string
  actionText?: string
  onAction?: () => void
  autoHide?: boolean
  duration?: number
}

interface NotificationContextType {
  notifications: NotificationData[]
  showNotification: (notification: Omit<NotificationData, 'id'>) => void
  hideNotification: (id: string) => void
  clearAll: () => void
  refreshData: React.MutableRefObject<(() => Promise<void>) | null>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: ReactNode
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const refreshData = React.useRef<(() => Promise<void>) | null>(null)

  const showNotification = (notification: Omit<NotificationData, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    const newNotification: NotificationData = {
      id,
      autoHide: true,
      duration: 5000,
      ...notification
    }

    setNotifications(prev => [...prev, newNotification])

    // Auto-hide if enabled
    if (newNotification.autoHide) {
      setTimeout(() => {
        hideNotification(id)
      }, newNotification.duration)
    }
  }

  const hideNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAll = () => {
    setNotifications([])
  }

  return (
    <NotificationContext.Provider value={{
      notifications,
      showNotification,
      hideNotification,
      clearAll,
      refreshData
    }}>
      {children}
    </NotificationContext.Provider>
  )
}