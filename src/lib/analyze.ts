import { extractFaceMetrics } from './imageMetrics'
import { runDetection, loadFaceModels } from './faceEngine'
import {
  agingSummaryLine,
  applyGravitasBonus,
  clamp,
  computeAgingIndex,
  computeApparentAge,
  computeGravitas,
  gravitasRank,
  type Five,
} from './scoring'

export type AnalysisResult = {
  apparentAge: number
  agingIndex: number
  gravitas: number
  gravitasAdjusted: number
  modelAge: number
  genderLabel: string
  rank: ReturnType<typeof gravitasRank>
  summaryLine: string
  A: Five
  G: Five
}

export async function analyzePortrait(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
): Promise<AnalysisResult | null> {
  await loadFaceModels()
  const r = await runDetection(input)
  if (!r) return null

  const box = r.detection.box
  const positions = r.landmarks.positions
  const modelAge = r.age
  const genderLabel = r.gender === 'male' ? '男性寄り' : '女性寄り'

  const m = extractFaceMetrics(input, positions, box, modelAge)
  const ageNorm = clamp(((modelAge - 22) / 48) * 100, 0, 100)
  const roundness = clamp(((m.fwIo - 1.18) / 0.42) * 100, 0, 100)
  const eyeYouth = clamp(((m.earAvg - 0.14) / 0.2) * 100, 0, 100)

  const A = [
    clamp(
      0.5 * ageNorm +
        0.28 * m.elongationScore +
        0.22 * (100 - roundness),
      0,
      100,
    ),
    clamp(0.52 * ageNorm + 0.48 * m.textureScore, 0, 100),
    clamp(0.5 * ageNorm + 0.5 * (100 - eyeYouth), 0, 100),
    clamp(0.45 * ageNorm + 0.55 * (100 - m.mouthWarmth), 0, 100),
    clamp(m.stylingNeat, 0, 100),
  ] as const satisfies Five

  const maturity = clamp(((modelAge - 22) / 48) * 100, 0, 100)
  const eyeCalm = clamp(
    100 - (Math.abs(m.earAvg - 0.26) / 0.12) * 100,
    0,
    100,
  )

  const G = [
    clamp(
      18 +
        0.42 * maturity +
        0.33 * m.elongationScore +
        0.25 * (100 - m.jawPatchiness * 0.45),
      0,
      100,
    ),
    clamp(
      20 +
        0.32 * maturity +
        0.48 * Math.min(m.textureScore * 1.05, 78) +
        0.2 * (modelAge > 42 ? 10 : 5),
      0,
      100,
    ),
    clamp(
      22 +
        0.46 * eyeCalm +
        0.34 * maturity +
        0.2 * (100 - m.textureScore * 0.25),
      0,
      100,
    ),
    clamp(
      20 +
        0.52 * m.mouthWarmth +
        0.33 * maturity +
        0.15 * (100 - m.faceAsymmetry),
      0,
      100,
    ),
    clamp(
      14 + 0.58 * m.stylingNeat + 0.42 * maturity * 0.75,
      0,
      100,
    ),
  ] as const satisfies Five

  const agingIndex = computeAgingIndex(A)
  const apparentAge = computeApparentAge(agingIndex)
  const gravitas = computeGravitas(G)
  const gravitasAdjusted = applyGravitasBonus(gravitas, agingIndex)

  return {
    apparentAge: Math.round(apparentAge),
    agingIndex: Math.round(agingIndex),
    gravitas: Math.round(gravitas),
    gravitasAdjusted: Math.round(gravitasAdjusted),
    modelAge: Math.round(modelAge * 10) / 10,
    genderLabel,
    rank: gravitasRank(gravitasAdjusted),
    summaryLine: agingSummaryLine(agingIndex),
    A,
    G,
  }
}
