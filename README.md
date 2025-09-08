# Telegram Escrow Service

A secure escrow service built as a Telegram Mini App using Next.js, TypeScript, Supabase, and TailwindCSS.

## Features

- 🔐 Secure escrow transactions between buyers and sellers
- 👨‍💼 Admin oversight and payment verification
- 📱 Telegram WebApp integration
- 💾 PostgreSQL database with Row Level Security (RLS)
- 🗂️ File storage for product images and payment receipts
- 📊 Real-time status tracking and audit logs

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Telegram WebApp Auth → Supabase Auth bridge
- **Storage**: Supabase Storage
- **Deployment**: Vercel + Supabase (free tiers)

## Setup

### 1. Prerequisites

- Node.js 18+
- Supabase account
- Telegram Bot (for WebApp integration)
- Vercel account (for deployment)

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TG_AUTH_SECRET=your_random_long_secret_for_auth

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Setup

Run the SQL files in your Supabase dashboard in this order:

1. `SQL/schema.sql` - Creates tables and functions
2. `SQL/rls.sql` - Sets up Row Level Security policies
3. `SQL/storage.sql` - Creates storage buckets

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Development Server

```bash
npm run dev
```

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── (public)/          # Public landing page
│   ├── buyer/             # Buyer portal
│   ├── seller/            # Seller portal
│   ├── admin/             # Admin dashboard
│   └── api/               # API routes
├── components/            # Reusable components
├── lib/                   # Utility functions and configs
└── SQL/                   # Database schema and policies
```

## How It Works

### 1. Seller Flow
1. Create escrow with product details and price
2. Get unique transaction code
3. Share code with buyer
4. Mark as delivered when ready
5. Funds released after buyer confirmation

### 2. Buyer Flow
1. Enter transaction code from seller
2. Review product details and total (price + ₦300 fee)
3. Make payment to provided bank account
4. Upload payment receipt
5. Confirm receipt when product/service delivered

### 3. Admin Flow
1. Review uploaded payment receipts
2. Confirm legitimate payments
3. Handle disputes and refunds
4. Release funds when transactions complete
5. Manage bank account settings

## Security Features

- Row Level Security (RLS) on all database tables
- Server-side file uploads using Service Role
- Signed URLs for secure file access
- Telegram WebApp data verification
- Deterministic user authentication

## Status Flow

```
Created → Waiting Payment → Waiting Admin → Payment Confirmed → 
In Progress → Completed → Closed
              ↓
            Refunded (Admin action)
```

## API Endpoints

### Authentication
- `POST /api/auth/telegram` - Telegram WebApp auth
- `POST /api/auth/logout` - Logout

### Escrow Management
- `POST /api/escrow/create` - Create new escrow
- `POST /api/escrow/join` - Join escrow as buyer
- `GET /api/escrow/by-code/[code]` - Get escrow by code
- `GET /api/escrow/by-id/[id]` - Get escrow by ID
- `POST /api/escrow/upload-receipt` - Upload payment receipt
- `POST /api/escrow/mark-delivered` - Mark as delivered (seller)
- `POST /api/escrow/confirm-received` - Confirm receipt (buyer)

### Admin
- `GET /api/admin/escrows` - List all escrows
- `POST /api/admin/confirm-payment` - Confirm payment
- `POST /api/admin/release-funds` - Release funds
- `POST /api/admin/refund` - Process refund
- `POST /api/admin/update-bank` - Update bank settings

### Utilities
- `GET /api/settings/bank` - Get bank details
- `POST /api/storage/sign-url` - Get signed URL for files

## Deployment

### Vercel
1. Connect your GitHub repo to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy

### Supabase
1. Run SQL files in Supabase SQL editor
2. Configure storage buckets
3. Set up RLS policies

### Telegram Bot
1. Create bot with @BotFather
2. Set WebApp URL to your Vercel domain
3. Configure bot settings

## Admin Setup

1. Deploy the application
2. Create admin account via `/admin/login` using Supabase Auth
3. Run SQL to promote user to admin:
```sql
UPDATE profiles SET role = 'admin' WHERE id = 'your-user-id';
```
4. Configure bank settings in admin dashboard

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions, please open a GitHub issue.
