'use client'

import React from 'react'
import { X, RefreshCw, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { useNotifications } from './NotificationContext'

export default function NotificationPopup() {
  const { notifications, hideNotification } = useNotifications()

  if (notifications.length === 0) return null

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getBgColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`p-4 rounded-lg border shadow-lg animate-in slide-in-from-right-2 ${getBgColor(notification.type)}`}
        >
          <div className="flex items-start space-x-3">
            {getIcon(notification.type)}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                {notification.title}
              </h4>
              <p className="text-sm text-gray-700 mb-2">
                {notification.message}
              </p>
              {notification.escrowCode && (
                <p className="text-xs text-gray-500 mb-2">
                  Escrow: {notification.escrowCode}
                </p>
              )}
              {notification.actionText && notification.onAction && (
                <button
                  onClick={async () => {
                    console.log('Notification action clicked:', notification.title)
                    try {
                      await notification.onAction?.()
                      console.log('Notification action completed')
                    } catch (error) {
                      console.error('Notification action failed:', error)
                    }
                    hideNotification(notification.id)
                  }}
                  className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  {notification.actionText}
                </button>
              )}
            </div>
            <button
              onClick={() => hideNotification(notification.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}