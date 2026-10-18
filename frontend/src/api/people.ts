/**
 * 縁帳（周りの人の記録）API クライアント
 * 「縁むすび」方式：相手本人が、招待リンクから答える
 */

import { getToken, API_URL } from '../api';

export type Relation = 'family' | 'friend' | 'lover' | 'work' | 'other';
export type Method = 'quiz' | 'picked';

export interface PersonResult {
  fullType: string;
  type1: string;
  type2: string;
  characterName: string;
  subTypeName: string;
  /** quiz＝18問に答えた／picked＝タイプを選んだ（本人の申告） */
  confidence: Method;
}

export interface Person {
  id: string;
  name: string;
  relation: Relation;
  memo: string;
  createdAt: string;
  status: 'pending' | 'answered' | 'expired';
  inviteToken: string | null;
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

export interface InviteInfo {
  fromName: string;
  relation: Relation;
}

export interface InviteResult {
  fullType: string;
  type1: string;
  characterName: string;
  characterDesc: string;
  subTypeName: string;
  subTypeTagline: string;
}

type Res<T> = T & { success: boolean; error?: string };

function headers(auth: boolean) {
  const token = auth ? getToken() : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function call<T>(base: string, path: string, method = 'GET', body?: unknown, auth = true): Promise<Res<T>> {
  try {
    const res = await fetch(`${API_URL}/api/${base}${path}`, { method, headers: headers(auth), body: body ? JSON.stringify(body) : undefined });
    return await res.json();
  } catch {
    return { success: false, error: '通信に失敗しました' } as Res<T>;
  }
}

export const listPeople = () => call<{ limit: number; people: Person[] }>('people', '');
export const addPerson = (p: { name: string; relation: Relation; memo: string; fromName: string }) =>
  call<{ id: string; inviteToken: string }>('people', '', 'POST', p);
export const reissueInvite = (id: string) => call<{ inviteToken: string }>('people', `/${id}/invite`, 'POST');
export const deletePerson = (id: string) => call<object>('people', `/${id}`, 'DELETE');
export const deleteAllPeople = () => call<object>('people', '', 'DELETE');
export const getPerson = (id: string) => call<{ person: Person; comparison: Comparison | null }>('people', `/${id}`);
export const getLinks = () => call<Links>('people', '/links');

// 招待された本人（ログイン不要）
export const getInvite = (token: string) => call<InviteInfo>('invite', `/${token}`, 'GET', undefined, false);
export const answerInvite = (token: string, body: { consent: true; answers?: { id: number; val: number }[]; pickedType?: string }) =>
  call<{ revokeToken: string; result: InviteResult }>('invite', `/${token}/answer`, 'POST', body, false);
export const revokeAnswer = (revokeToken: string) => call<object>('invite', `/revoke/${revokeToken}`, 'POST', undefined, false);

/** 招待リンクのURL（スマホ実機テストでは VITE_QR_ORIGIN のトンネルURLを使う） */
export function inviteUrl(token: string): string {
  const origin = (import.meta.env.VITE_QR_ORIGIN as string | undefined) || window.location.origin;
  return `${origin}/invite/${token}`;
}
