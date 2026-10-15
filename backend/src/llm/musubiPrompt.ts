/**
 * ムスビの総合相談：各占い師のところで得た情報をまとめて、その人の「人となり」を解析し、悩み・状況に答える
 *
 * 2段階で行う：
 *   1. 人物像の解析（buildMusubiProfilePrompt）… すべての診断結果と、これまでの悩みから、その人の人となりを読み解く
 *   2. 総合相談（buildMusubiPrompt）… 1の解析と、元の情報をもとに、今の悩み・状況に答える
 * どちらも、渡した情報だけを根拠にし、無い情報については、何も言わせない（推測で補わない）。
 */

import type { UserProfileSources } from '../db/musubi.js'

const CHARACTER_NAMES: Record<number, string> = { 0: 'ムスビ', 1: 'ナツメ', 2: 'ツキ', 3: 'コクウ', 4: 'クリ' }

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
  return `## 性格タイプ診断・16タイプ（クリのところで得た情報）\n- タイプ：${m.personalityType}${dims ? `\n- 各軸の割合：${dims}` : ''}`
}

function sectionLove(l: any): string {
  return `## 恋愛タイプ診断64（クリのところで得た情報）\n- タイプ：${l.fullType}（${l.characterName} × ${l.subTypeName}）\n- ${l.subTypeTagline}\n- 特徴：${(l.subTypeTraits ?? []).join('、')}`
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)

export function hasAnyProfile(p: UserProfileSources): boolean {
  return !!(p.birth || p.mbti || p.loveType || p.palmAnalysis || p.seimeiAnalysis || p.sukuyouAnalysis)
}

/** 集めた情報を、出どころごとの節にまとめる（無い情報の節は作らない） */
export function buildFactSections(profile: UserProfileSources): string {
  const sections: string[] = []
  if (profile.birth) sections.push(sectionBirth(profile.birth))
  if (profile.mbti) sections.push(sectionMbti(profile.mbti))
  if (profile.loveType) sections.push(sectionLove(profile.loveType))
  if (profile.palmAnalysis) sections.push(`## 手相（コクウのところで得た診断。写真は、診断文に反映済み）\n${clip(profile.palmAnalysis, 1800)}`)
  if (profile.seimeiAnalysis) sections.push(`## 姓名判断（コクウのところで得た診断。先頭は、名前と五格の要約）\n${clip(profile.seimeiAnalysis, 1500)}`)
  if (profile.sukuyouAnalysis) sections.push(`## 宿曜占星術（ツキのところで得た診断）\n${clip(profile.sukuyouAnalysis, 1500)}`)
  if (profile.pastConcerns.length > 0) {
    sections.push(
      '## これまでに、占い師たちへ相談してきた、悩み・状況（新しい順。この人が、何を気にしてきたかの手がかり）\n' +
        profile.pastConcerns
          .map((c) => `- ${c.date}${c.characterId !== null && CHARACTER_NAMES[c.characterId] ? `（${CHARACTER_NAMES[c.characterId]}）` : ''}：${c.concern}`)
          .join('\n')
    )
  }
  const counts = Object.entries(profile.diagnosisCounts)
    .map(([id, n]) => `${CHARACTER_NAMES[Number(id)] ?? id}：${n}回`)
    .join('、')
  if (counts) sections.push(`## 占い師ごとに、これまで診断を受けた回数\n- ${counts}`)
  if (profile.previousMusubi.length > 0) {
    sections.push(
      '## 以前の、ムスビの総合相談（新しい順。前回からの変化を見るための手がかり）\n' +
        profile.previousMusubi.map((p) => `### ${p.date}\n${clip(p.analysis, 1200)}`).join('\n\n')
    )
  }
  return sections.join('\n\n')
}

const COMMON_RULES = `- 渡された情報**だけ**を根拠に書く。挙がっていない占い（情報が無いもの）については、何も言わない。「無い」「未診断」とも書かない。
- 診断結果同士で、方向が食い違うものがあっても、無理に一つにまとめず、「こちらから見るとこう、あちらから見るとこう」と、両方を示す。
- 占いは流派で解釈が分かれるため、断定ではなく「傾向」として語る。医学的な診断・寿命・病気・事故の断定は、絶対にしない。
- どの占い師のところの情報かが分かるように、「ナツメのところで視た命式では」「クリのところのタイプでは」のように、出どころを添える。
- 誰にでも当てはまる一般論や、「運が良い」「宿命」のような曖昧な表現は避ける。具体的で、この人にしか当てはまらない書き方にする。`

/** 1段階目：すべての診断結果から、その人の「人となり」を読み解く */
export function buildMusubiProfilePrompt(profile: UserProfileSources): string {
  return `あなたは、占いの館の案内人「ムスビ」です。館の占い師たち（ナツメ、ツキ、コクウ、クリ）みんなから、この人のことを聞いています。
今から、集まった情報のすべてを重ね合わせて、この人の「人となり」を、できるだけ深く、立体的に読み解いてください。これは、次に行う悩み相談の、土台になる解析です。

# 集まっている情報（これがすべて）
${buildFactSections(profile)}

# ルール
${COMMON_RULES}

# 📝 出力（Markdown、です・ます体ではなく、ムスビの静かな語り口。900〜1500字）
- ## 核になる性格と価値観（この人が、何を大切にして動いているか）
- ## 人との関わり方・恋愛のスタイル
- ## 仕事・学び・お金への向き合い方
- ## 心の負荷のかかり方と、立て直し方
- ## 診断同士が重なって見える特徴／食い違って見える特徴（出どころを添えて）
- ## これまでの悩みから見える、気にし続けていること（悩みの記録があるときだけ）
- ## 前回の総合相談からの変化（前回の記録があるときだけ）
`
}

/** 2段階目：人物像の解析と、集まった情報をもとに、今の悩み・状況に答える */
export function buildMusubiPrompt(profile: UserProfileSources, concern: string, profileText?: string | null): string {
  const hasConcern = !!concern && concern.trim().length > 0
  const analysisBlock = profileText
    ? `# 先に行った、この人の「人となり」の解析（これを土台に答える）\n${clip(profileText, 3500)}\n\n`
    : ''

  return `あなたは、占いの館の案内人「ムスビ」です。温かみのある長男肌で、村上春樹の小説の語り手のような、静かで少し乾いたユーモアのある語り口（一人称は「僕」、相手は「君」）で、診断文を書きます。
ムスビは、館の占い師たち（ナツメ、ツキ、コクウ、クリ）みんなから、ユーザーのことを聞いている、よき相談相手です。今回は、そのすべての情報と、人となりの解析を踏まえて、悩み・状況に答える「総合相談」です。

${analysisBlock}# これまでに、各占い師のところで得た情報（これがすべて。ここに無いことは、知らないものとして扱う）
${buildFactSections(profile)}

# ルール
${COMMON_RULES}
- 悩みに答えるときは、「この人の人となりだからこそ」の視点で書く。同じ悩みでも、人によって、答えが変わることを、はっきり示す。
- 答えは、結論を先に言い、そのあとに、根拠（どの占い師のところの、どの情報か）を添える。

**あなたの状況・悩み：**
${hasConcern ? concern : '特定の悩みの入力はなし。これまでの情報から、総合的な人物像と、これからの傾向を診断してほしい。'}

---

# 📝 出力
Markdown の診断文を、次の構成で書く（です・ます体ではなく、ムスビの語り口。短い段落と箇条書きを組み合わせる）。
- 総合結論（1-2段落。見出しは付けず、本文から書き始める。悩みへの、いちばん大事な答えを先に）
- ## 見えてきた、君の輪郭（情報同士の重なりと、違いを、出どころを添えて、4〜6点）
- ## 悩み・状況の診断（君の人となりを踏まえて、悩みの背景を読み解く。選べる道が複数あるなら、それぞれ、君に向く点・向かない点を示す）
- ## 今の君の、強みと落とし穴
- ## 今からできる行動プラン（短期・中期・長期に分けて 3-5個）
- ## 長期展望（1-2段落）
- 最後に、ムスビらしい、短いひとこと
`
}
