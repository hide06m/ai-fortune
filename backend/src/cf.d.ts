// Cloudflare Workers の実行環境だけにあるモジュールの型（Node では使わない）
declare module 'cloudflare:node' {
  export function httpServerHandler(opts: { port: number }): { fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> }
}
declare module 'cloudflare:workers' {
  export const env: Record<string, any>
}
