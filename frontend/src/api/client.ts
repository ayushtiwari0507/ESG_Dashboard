import axios from 'axios';

// Date-based API version — must match backend's API_VERSION
const API_VERSION = '2026-02-24';

const api = axios.create({
  baseURL: baseURL: 'https://esg-dashboard-2.onrender.com/api/${API_VERSION}',
  headers: { 'Content-Type': 'application/json' },
});

// Add JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
