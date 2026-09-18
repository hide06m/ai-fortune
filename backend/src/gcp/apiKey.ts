/**
 * Google Cloud API キー管理
 * ユーザーの GCP プロジェクトで Gemini API キーを動的生成
 */

import { google } from 'googleapis'

/**
 * ユーザーのアクセストークンを使用して、Gemini API キーを取得または生成
 * @param accessToken ユーザーの OAuth アクセストークン
 * @param userEmail ユーザーのメールアドレス
 * @returns API キー、または null
 */
export async function getOrCreateGeminiApiKey(accessToken: string, userEmail: string): Promise<string | null> {
  try {
    // OAuth認証を設定
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })

    // Resource Manager API でプロジェクト情報を取得
    const resourceManager = google.cloudresourcemanager({ version: 'v1', auth })
    const projectsResponse = await resourceManager.projects.list({})

    if (!projectsResponse.data.projects || projectsResponse.data.projects.length === 0) {
      console.error(`[API_KEY] No GCP projects found for ${userEmail}`)
      return null
    }

    const project = projectsResponse.data.projects[0]
    const projectId = project.projectId

    if (!projectId) {
      console.error('[API_KEY] Project ID not found')
      return null
    }

    console.log(`[API_KEY] Found GCP project: ${projectId}`)

    // API Keys API でキーを作成
    const apiKeys = google.apikeys({ version: 'v2', auth })

    // 既存のキーを取得（ai-fortune で始まるもの）
    try {
      const keysResponse = await apiKeys.projects.locations.keys.list({
        parent: `projects/${projectId}/locations/global`,
      })

      const existingKey = keysResponse.data.keys?.find((key: any) =>
        key.displayName?.includes('ai-fortune')
      )

      if (existingKey && existingKey.keyString) {
        console.log(`[API_KEY] Using existing API key for ${userEmail}`)
        return existingKey.keyString
      }
    } catch (error) {
      console.warn('[API_KEY] Failed to list existing keys:', error)
    }

    // 新しいキーを作成
    try {
      const createResponse = await apiKeys.projects.locations.keys.create({
        parent: `projects/${projectId}/locations/global`,
        requestBody: {
          displayName: `ai-fortune-${Date.now()}`,
          restrictions: {
            apiTargets: [
              {
                service: 'generativelanguage.googleapis.com',
              },
            ],
          },
        },
      })

      const newKey = createResponse.data.keyString

      if (newKey) {
        console.log(`[API_KEY] Created new API key for ${userEmail}`)
        return newKey
      }
    } catch (error) {
      console.error('[API_KEY] Failed to create API key:', error)
      return null
    }

    return null
  } catch (error) {
    console.error('[API_KEY] Error getting/creating API key:', error)
    return null
  }
}
