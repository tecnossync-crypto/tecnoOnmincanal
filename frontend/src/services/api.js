// frontend/src/services/api.js
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Interceptor de request: agrega el token JWT automáticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor de response: maneja errores globalmente
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const msg = error.response?.data?.message || 'Error de conexión';

    if (error.response?.status === 401) {
      const hadToken = localStorage.getItem('token');
      localStorage.removeItem('token');
      if (hadToken && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    } else if (error.response?.status >= 500) {
      toast.error('Error del servidor. Intenta de nuevo.');
    }

    return Promise.reject(new Error(msg));
  }
);

export default api;
