import { api } from './api';
import type { ApiResponse, User } from '../utils/types';

export async function register(payload: { name: string; email: string; password: string; phone?: string }) {
  const res = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/register', payload);
  return res.data.data;
}

export async function login(payload: { email: string; password: string }) {
  const res = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/login', payload);
  return res.data.data;
}

export async function me() {
  const res = await api.get<ApiResponse<{ user: User }>>('/auth/me');
  return res.data.data.user;
}
