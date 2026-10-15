/**
 * 「受付して、できたら知らせる」診断の、画面側
 *
 * 診断（AI）は、混雑すると数分かかる。1回の通信を待ち続けず、依頼を受け付けてもらい（ジョブ番号）、短い通信で結果を取りに行く。
 * 画面を開いたまま待つ場合は、従来どおり、結果が出たら、その画面で結果を見せる。
 * 待てないとき（「待たずに、他のことをする」）は、診断はサーバーで続き、できたら、通知でお知らせする。
 *
 * fetchDiagnosis は、fetch と同じ使い方で、診断の結果（Response）を返す。ゲスト（未ログイン）は、従来どおり、その場で待つ。
 */

import { getToken, API_URL } from '../api';

export interface PendingJob {
  id: string;
  /** 結果の種類（前回の結果の kind と同じ。'compat' は、見返せない） */
  kind: string;
  /** 通知に出す名前 */
  label: string;
  startedAt: number;
}

export interface JobFinished {
  job: PendingJob;
  ok: boolean;
  message: string;
}

const STORAGE_KEY = 'pendingJobs';

function readPending(): PendingJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingJob[]) : [];
  } catch {
    return [];
  }
}

function writePending(jobs: PendingJob[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    /* 保存できなくても、診断そのものは続く */
  }
}

function addPending(job: PendingJob) {
  writePending([...readPending().filter((j) => j.id !== job.id), job]);
}

function removePending(id: string) {
  writePending(readPending().filter((j) => j.id !== id));
}

/** いま、この画面で結果を待っているジョブ */
const waiting = new Map<string, PendingJob>();
/** 「待たずに、他のことをする」を選んだジョブ（背景で見守る） */
const detached = new Set<string>();

const waitingListeners = new Set<() => void>();
const detachListeners = new Set<() => void>();
const finishedListeners = new Set<(f: JobFinished) => void>();

function emitWaiting() {
  waitingListeners.forEach((l) => l());
}

/** 待っているジョブの数が変わったときの通知（読み込み画面が、「待たずに…」ボタンを出すかの判断に使う） */
export function subscribeWaiting(listener: () => void): () => void {
  waitingListeners.add(listener);
  return () => waitingListeners.delete(listener);
}

export function hasDetachableWaiting(): boolean {
  return [...waiting.values()].some((j) => j.kind !== 'compat' && !detached.has(j.id));
}

/** 「待たずに、他のことをする」：待っている診断を、背景に回す（画面の側は、占い師選択へ戻る） */
export function detachWaitingJobs() {
  for (const j of waiting.values()) if (j.kind !== 'compat') detached.add(j.id);
  emitWaiting();
  detachListeners.forEach((l) => l());
  // ブラウザの通知を、できたときに出せるよう、許可を求める（この操作の直後でないと、許可を求められない）
  try {
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
  } catch {
    /* 通知が使えない環境では、画面内のお知らせだけになる */
  }
}

export function subscribeDetach(listener: () => void): () => void {
  detachListeners.add(listener);
  return () => detachListeners.delete(listener);
}

export function subscribeFinished(listener: (f: JobFinished) => void): () => void {
  finishedListeners.add(listener);
  return () => finishedListeners.delete(listener);
}

function authHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 結果を1回取りに行く。通信が一時的に切れたときは null（あとで、もう一度） */
async function pollOnce(id: string): Promise<{ status: number; body: unknown } | null | 'gone'> {
  try {
    const res = await fetch(`${API_URL}/api/jobs/${id}`, { headers: authHeader() });
    if (res.status === 404) return 'gone';
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 'done') return { status: data.httpStatus ?? 500, body: data.body };
    return null;
  } catch {
    return null;
  }
}

function describe(body: unknown): string {
  const b = body as { message?: string; error?: string } | null;
  return b?.message || b?.error || '';
}

function notifyFinished(job: PendingJob, status: number, body: unknown) {
  const ok = status >= 200 && status < 300 && (body as { success?: boolean } | null)?.success !== false;
  const f: JobFinished = { job, ok, message: ok ? '' : describe(body) };
  finishedListeners.forEach((l) => l(f));
}

/** 診断の依頼を送り、結果を Response として返す（受付型なら、結果が出るまで待つ） */
export async function fetchDiagnosis(
  url: string,
  init: RequestInit,
  meta: { kind: string; label: string }
): Promise<Response> {
  const headers = { ...(init.headers as Record<string, string> | undefined), 'X-Async-Job': '1' };
  const res = await fetch(url, { ...init, headers });
  if (res.status !== 202) return res;

  const { jobId } = (await res.json()) as { jobId: string };
  const job: PendingJob = { id: jobId, kind: meta.kind, label: meta.label, startedAt: Date.now() };
  addPending(job);
  waiting.set(jobId, job);
  emitWaiting();

  try {
    for (let i = 0; ; i++) {
      await sleep(i < 5 ? 1500 : 3000);
      if (detached.has(jobId)) {
        // 画面は、占い師選択へ戻っている。この呼び出しは、このまま終わらせ（結果は、通知でお知らせする）、背景の見守りに引き継ぐ
        return new Promise<Response>(() => {});
      }
      const r = await pollOnce(jobId);
      if (r === 'gone') {
        removePending(jobId);
        return new Response(JSON.stringify({ success: false, error: 'JOB_GONE', message: '診断の受付が見つかりませんでした。もう一度お試しください。' }), { status: 404 });
      }
      if (r) {
        removePending(jobId);
        return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
      }
    }
  } finally {
    waiting.delete(jobId);
    emitWaiting();
  }
}

/**
 * 背景の見守り：「待たずに…」を選んだ診断や、画面を開き直す前に受け付けた診断の、結果を取りに行き、できたら知らせる
 * アプリの根元で、1回だけ開始する。止めるときは、戻り値の関数を呼ぶ
 */
export function startBackgroundJobWatcher(): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped || !getToken()) return;
    for (const job of readPending()) {
      // いま、この画面が待っているジョブは、そちらに任せる
      if (waiting.has(job.id) && !detached.has(job.id)) continue;
      const r = await pollOnce(job.id);
      if (r === null) continue;
      removePending(job.id);
      detached.delete(job.id);
      if (r === 'gone') notifyFinished(job, 404, { success: false, message: '診断の受付が見つかりませんでした。' });
      else notifyFinished(job, r.status, r.body);
    }
  };
  const timer = window.setInterval(tick, 4000);
  void tick();
  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}
