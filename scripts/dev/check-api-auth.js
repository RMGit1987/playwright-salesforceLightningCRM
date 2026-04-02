'use strict';

require('dotenv').config();

const hasAccessToken = !!process.env.SALESFORCE_ACCESS_TOKEN;
const hasOAuthClient = !!(process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET);

if (hasAccessToken || hasOAuthClient) {
  const mode = hasAccessToken ? 'access-token' : 'client-credentials';
  console.log(`Salesforce API auth is configured (${mode}).`);
  process.exit(0);
}

console.error(
  'Salesforce API auth is not configured. Set SALESFORCE_ACCESS_TOKEN, or set both SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET in .env for client credentials flow.',
);
process.exit(1);
