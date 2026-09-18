/**
 * Gemini Vision API で手相認識テスト
 * テスト画像: lefthand.jpg
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const client = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * 手相画像をBase64エンコード
 */
function encodeImage(imagePath: string): string {
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString("base64");
}

/**
 * Gemini Vision で手相を分析
 */
async function analyzePalmistry(imagePath: string) {
  console.log("\n🖐️ Gemini Vision API 手相分析テスト");
  console.log(`画像: ${imagePath}\n`);

  try {
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

    const imageBase64 = encodeImage(imagePath);

    const prompt = `
この手相画像を分析してください。以下の情報を JSON 形式で返してください：

{
  "lines": [
    {
      "name": "線の名前（生命線、知能線、感情線など）",
      "description": "この線の特徴（長さ、曲線、分岐など）",
      "position": "手のひらのどの位置か（例：手首から中指まで）",
      "characteristics": ["特徴1", "特徴2", ...]
    }
  ],
  "markings": [
    {
      "type": "記号の種類（星、十字、島など）",
      "location": "位置",
      "meaning": "占術的意味"
    }
  ],
  "hands": {
    "type": "左手/右手",
    "palm_size": "大きさの分類",
    "fingers": "指の特徴（長さなど）"
  },
  "overall_interpretation": "総合的な運勢解釈（段落形式、日本語で自然な文章）",
  "confidence": {
    "line_detection": 0.0-1.0,
    "marking_detection": 0.0-1.0,
    "interpretation_reliability": 0.0-1.0
  }
}

注意：
- 必ず JSON 形式で返してください
- 占術的な解釈は、一般的な手相学に基づいてください
- 不確実な点は confidence スコアで示してください
- 医学的根拠はない占術であることを念頭に置いてください
    `;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64,
        },
      },
      {
        text: prompt,
      },
    ]);

    const response = result.response;
    const text = response.text();

    console.log("📋 Gemini Vision API の応答:\n");
    console.log(text);

    // JSON の抽出を試みる
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        console.log("\n✅ JSON 解析成功！");
        console.log("\n【検出された主要線】");
        jsonData.lines.forEach((line: any) => {
          console.log(`- ${line.name}: ${line.description}`);
          console.log(`  位置: ${line.position}`);
          console.log(`  信頼度: ${line.characteristics.join(", ")}`);
        });

        console.log("\n【占術的解釈】");
        console.log(jsonData.overall_interpretation);

        console.log("\n【精度評価】");
        console.log(`線の検出精度: ${(jsonData.confidence.line_detection * 100).toFixed(1)}%`);
        console.log(
          `記号の検出精度: ${(jsonData.confidence.marking_detection * 100).toFixed(1)}%`
        );
        console.log(
          `解釈の信頼度: ${(jsonData.confidence.interpretation_reliability * 100).toFixed(1)}%`
        );
      }
    } catch (e) {
      console.log("\n⚠️ JSON 解析失敗（テキスト応答のみ）");
    }
  } catch (error) {
    console.error("❌ エラー:", error);
    throw error;
  }
}

// テスト実行
const testImagePath = path.join(
  "G:",
  "マイドライブ",
  "AI-project",
  "ai-fortune",
  "assets",
  "lefthand.jpg"
);

analyzePalmistry(testImagePath).catch(console.error);
