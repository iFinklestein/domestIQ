import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "68ba1f3988941c73f716a804", 
  requiresAuth: true // Ensure authentication is required for all operations
});
