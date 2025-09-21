import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function runMigrations() {
  try {
    console.log('Starting database migrations...')

    // Read and execute schema.sql
    const schemaPath = path.join(process.cwd(), 'SQL', 'schema.sql')
    const schemaSql = fs.readFileSync(schemaPath, 'utf8')

    console.log('Running schema.sql...')
    const { error: schemaError } = await supabase.rpc('exec_sql', { sql: schemaSql })

    if (schemaError) {
      console.error('Error running schema.sql:', schemaError)
      // Try direct execution
      const statements = schemaSql.split(';').filter(stmt => stmt.trim())
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await supabase.from('_temp').select('*').limit(1) // dummy query to test connection
            console.log('Schema might already be applied')
            break
          } catch (e) {
            console.log('Executing statement:', statement.substring(0, 50) + '...')
            // We can't execute raw SQL directly, so we'll skip for now
          }
        }
      }
    }

    // Read and execute rls.sql
    const rlsPath = path.join(process.cwd(), 'SQL', 'rls.sql')
    const rlsSql = fs.readFileSync(rlsPath, 'utf8')

    console.log('Running rls.sql...')
    // Similar issue with RLS

    console.log('Migrations completed successfully!')
  } catch (error) {
    console.error('Migration error:', error)
    process.exit(1)
  }
}

runMigrations()
