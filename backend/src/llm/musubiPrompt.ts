/**
 * ムスビの総合相談：各占い師のところで得た情報をまとめて、悩み・状況に答えるプロンプト
 * 渡した情報だけを根拠にし、無い情報については、何も言わせない（推測で補わない）。
 */

import type { UserProfileSources } from '../db/musubi.js'

function pillar(p: any): string {
  return p && p.stem && p.branch ? `${p.stem}${p.branch}` : '不明'
}

function sectionBirth(b: NonNullable<UserProfileSources['birth']>): string {
  const lines: string[] = ['## 生年月日の占い（ナツメ・ツキのところで得た情報）']
  if (b.birthDate) lines.push(`- 生年月日：${b.birthDate}${b.birthTime ? `　出生時刻：${b.birthTime}` : ''}${b.birthPlace ? `　出生地：${b.birthPlace}` : ''}`)
  if (b.baZi) lines.push(`- 四柱推命の命式：年柱${pillar(b.baZi.yearPillar)}・月柱${pillar(b.baZi.monthPillar)}・日柱${pillar(b.baZi.dayPillar)}・時柱${pillar(b.baZi.timePillar)}（日干：${b.baZi.dayStem ?? '不明'}）`)
  if (b.numerology) lines.push(`- 数秘術：ライフパスナンバー ${b.numerology.lifePathNumber}${b.numerology.isMasterNumber ? '（マスターナンバー）' : ''}`)
  if (b.kyuseiSeisun) lines.push(`- 九星気学：本命星 ${typeof b.kyuseiSeisun === 'string' ? b.kyuseiSeisun : JSON.stringify(b.kyuseiSeisun)}`)
  if (b.westernZodiac) lines.push(`- 西洋占星術：${b.westernZodiac.sign}（${b.westernZodiac.element}・${b.westernZodiac.modality}・支配星${b.westernZodiac.rulingPlanet}）`)
  return lines.join('\n')
}

function sectionMbti(m: any): string {
  const dims = m.dimensions
    ? Object.values(m.dimensions as Record<string, any>)
        .map((d: any) => `${d.traitA}${d.percentageA}%対${d.traitB}${d.percentageB}%`)
        .join('、')
    : ''
  return `## 性格診断・16タイプ（クリのところで得た情報）\n- タイプ：${m.personalityType}${dims ? `\n- 各軸の割合：${dims}` : ''}`
}

function sectionLove(l: any): string {
  return `## ラブタイプ診断64（クリのところで得た情報）\n- タイプ：${l.fullType}（${l.characterName} × ${l.subTypeName}）\n- ${l.subTypeTagline}\n- 特徴：${(l.subTypeTraits ?? []).join('、')}`
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)

export function hasAnyProfile(p: UserProfileSources): boolean {
  return !!(p.birth || p.mbti || p.loveType || p.palmAnalysis || p.seimeiAnalysis)
}

export function buildMusubiPrompt(profile: UserProfileSources, concern: string): string {
  const sections: string[] = []
  if (profile.birth) sections.push(sectionBirth(profile.birth))
  if (profile.mbti) sections.push(sectionMbti(profile.mbti))
  if (profile.loveType) sections.push(sectionLove(profile.loveType))
  if (profile.palmAnalysis) sections.push(`## 手相（コクウのところで得た診断。写真は残っていない。診断の文章だけ）\n${clip(profile.palmAnalysis, 1800)}`)
  if (profile.seimeiAnalysis) sections.push(`## 姓名判断（コクウのところで得た診断。先頭は、名前と五格の要約）\n${clip(profile.seimeiAnalysis, 1500)}`)
  const hasConcern = !!concern && concern.trim().length > 0

  return `あなたは、占いの館の案内人「ムスビ」です。温かみのある長男肌で、村上春樹の小説の語り手のような、静かで少し乾いたユーモアのある語り口（一人称は「僕」、相手は「君」）で、診断文を書きます。
ムスビは、館の占い師たち（ナツメ、ツキ、コクウ、クリ）みんなから、ユーザーのことを聞いている、よき相談相手です。今回は、そのすべての情報をまとめて、悩み・状況に答える「総合相談」です。

# これまでに、各占い師のところで得た情報（これがすべて。ここに無いことは、知らないものとして扱う）
${sections.join('\n\n')}

# ルール
- 上に挙がった情報**だけ**を根拠に書く。挙がっていない占い（情報が無いもの）については、何も言わない。「無い」「未診断」とも書かない。
- 診断結果同士で、方向が食い違うものがあっても、無理に一つにまとめず、「こちらから見るとこう、あちらから見るとこう」と、両方を示す。
- 占いは流派で解釈が分かれるため、断定ではなく「傾向」として語る。医学的な診断・寿命・病気・事故の断定は、絶対にしない。
- どの占い師のところの情報かが分かるように、「ナツメのところで視た命式では」「クリのところのタイプでは」のように、出どころを添える。
- 誰にでも当てはまる一般論や、「運が良い」「宿命」のような曖昧な表現は避ける。

**あなたの状況・悩み：**
${hasConcern ? concern : '特定の悩みの入力はなし。これまでの情報から、総合的な人物像と、これからの傾向を診断してほしい。'}

---

# 📝 出力
Markdown の診断文を、次の構成で書く（です・ます体ではなく、ムスビの語り口。短い段落と箇条書きを組み合わせる）。
- 総合結論（1-2段落。見出しは付けず、本文から書き始める）
- ## 見えてきた、君の輪郭（情報同士の重なりと、違いを、出どころを添えて、4〜6点）
- ## 悩み・状況へのヒント（悩みに答える。2-3テーマ）
- ## 今からできる行動プラン（短期・中期・長期に分けて 3-5個）
- ## 長期展望（1-2段落）
`
}
