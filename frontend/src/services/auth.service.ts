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

export async function getAuthConfig() {
  const res = await api.get<ApiResponse<{ emailEnabled: boolean; pushPublicKey: string | null }>>('/auth/config');
  return res.data.data;
}

export async function forgotPassword(email: string) {
  const res = await api.post<{ success: boolean; message: string }>('/auth/forgot-password', { email });
  return res.data.message;
}

export async function resetPassword(token: string, password: string) {
  const res = await api.post<{ success: boolean; message: string }>('/auth/reset-password', { token, password });
  return res.data.message;
}

export async function verifyEmail(token: string) {
  const res = await api.post<{ success: boolean; message: string }>('/auth/verify-email', { token });
  return res.data.message;
}

export async function resendVerification() {
  const res = await api.post<ApiResponse<{ sent: boolean }>>('/auth/resend-verification');
  return res.data;
}
