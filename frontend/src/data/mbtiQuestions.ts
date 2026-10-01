/**
 * 性格診断（16タイプ診断）の設問データ（クリ専用）
 * 採点ロジックは backend/src/fortune/mbti.ts 側で行うため、ここでは表示用の文言のみ持つ
 */

export type MBTIDimension = 'EI' | 'SN' | 'TF' | 'JP' | 'AT'

export interface MBTIQuestion {
  id: number
  dim: MBTIDimension
  statement: string
}

export const MBTI_QUESTIONS: MBTIQuestion[] = [
  { id: 0, dim: 'EI', statement: '定期的に新しい友人を作っている。' },
  { id: 1, dim: 'SN', statement: '馴染みのないアイデアや視点の探求は楽しい。' },
  { id: 2, dim: 'TF', statement: '感情的な議論には簡単に動かされない。' },
  { id: 3, dim: 'JP', statement: '締め切りを守るのが苦手。' },
  { id: 4, dim: 'AT', statement: '不安はほとんど感じない。' },
  { id: 5, dim: 'EI', statement: '電話はかけないようにしている。' },
  { id: 6, dim: 'SN', statement: '倫理的なジレンマについて議論するのが好き。' },
  { id: 7, dim: 'TF', statement: '完全に正直であることよりも、思いやりを持つことを優先する。' },
  { id: 8, dim: 'JP', statement: '自分の生活と仕事の空間は、清潔で整理整頓されている。' },
  { id: 9, dim: 'AT', statement: '精神的にいっぱいいっぱいだと、よく感じる。' },
  { id: 10, dim: 'EI', statement: 'チームで何かをするのが好き。' },
  { id: 11, dim: 'SN', statement: '未経験の新しいアプローチを試すのは楽しいと感じる。' },
  { id: 12, dim: 'TF', statement: '行動方針を決めるとき、あなたは他の人の感情より事実を大切にします。' },
  { id: 13, dim: 'JP', statement: '何も計画を立てずに一日を過ごすことがよくある。' },
  { id: 14, dim: 'AT', statement: '会う人に好印象を残すかどうかは、ほとんど気にしない。' },
  { id: 15, dim: 'EI', statement: '事前のアレンジなしに、自分が興味のある人のところに行って話しかけるのは簡単。' },
  { id: 16, dim: 'SN', statement: 'クリエイティブな作品のさまざまな解釈についての議論には、興味がない。' },
  { id: 17, dim: 'TF', statement: '数字やデータより、人々の物語や感情の方があなたに力強く響く。' },
  { id: 18, dim: 'SN', statement: '新しい経験や知識を積極的に追求する。' },
  { id: 19, dim: 'AT', statement: '物事が悪い方向に向かうのではないかと心配しがち。' },
  { id: 20, dim: 'EI', statement: 'グループで行う趣味やアクティビティより、一人で行うものの方が楽しい。' },
  { id: 21, dim: 'SN', statement: '仕事として架空の物語を書いている自分は想像できない。' },
  { id: 22, dim: 'TF', statement: '感情的な面を多少無視してでも、効率的な決断を好む。' },
  { id: 23, dim: 'JP', statement: 'やらなければいけないことをしてからリラックスするのが好き。' },
  { id: 24, dim: 'TF', statement: '意見の相違がある場合、他人の感情をいたわるよりも自分の主張を証明することを優先する。' },
  { id: 25, dim: 'EI', statement: '社交の場では大抵、最初に他の人が自己紹介するのを待つ。' },
  { id: 26, dim: 'AT', statement: 'とても急に機嫌が変わることがある。' },
  { id: 27, dim: 'TF', statement: '事実に基づいた議論よりも、感情的に響くものに説得力を感じる。' },
  { id: 28, dim: 'JP', statement: 'ギリギリのタイミングで最後にやっと何かを行うことが多い。' },
  { id: 29, dim: 'JP', statement: '仕事に優先順位をつけ、効率的に計画を立て、期限よりかなり前に完了させることが多い。' },
  { id: 30, dim: 'EI', statement: '一人でいるより、人と一緒にいる方が好き。' },
  { id: 31, dim: 'SN', statement: '議論がとても理論的になると、退屈に感じたり興味を失ったりする。' },
  { id: 32, dim: 'TF', statement: '事実と感情が相反する場合、たいていは自分の心に従う。' },
  { id: 33, dim: 'JP', statement: '仕事や勉強のために一定のスケジュールを維持するのは難しいと感じる。' },
  { id: 34, dim: 'AT', statement: '一度決めたら、その決断を疑うことはほとんどない。' },
  { id: 35, dim: 'EI', statement: '友達は、自分を活発で社交的な人間だというだろう。' },
  { id: 36, dim: 'SN', statement: '文章を書くなど、さまざまな創造的表現に惹かれる。' },
  { id: 37, dim: 'TF', statement: '通常、感情的な印象よりも客観的な事実に基づいて物事を決める。' },
  { id: 38, dim: 'JP', statement: '1日ごとの「やることリスト」を作るのが好き。' },
  { id: 39, dim: 'AT', statement: '大きなプレッシャーがあっても通常、冷静でいられる。' },
  { id: 40, dim: 'EI', statement: '人脈を広げたり、見知らぬ人に自分を売り込んだりするのは、とても大変だと感じる。' },
  { id: 41, dim: 'SN', statement: '単純明快なアイデアよりも、複雑で斬新なアイデアのほうがワクワクする。' },
  { id: 42, dim: 'EI', statement: '初対面でも、簡単に相手と理解し合うことができる。' },
  { id: 43, dim: 'JP', statement: '計画が途中で中断された場合、できるだけ早く再び軌道に乗せることが最も重要だ。' },
  { id: 44, dim: 'AT', statement: 'ずっと前に自分がした間違いを、まだ気にしている。' },
  { id: 45, dim: 'SN', statement: '将来の世界の様子についての理論的な議論には、あまり興味がない。' },
  { id: 46, dim: 'AT', statement: 'あなたは感情をコントロールするのではなく、感情にコントロールされている。' },
  { id: 47, dim: 'TF', statement: '意思決定をする際、最も論理的で効率的な方法よりも、当事者たちがどう感じるかを重視する。' },
  { id: 48, dim: 'JP', statement: 'あなたの仕事のスタイルは「きちんと着実に努力」ではなく「自然発生するエネルギーの爆発の連続」に近い。' },
  { id: 49, dim: 'AT', statement: '誰かに高く評価されると、その人が自分に落胆するのにどれくらい時間がかかるか考えてしまう。' },
  { id: 50, dim: 'EI', statement: 'ほぼいつも単独で作業する仕事は魅力的だ。' },
  { id: 51, dim: 'SN', statement: '抽象的な哲学的問題についてじっくり考えるのは時間の無駄だと思う。' },
  { id: 52, dim: 'EI', statement: '静かな隠れ家のような場所より、人が沢山いて賑やかな雰囲気の方が好き。' },
  { id: 53, dim: 'SN', statement: 'ある決断が自分にとって正しいと感じれば、それ以上の証拠を必要とせずに行動することが多い。' },
  { id: 54, dim: 'AT', statement: '些細なことでも間違えると、自分の能力と知識全般を疑ってしまう。' },
  { id: 55, dim: 'JP', statement: 'ひとつも手順を省くことなく、順序を追って、念入りに物事を行う。' },
  { id: 56, dim: 'SN', statement: '明確な手順を踏まなければいけない仕事よりも、創造的な解決策を考える仕事を好む。' },
  { id: 57, dim: 'TF', statement: '意思決定をする際は、「論理的な推論」よりも「感情的な直感」に頼る傾向がある。' },
  { id: 58, dim: 'JP', statement: '予定表やリストなどの整理・管理ツールを使うのが好き。' },
  { id: 59, dim: 'AT', statement: '自分に関連する物事は、うまくいくだろうと自信がある。' },
]

export const MBTI_QUESTIONS_PER_PAGE = 6
