# PowerShell script to add environment variables to Vercel

Write-Host "Adding environment variables to Vercel..."

# Add environment variables using echo and pipeline
Write-Host "Adding NEXT_PUBLIC_SUPABASE_URL..."
echo "https://hbphcrwgmxapqrecmunh.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production

Write-Host "Adding NEXT_PUBLIC_SUPABASE_ANON_KEY..." 
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhicGhjcndnbXhhcHFyZWNtdW5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMjk2MTcsImV4cCI6MjA3MjkwNTYxN30.Cy033qSbGGHTqg8q66_523T1q1AmaQdT-7MPooIiCCU" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production

Write-Host "Adding SUPABASE_SERVICE_ROLE_KEY..."
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhicGhjcndnbXhhcHFyZWNtdW5oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzMyOTYxNywiZXhwIjoyMDcyOTA1NjE3fQ.MdmItnBTJ7TkzymtDgY8LM3FFJIg_1AMFng5bI3e6Ao" | vercel env add SUPABASE_SERVICE_ROLE_KEY production

Write-Host "Adding TG_AUTH_SECRET..."
echo "tg_escrow_auth_secret_2025_random_key_abc123xyz789" | vercel env add TG_AUTH_SECRET production

Write-Host "Environment variables added successfully!"
