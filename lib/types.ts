// Database types for the escrow application

export interface Profile {
  id: string
  telegram_id?: string
  role: 'buyer' | 'seller' | 'admin'
  created_at: string
}

export interface Escrow {
  id: string
  code: string
  seller_id: string
  buyer_id?: string
  description: string
  price: number
  admin_fee: number
  product_image_url?: string
  status: 'created' | 'waiting_payment' | 'waiting_admin' | 'payment_confirmed' | 'in_progress' | 'completed' | 'on_hold' | 'refunded' | 'closed'
  created_at: string
  updated_at: string
}

export interface Receipt {
  id: string
  escrow_id: string
  uploaded_by: string
  file_path: string
  created_at: string
}

export interface AdminSettings {
  id: number
  bank_name: string
  account_number: string
  account_holder: string
  updated_at: string
}

export interface StatusLog {
  id: string
  escrow_id: string
  status: string
  changed_by?: string
  created_at: string
}

export interface Dispute {
  id: string
  escrow_id: string
  raised_by?: string
  reason?: string
  status: 'open' | 'resolved' | 'rejected'
  created_at: string
  updated_at: string
}
