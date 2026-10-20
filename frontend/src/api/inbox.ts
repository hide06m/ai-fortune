/**
 * 受信箱 API クライアント（運営からのお知らせ・お詫びの石の配布）
 */

import { getToken, API_URL } from '../api';

export interface InboxMessage {
  id: string;
  kind: string;
  title: string;
  body: string;
  /** 受け取れる石の数（0ならお知らせだけ） */
  stones: number;
  showOnHome: boolean;
  createdAt: string;
  expiresAt: string | null;
  read: boolean;
  claimed: boolean;
}

export interface InboxResponse {
  success: boolean;
  messages: InboxMessage[];
  unread: number;
  claimable: number;
}

function headers() {
  const token = getToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function getInbox(): Promise<InboxResponse> {
  const r = await fetch(`${API_URL}/api/inbox`, { headers: headers() });
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  return r.json();
}

export async function markInboxRead(id: string): Promise<void> {
  await fetch(`${API_URL}/api/inbox/${id}/read`, { method: 'POST', headers: headers() }).catch(() => undefined);
}

export async function claimInbox(id: string): Promise<{ granted: number; balance?: number; reason?: string }> {
  const r = await fetch(`${API_URL}/api/inbox/${id}/claim`, { method: 'POST', headers: headers() });
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  return r.json();
}

export async function claimAllInbox(): Promise<{ granted: number; balance?: number }> {
  const r = await fetch(`${API_URL}/api/inbox/claim-all`, { method: 'POST', headers: headers() });
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  return r.json();
}
