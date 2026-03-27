/// <reference types="vite/client" />

const BASE_URL = (import.meta.env.VITE_API_URL as string) || '/api';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: getHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}

export const auth = {
  getStatus: () => req<{ setup: boolean }>('GET', '/auth/status'),
  setup: (password: string) => req<{ token: string }>('POST', '/auth/setup', { password }),
  login: (password: string) => req<{ token: string }>('POST', '/auth/login', { password }),
};

export const categories = {
  list: () => req<import('./types').Category[]>('GET', '/categories'),
  create: (data: Partial<import('./types').Category>) => req<import('./types').Category>('POST', '/categories', data),
  update: (id: string, data: Partial<import('./types').Category>) => req<import('./types').Category>('PUT', `/categories/${id}`, data),
  delete: (id: string) => req<void>('DELETE', `/categories/${id}`),
};

export const tasks = {
  list: (status?: string) => req<import('./types').Task[]>('GET', `/tasks${status ? `?status=${status}` : ''}`),
  create: (data: Partial<import('./types').Task>) => req<import('./types').Task>('POST', '/tasks', data),
  update: (id: string, data: Partial<import('./types').Task>) => req<import('./types').Task>('PUT', `/tasks/${id}`, data),
  delete: (id: string) => req<void>('DELETE', `/tasks/${id}`),
  complete: (id: string) => req<import('./types').Task>('POST', `/tasks/${id}/complete`, {}),
};

export const events = {
  list: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return req<import('./types').CalendarEvent[]>('GET', `/events${qs ? `?${qs}` : ''}`);
  },
  create: (data: Partial<import('./types').CalendarEvent>) => req<import('./types').CalendarEvent>('POST', '/events', data),
  update: (id: string, data: Partial<import('./types').CalendarEvent>) => req<import('./types').CalendarEvent>('PUT', `/events/${id}`, data),
  delete: (id: string) => req<void>('DELETE', `/events/${id}`),
};

export const timelogs = {
  list: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return req<import('./types').TimeLog[]>('GET', `/timelogs${qs ? `?${qs}` : ''}`);
  },
  create: (data: Partial<import('./types').TimeLog>) => req<import('./types').TimeLog>('POST', '/timelogs', data),
  update: (id: string, data: Partial<import('./types').TimeLog>) => req<import('./types').TimeLog>('PUT', `/timelogs/${id}`, data),
  delete: (id: string) => req<void>('DELETE', `/timelogs/${id}`),
  stop: (id: string) => req<import('./types').TimeLog>('POST', `/timelogs/${id}/stop`, {}),
};

export const settings = {
  get: () => req<import('./types').Settings>('GET', '/settings'),
  update: (data: Partial<import('./types').Settings>) => req<import('./types').Settings>('PUT', '/settings', data),
};
