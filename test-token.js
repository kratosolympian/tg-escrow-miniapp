import { createSignedToken } from './lib/signedAuth.js'

// Generate a token for testing
const token = createSignedToken('test-user-id-123')
console.log('Generated token:', token)

// Test the token verification
import { verifyAndConsumeSignedToken } from './lib/signedAuth.js'

verifyAndConsumeSignedToken(token).then(userId => {
  console.log('Verified userId:', userId)
}).catch(err => {
  console.error('Verification failed:', err)
})