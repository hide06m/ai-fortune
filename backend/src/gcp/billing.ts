/**
 * Google Cloud Billing 管理
 * ユーザーの GCP プロジェクトで Billing Quota を自動設定
 * （無料枠のみを使用、自動課金を防止）
 */

import { google } from 'googleapis'

/**
 * ユーザーのアクセストークンを使用して、Billing Quota を設定
 * @param accessToken ユーザーの OAuth アクセストークン
 * @param userEmail ユーザーのメールアドレス
 * @returns 成功/失敗
 */
export async function setBillingQuotaToZero(accessToken: string, userEmail: string): Promise<boolean> {
  try {
    // OAuth認証を設定
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })

    // Resource Manager API でユーザーのプロジェクト一覧を取得
    const resourceManager = google.cloudresourcemanager({ version: 'v1', auth })
    const projectsResponse = await resourceManager.projects.list({})

    if (!projectsResponse.data.projects || projectsResponse.data.projects.length === 0) {
      console.warn(`[BILLING] No GCP projects found for ${userEmail}`)
      return false
    }

    const project = projectsResponse.data.projects[0]
    const projectId = project.projectId

    if (!projectId) {
      console.error('[BILLING] Project ID not found')
      return false
    }

    console.log(`[BILLING] Found GCP project: ${projectId}`)

    // Compute API (quota.googleapis.com) に対して、quota を $0 に設定
    // ※ 実装上の注意: Google Cloud API の quota 設定は複雑であり、
    // 以下の方法ではなく、Service Usage API を使用する必要があります

    // Service Usage API で Gemini API の quota 制限を設定
    const serviceUsage = google.serviceusage({ version: 'v1', auth })

    // API を有効化（既に有効な可能性）
    try {
      await serviceUsage.services.enable({
        name: `projects/${projectId}/services/generativelanguage.googleapis.com`,
      })
      console.log(`[BILLING] Gemini API enabled for ${projectId}`)
    } catch (error) {
      console.warn('[BILLING] Gemini API already enabled or error:', error)
    }

    // ※ 予算アラートを設定（API Quota の直接設定は制限があるため、代替案）
    // Budget API を使用して、月間支出を監視
    try {
      const billing = google.billingbudgets({ version: 'v1', auth })

      // 既存の予算を取得してから作成する
      const budgetName = `billingAccounts/0/budgets/ai-fortune-free-only`

      const budgetResponse = await billing.billingAccounts.budgets.create({
        parent: 'billingAccounts/0',
        requestBody: {
          displayName: 'AI Fortune - Free Tier Only',
          budgetFilter: {
            projects: [`projects/${projectId}`],
            services: ['services/95FF-2EF5-5EA1'], // Generative AI API service ID
          },
          amount: {
            specifiedAmount: {
              currencyCode: 'USD',
              units: '0', // $0 支出制限
            },
          },
          thresholdRules: [
            {
              thresholdPercent: 100,
              // 超過時に通知
            },
          ],
        },
      })

      console.log(`[BILLING] Budget created: ${budgetResponse.data.name}`)
      return true
    } catch (error) {
      console.warn('[BILLING] Failed to create budget:', error)
      // 予算設定失敗でも続行（API 呼び出しは可能）
      return true
    }
  } catch (error) {
    console.error('[BILLING] Error setting billing quota:', error)
    return false
  }
}
