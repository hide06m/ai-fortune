/**
 * 相性診断 API クライアント
 */

import { getToken, API_URL } from '../api';
import type { BaZiChart, NumerologyResult } from '../api';
import { fetchDiagnosis } from './asyncJob';

export interface CompatibilityPersonInput {
  name?: string;
  birthDate: string;
  birthTime?: string;
}

export interface CompatibilityPersonResult {
  label: string;
  baZi: BaZiChart;
  numerology: NumerologyResult;
  kyuseiSeisun: string;
}

export interface CompatibilityResponse {
  success: boolean;
  personA?: CompatibilityPersonResult;
  personB?: CompatibilityPersonResult;
  analysis?: string;
  cached?: boolean;
  stoneBalance?: number | null;
  error?: string;
  message?: string;
}

function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function callCompatibilityAPI(
  personA: CompatibilityPersonInput,
  personB: CompatibilityPersonInput
): Promise<CompatibilityResponse> {
  const response = await fetchDiagnosis(`${API_URL}/api/compatibility`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ personA, personB }),
  }, { kind: 'compat', label: '相性診断' });

  if (!response.ok) {
    if (response.status === 429) {
      return {
        success: false,
        error: '本日の診断回数上限に達しました。明日もう一度お試しください。',
      };
    }
    try {
      const error = await response.json();
      return {
        success: false,
        error: error.message || error.error || 'Failed to call compatibility API',
      };
    } catch {
      return {
        success: false,
        error: `エラーが発生しました (${response.status})`,
      };
    }
  }

  return response.json();
}
