'use client'

import { useEffect, useState } from 'react'

interface AdminProfile {
  id: string
  email: string
  full_name: string
  role: string
  created_at: string
  updated_at: string
  is_super_admin: boolean
}

interface AdminManagementData {
  success?: boolean
  // server may return a single `super_admin` or a list; normalize to array
  super_admins?: AdminProfile[]
  super_admin?: AdminProfile | null
  admins?: AdminProfile[]
  total_count?: number
  super_admin_count?: number
  admin_count?: number
}

interface AdminManagementProps {
  currentUserEmail?: string
  onAdminUpdate?: () => void
}

export default function AdminManagement({ currentUserEmail, onAdminUpdate }: AdminManagementProps) {
  const [adminData, setAdminData] = useState<AdminManagementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  // Only show Add Admin for the canonical super admin (by email) or
  // when the current user appears in the returned `super_admins` list.
  const [isMainAdmin, setIsMainAdmin] = useState(false)
  const [detectedEmail, setDetectedEmail] = useState<string | null>(null)
  const [detectedRole, setDetectedRole] = useState<string | null>(null)

  useEffect(() => {
    fetchAdminData()
  }, [])

  // Fetch current user from server-side endpoint to ensure we detect
  // the signed-in user even if client-side supabase session isn't ready.
  useEffect(() => {
    let mounted = true
    async function detectMe() {
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) return
        const json = await res.json()
        const email = json?.user?.email ?? null
        const role = json?.user?.role ?? null
        if (!mounted) return
        setDetectedEmail(email)
        setDetectedRole(role)
      } catch (e) {
        // ignore
      }
    }
    detectMe()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    // Priority: detected server-side user, then parent prop, then fetched adminData
    const emailToCheck = detectedEmail || currentUserEmail

    if (emailToCheck === 'ceo@kratos.ng' || detectedRole === 'super_admin') {
      setIsMainAdmin(true)
      return
    }

    if (emailToCheck && adminData?.super_admins?.length) {
      const match = adminData.super_admins.find((s) => s.email === emailToCheck)
      setIsMainAdmin(!!match)
    }
  }, [detectedEmail, detectedRole, currentUserEmail, adminData])

  function formatDate(dateString: string) {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }
    return new Date(dateString).toLocaleString('en-US', options)
  }

  async function fetchAdminData() {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
  const response = await fetch('/api/admin/super-admin-manage', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch admin data')
      }

      const data: AdminManagementData = await response.json()
      // Normalize server response: if server returned single `super_admin`, convert to array
      const normalized: AdminManagementData = {
        success: data.success,
        admins: data.admins || [],
        total_count: data.total_count ?? (data.admins ? data.admins.length : 0),
        super_admins: data.super_admins ?? (data.super_admin ? [data.super_admin] : []),
        super_admin: data.super_admin ?? null,
      }

      setAdminData(normalized)

      // Compute isMainAdmin: canonical email OR presence in returned super_admins
      if (currentUserEmail === 'ceo@kratos.ng') {
        setIsMainAdmin(true)
      } else if (currentUserEmail && normalized.super_admins?.length) {
        const match = normalized.super_admins.find((s) => s.email === currentUserEmail)
        setIsMainAdmin(!!match)
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddAdmin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setActionLoading('add')
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/admin/assign-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: newAdminEmail, action: 'add' }),
      })

      if (!response.ok) {
        throw new Error('Failed to grant admin privileges')
      }

      setSuccess(`Admin privileges granted to ${newAdminEmail}`)
      setNewAdminEmail('')
      fetchAdminData()
      onAdminUpdate?.()
    } catch (error: any) {
      setError(error.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRemoveAdmin(email: string) {
    if (!confirm(`Are you sure you want to remove admin privileges from ${email}?`)) {
      return
    }

    setActionLoading(email)
    setError('')
    setSuccess('')

    try {
      // The assign-role endpoint handles add/remove via POST with an action
      const response = await fetch('/api/admin/assign-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, action: 'remove' }),
      })

      if (!response.ok) {
        throw new Error('Failed to remove admin')
      }

      setSuccess(`Admin privileges removed from ${email}`)
      fetchAdminData()
      onAdminUpdate?.()
    } catch (error: any) {
      setError(error.message)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">👑 Administrator Management</h2>
            <p className="text-gray-600">Manage admin privileges for platform users</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Total Admins</div>
            <div className="text-2xl font-bold text-blue-600">{adminData?.total_count || 0}</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-400 mr-3">❌</div>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-green-400 mr-3">✅</div>
            <p className="text-green-800">{success}</p>
          </div>
        </div>
      )}

      {/* Add Admin Section (only for main admin) */}
      {isMainAdmin && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Add New Administrator</h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn-primary"
              disabled={!!actionLoading}
            >
              {showAddForm ? '❌ Cancel' : '➕ Add Admin'}
            </button>
          </div>
          {showAddForm && (
            <form onSubmit={handleAddAdmin} className="border-t pt-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="email"
                    placeholder="Enter email address of existing user..."
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="input"
                    required
                    disabled={!!actionLoading}
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary px-6"
                  disabled={!newAdminEmail.trim() || actionLoading === 'add'}
                >
                  {actionLoading === 'add' ? 'Adding...' : 'Grant Admin'}
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                ⚠️ User must already have an account on the platform to be granted admin privileges.
              </p>
            </form>
          )}
        </div>
      )}

      {/* Current Admins */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Administrators</h3>
        {adminData && (
          <div className="space-y-4">
            {/* Super Admin */}
            {adminData?.super_admins?.map((s) => (
              <div key={s.id} className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">👑</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{s?.email ?? ''}</h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        {(s?.full_name ?? 'No name set') + ' • '} 
                        Added: {s?.created_at ? formatDate(s.created_at) : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right"></div>
                </div>
              </div>
            ))}
            {/* Regular Admins */}
            {adminData?.admins?.map((admin) => (
              <div key={admin.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">👨‍💼</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{admin.email}</h4>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          ADMIN
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {admin.full_name || 'No name set'} • 
                        Added: {formatDate(admin.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleRemoveAdmin(admin.email)}
                      className="btn-secondary text-red-600 hover:text-red-800 hover:bg-red-50"
                      disabled={actionLoading === admin.email}
                    >
                      {actionLoading === admin.email ? 'Removing...' : '🗑️ Remove'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {adminData?.admins?.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">👨‍💼</div>
                <p>No regular administrators found</p>
                <p className="text-sm">Add administrators to help manage the platform</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
