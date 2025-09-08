import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          telegram_id: string | null
          role: 'buyer' | 'seller' | 'admin'
          created_at: string
        }
        Insert: {
          id: string
          telegram_id?: string | null
          role?: 'buyer' | 'seller' | 'admin'
          created_at?: string
        }
        Update: {
          id?: string
          telegram_id?: string | null
          role?: 'buyer' | 'seller' | 'admin'
          created_at?: string
        }
      }
      escrows: {
        Row: {
          id: string
          code: string
          seller_id: string
          buyer_id: string | null
          description: string
          price: number
          admin_fee: number
          product_image_url: string | null
          status: 'created' | 'waiting_payment' | 'waiting_admin' | 'payment_confirmed' | 'in_progress' | 'completed' | 'on_hold' | 'refunded' | 'closed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          seller_id: string
          buyer_id?: string | null
          description: string
          price: number
          admin_fee?: number
          product_image_url?: string | null
          status?: 'created' | 'waiting_payment' | 'waiting_admin' | 'payment_confirmed' | 'in_progress' | 'completed' | 'on_hold' | 'refunded' | 'closed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          seller_id?: string
          buyer_id?: string | null
          description?: string
          price?: number
          admin_fee?: number
          product_image_url?: string | null
          status?: 'created' | 'waiting_payment' | 'waiting_admin' | 'payment_confirmed' | 'in_progress' | 'completed' | 'on_hold' | 'refunded' | 'closed'
          created_at?: string
          updated_at?: string
        }
      }
      receipts: {
        Row: {
          id: string
          escrow_id: string
          uploaded_by: string
          file_path: string
          created_at: string
        }
        Insert: {
          id?: string
          escrow_id: string
          uploaded_by: string
          file_path: string
          created_at?: string
        }
        Update: {
          id?: string
          escrow_id?: string
          uploaded_by?: string
          file_path?: string
          created_at?: string
        }
      }
      admin_settings: {
        Row: {
          id: number
          bank_name: string
          account_number: string
          account_holder: string
          updated_at: string
        }
        Insert: {
          id?: number
          bank_name: string
          account_number: string
          account_holder: string
          updated_at?: string
        }
        Update: {
          id?: number
          bank_name?: string
          account_number?: string
          account_holder?: string
          updated_at?: string
        }
      }
      status_logs: {
        Row: {
          id: string
          escrow_id: string
          status: string
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          escrow_id: string
          status: string
          changed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          escrow_id?: string
          status?: string
          changed_by?: string | null
          created_at?: string
        }
      }
    }
  }
}
