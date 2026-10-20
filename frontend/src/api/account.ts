/**
 * アカウントの削除（本人のデータをすべて消す）
 */

import { getToken, API_URL } from '../api';

export async function deleteMyAccount(): Promise<void> {
  const token = getToken();
  const r = await fetch(`${API_URL}/api/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ confirm: 'DELETE' }),
  });
  if (!r.ok) throw new Error(`API error: ${r.status}`);
}
