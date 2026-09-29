import { api } from './api';
import type { ApiResponse, NotificationItem } from '../utils/types';

export async function listNotifications(unreadOnly = false) {
  const res = await api.get<ApiResponse<{ notifications: NotificationItem[] }>>('/notifications', {
    params: { unread: unreadOnly },
  });
  return res.data.data.notifications;
}

export async function markRead(id: number | string) {
  await api.patch(`/notifications/${id}/read`);
}
