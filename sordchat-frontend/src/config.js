export const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://sordchat-api.onrender.com';
export const WS_BASE_URL =
  process.env.REACT_APP_WS_URL || API_BASE_URL.replace(/^http/, 'ws');
