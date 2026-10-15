/**
 * ムスビの総合相談 API クライアント
 */

import { getToken, API_URL } from '../api';
import { fetchDiagnosis } from './asyncJob';

export interface MusubiResponse {
  success: boolean;
  analysis?: string;
  intimacy?: { characterId: number; intimacyLevel: number; justUnlocked: number | null } | null;
  stoneBalance?: number | null;
  error?: string;
  message?: string;
}

export async function submitMusubiConsult(concern: string): Promise<MusubiResponse> {
  const token = getToken();
  const response = await fetchDiagnosis(`${API_URL}/api/fortune/musubi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ concern }),
  }, { kind: 'musubi', label: 'ムスビの総合相談' });
  const data = await response.json();
  if (!response.ok) {
    return { success: false, error: data.error || `API error: ${response.status}`, message: data.message };
  }
  return data;
}
