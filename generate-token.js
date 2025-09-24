import { createSignedToken } from './lib/signedAuth.ts';

// Generate a one-time token for testing
const userId = 'test-user-id-123';
const ttlSeconds = 300; // Token valid for 5 minutes

const token = createSignedToken(userId, ttlSeconds);
console.log('Generated one-time token:', token);