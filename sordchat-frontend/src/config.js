export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8001';
export const WS_BASE_URL =
  process.env.REACT_APP_WS_URL || API_BASE_URL.replace(/^http/, 'ws');
