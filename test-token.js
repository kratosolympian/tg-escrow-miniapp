import { createSignedToken } from "./lib/signedAuth.js";

// Generate a token for testing
const token = createSignedToken("test-user-id-123");

// Test the token verification
import { verifyAndConsumeSignedToken } from "./lib/signedAuth.js";

verifyAndConsumeSignedToken(token)
  .then((userId) => {})
  .catch((err) => {});

// Ensure this file is excluded from production builds
// Added a note to exclude this file in production.
