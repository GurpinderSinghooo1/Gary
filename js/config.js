export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxjC5rcbSwKzeXgFG2LU4hgkrVYGcufvyP301v7wat6t_55y2wxyudn6qmiT3j1O48/exec';
export const CORS_PROXY      = 'https://corsproxy.io/?';
export const API_FULL_URL    = `${CORS_PROXY}${APPS_SCRIPT_URL}`;

// expose to window/self for non-module scripts
if (typeof window !== 'undefined') {
  window.APPS_SCRIPT_URL = APPS_SCRIPT_URL;
  window.CORS_PROXY = CORS_PROXY;
  window.API_FULL_URL = API_FULL_URL;
}
if (typeof self !== 'undefined') {
  self.APPS_SCRIPT_URL = APPS_SCRIPT_URL;
  self.CORS_PROXY = CORS_PROXY;
  self.API_FULL_URL = API_FULL_URL;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APPS_SCRIPT_URL, CORS_PROXY, API_FULL_URL };
}
