export const WEIGHTS_AGE = [0.22, 0.3, 0.24, 0.14, 0.1] as const
export const WEIGHTS_GRAV = [0.12, 0.18, 0.32, 0.26, 0.12] as const

export const DIMENSION_LABELS = [
  '輪郭・ボリューム',
  '皮膚の質（テクスチャ）',
  '目元の印象',
  '表情・口元',
  'スタイリング（整い度）',
] as const

export type Five = readonly [number, number, number, number, number]

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** A1–A4: 年齢感を押し上げる強さ。A5: 整い度（高いほど若印象に寄せる） */
export function computeAgingIndex(A: Five): number {
  const [a1, a2, a3, a4, a5] = A
  const w = WEIGHTS_AGE
  return (
    w[0] * a1 +
    w[1] * a2 +
    w[2] * a3 +
    w[3] * a4 +
    w[4] * (100 - a5)
  )
}

export function computeApparentAge(agingIndex: number): number {
  return 22 + (clamp(agingIndex, 0, 100) / 100) * 48
}

export function computeGravitas(G: Five): number {
  const w = WEIGHTS_GRAV
  return G.reduce((s, g, i) => s + w[i] * g, 0)
}

export function applyGravitasBonus(
  gravitas: number,
  agingIndex: number,
): number {
  const bonus = (8 * Math.max(0, agingIndex - 55)) / 45
  return Math.min(100, gravitas + bonus)
}

export type RankCopy = { rank: string; title: string; body: string }

export function gravitasRank(g: number): RankCopy {
  if (g < 25) {
    return {
      rank: 'D',
      title: '素顔の伸びしろ',
      body: '表情と整えで、同じ顔でも一気に“説得力モード”に切り替えられます。',
    }
  }
  if (g < 45) {
    return {
      rank: 'C',
      title: '近道あり',
      body: 'いまは親しみやすさが前に出ている。目元と口元の余裕を一段足すと貫禄が噛み合います。',
    }
  }
  if (g < 65) {
    return {
      rank: 'B',
      title: 'ちゃんと大人',
      body: '場に馴染む落ち着きが見える。スタイリングの精度を上げると印象が記憶に残りやすいです。',
    }
  }
  if (g < 80) {
    return {
      rank: 'A',
      title: '一目で強い',
      body: '視線と表情に芯がある。年齢感より先に信頼の輪郭が伝わるタイプ。',
    }
  }
  return {
    rank: 'S',
    title: '貫禄の主役',
    body: '画面の中でいちばん物語が濃い顔。老け若ぎより先に存在感が立ちます。',
  }
}

export function agingSummaryLine(agingIndex: number): string {
  if (agingIndex < 38) {
    return '若見え寄り。貫禄は整えと静けさで伸ばせます。'
  }
  if (agingIndex < 58) {
    return '同世代平均付近。質感と目元で上下が決まりやすいゾーン。'
  }
  return '大人の顔の情報量が多い。貫禄スコアで価値の出し方をチェック。'
}
