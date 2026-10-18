/**
 * 縁帳（周りの人の記録）API クライアント
 */

import { getToken, API_URL } from '../api';

export type Relation = 'family' | 'friend' | 'lover' | 'work' | 'other';
export type Confidence = 'high' | 'partial' | 'low';

export interface PersonResult {
  fullType: string;
  type1: string;
  type2: string;
  characterName: string;
  subTypeName: string;
  confidence: Confidence;
}

export interface Person {
  id: string;
  name: string;
  relation: Relation;
  memo: string;
  createdAt: string;
  result: PersonResult | null;
}

export interface AxisComparison {
  axis: string;
  name: string;
  mine: string;
  theirs: string;
  same: boolean;
}

export interface Comparison {
  axes: AxisComparison[];
  sameCount: number;
  total: number;
  summary: string;
}

export interface Links {
  sameType: { type1: string; names: string[] }[];
  sameAsMe: string[];
  myType1: string | null;
}

function headers() {
  const token = getToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T & { success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/people${path}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
    return await res.json();
  } catch {
    return { success: false, error: '通信に失敗しました' } as T & { success: boolean; error?: string };
  }
}

export const listPeople = () => call<{ limit: number; people: Person[] }>('');
export const addPerson = (p: { name: string; relation: Relation; memo: string }) => call<{ id: string }>('', 'POST', p);
export const deletePerson = (id: string) => call<object>(`/${id}`, 'DELETE');
export const deleteAllPeople = () => call<object>('', 'DELETE');
export const getPerson = (id: string) => call<{ person: Person; comparison: Comparison | null }>(`/${id}`);
export const getLinks = () => call<Links>('/links');
export const diagnosePerson = (id: string, answers: { id: number; val: number }[], confidence: Confidence) =>
  call<{ stoneBalance: number }>(`/${id}/diagnose`, 'POST', { answers, confidence });
