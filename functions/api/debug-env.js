import { jsonResponse } from '../_lib.js';

// TEMPORARY diagnostic - names only, never values - to confirm the two secrets
// actually reach the Functions runtime on the new Pages project. Remove once the
// migration is verified working.
export async function onRequestGet(context) {
  return jsonResponse({ envKeys: Object.keys(context.env) });
}
