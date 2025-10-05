'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

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
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [shownNotificationIds, setShownNotificationIds] = useState<Set<string>>(new Set())
  const refreshData = React.useRef<(() => Promise<void>) | null>(null)

  // Fetch notifications from API
  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?unread_only=true&limit=10', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        const dbNotifications = data.notifications || []

        // Convert DB notifications to popup format and show them
        dbNotifications.forEach((dbNotif: any) => {
          // Check if we already showed this notification in this session
          const notificationId = `db-${dbNotif.id}`
          if (!shownNotificationIds.has(notificationId)) {
            const notificationData = {
              title: dbNotif.title,
              message: dbNotif.message,
              type: dbNotif.type || 'info',
              escrowCode: dbNotif.escrow_code,
              actionText: dbNotif.action_text || 'Refresh',
              onAction: refreshData.current || (() => {}),
              autoHide: false, // Don't auto-hide DB notifications
            }
            showNotification(notificationData, notificationId)
            setShownNotificationIds(prev => new Set(prev).add(notificationId))
          }
        })
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  // Check authentication and start polling
  useEffect(() => {
    const checkAuthAndStartPolling = async () => {
      try {
        // Check if user is authenticated
        const response = await fetch('/api/auth/me', { credentials: 'include' })
        const isAuth = response.ok
        setIsAuthenticated(isAuth)

        if (isAuth) {
          // Initial fetch
          await fetchNotifications()

          // Poll for new notifications every 10 seconds
          const interval = setInterval(fetchNotifications, 10000)
          return () => clearInterval(interval)
        }
      } catch (error) {
        console.error('Auth check error:', error)
      }
    }

    checkAuthAndStartPolling()
  }, [])

  const showNotification = (notification: Omit<NotificationData, 'id'>, customId?: string) => {
    const id = customId || (Date.now().toString() + Math.random().toString(36).substr(2, 9))
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

  const hideNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))

    // If it's a DB notification, mark it as read
    if (id.startsWith('db-')) {
      try {
        const dbId = id.replace('db-', '')
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ notificationIds: [dbId] })
        })
      } catch (error) {
        console.error('Error marking notification as read:', error)
      }
    }
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