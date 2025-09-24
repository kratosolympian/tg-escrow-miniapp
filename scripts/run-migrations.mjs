import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function runMigrations() {
  try {
    // Read and execute schema.sql
    const schemaPath = path.join(process.cwd(), 'SQL', 'schema.sql')
    const schemaSql = fs.readFileSync(schemaPath, 'utf8')

    const { error: schemaError } = await supabase.rpc('exec_sql', { sql: schemaSql })

    if (schemaError) {
      const statements = schemaSql.split(';').filter(stmt => stmt.trim())
      for (const statement of statements) {
        try {
          await supabase.rpc('exec_sql', { sql: statement })
        } catch {
          // Skip failed statements
        }
      }
    }

    // Read and execute rls.sql
    const rlsPath = path.join(process.cwd(), 'SQL', 'rls.sql')
    const rlsSql = fs.readFileSync(rlsPath, 'utf8')

    const { error: rlsError } = await supabase.rpc('exec_sql', { sql: rlsSql })

    if (rlsError) {
      const rlsStatements = rlsSql.split(';').filter(stmt => stmt.trim())
      for (const statement of rlsStatements) {
        try {
          await supabase.rpc('exec_sql', { sql: statement })
        } catch {
          // Skip failed statements
        }
      }
    }
  } catch (error) {
    throw new Error(`Migration error: ${error.message}`)
  }
}

runMigrations().catch(error => {
  console.error(error.message)
  process.exit(1)
})
