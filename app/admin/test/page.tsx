'use client'

import { useEffect, useState } from 'react'
import AdminManagement from '@/components/AdminManagement'

export default function AdminManagementTestPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">Admin Management (Test Mode)</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-4xl">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="text-blue-400 mr-3">ℹ️</div>
            <p className="text-blue-800">
              <strong>Test Mode:</strong> This page is running in test mode for development purposes. 
              Super admin functionality is simulated with <code>johnayodele01@gmail.com</code>.
            </p>
          </div>
        </div>

        <AdminManagement 
          currentUserEmail="johnayodele01@gmail.com"
          onAdminUpdate={() => {
            console.log('Admin data updated')
          }}
        />
      </div>
    </div>
  )
}
