import { api } from '../services/api';

export interface PushStatus {
  enabled: boolean;
  publicKey: string | null;
  subscriptions: number;
}

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function getPushStatus(): Promise<PushStatus> {
  const res = await api.get<{ data: PushStatus }>('/notifications/push');
  return res.data.data;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Asks for permission, subscribes this browser, and registers the subscription with the server. */
export async function enablePush(publicKey: string) {
  if (!pushSupported()) throw new Error('This browser does not support push notifications.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser settings to turn this on.');

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));

  const json = sub.toJSON();
  await api.post('/notifications/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await api.post('/notifications/push/unsubscribe', { endpoint: sub.endpoint });
  await sub.unsubscribe();
}
