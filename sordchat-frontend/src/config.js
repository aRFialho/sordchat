export const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://voltcorp-api.onrender.com';
export const WS_BASE_URL =
  process.env.REACT_APP_WS_URL || API_BASE_URL.replace(/^http/, 'ws');
export const DESKTOP_DOWNLOAD_URL =
  process.env.REACT_APP_DESKTOP_DOWNLOAD_URL || `${API_BASE_URL}/downloads/desktop/latest`;
