// API base URL — dev da Vite proxy (/api → localhost:5000),
// production da VITE_API_URL env var (masalan https://myapp.onrender.com)
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}
