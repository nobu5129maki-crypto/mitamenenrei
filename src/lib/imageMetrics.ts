import { clamp } from './scoring'

type Point = { x: number; y: number }

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function drawToCanvas(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D {
  const w =
    source instanceof HTMLVideoElement ? source.videoWidth : source.width
  const h =
    source instanceof HTMLVideoElement ? source.videoHeight : source.height
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(source, 0, 0, w, h)
  return ctx
}

function regionStdDev(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rw: number,
  rh: number,
): number {
  const fx = Math.max(0, Math.floor(x))
  const fy = Math.max(0, Math.floor(y))
  const fw = Math.min(ctx.canvas.width - fx, Math.ceil(rw))
  const fh = Math.min(ctx.canvas.height - fy, Math.ceil(rh))
  if (fw < 4 || fh < 4) return 0
  const data = ctx.getImageData(fx, fy, fw, fh).data
  let sum = 0
  let sum2 = 0
  let n = 0
  for (let i = 0; i < data.length; i += 16) {
    const g = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
    sum += g
    sum2 += g * g
    n++
  }
  if (n === 0) return 0
  const mean = sum / n
  return Math.sqrt(Math.max(0, sum2 / n - mean * mean))
}

export type FaceMetrics = {
  textureScore: number
  jawPatchiness: number
  faceAsymmetry: number
  elongationScore: number
  fwIo: number
  earAvg: number
  mouthWarmth: number
  stylingNeat: number
}

export function extractFaceMetrics(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  positions: Point[],
  box: { x: number; y: number; width: number; height: number },
  predAge: number,
): FaceMetrics {
  const canvas = document.createElement('canvas')
  const ctx = drawToCanvas(source, canvas)

  const jawPts = [0, 2, 4, 6, 8, 10, 12, 14, 16].map((i) => positions[i]!)
  let jawSum = 0
  let jawSum2 = 0
  let jn = 0
  for (const p of jawPts) {
    const px = clamp(p.x, box.x + 1, box.x + box.width - 2)
    const py = clamp(p.y, box.y + 1, box.y + box.height - 2)
    const d = ctx.getImageData(Math.floor(px), Math.floor(py), 1, 1).data
    const g = 0.299 * d[0]! + 0.587 * d[1]! + 0.114 * d[2]!
    jawSum += g
    jawSum2 += g * g
    jn++
  }
  const jMean = jawSum / jn
  const jawStdev = Math.sqrt(
    Math.max(0, jawSum2 / jn - jMean * jMean),
  )
  const jawPatchiness = clamp(((jawStdev - 6) / 22) * 100, 0, 100)

  const browYs = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26].map(
    (i) => positions[i]!.y,
  )
  const browTop = Math.min(...browYs)
  const foreheadTex = regionStdDev(
    ctx,
    box.x + box.width * 0.25,
    box.y + box.height * 0.08,
    box.width * 0.5,
    Math.max(8, browTop - box.y - box.height * 0.02),
  )
  const textureScore = clamp(((foreheadTex - 6) / 26) * 100, 0, 100)

  const cx = box.x + box.width / 2
  const leftMean = regionStdDev(ctx, box.x + box.width * 0.05, box.y + box.height * 0.25, box.width * 0.38, box.height * 0.45)
  const rightMean = regionStdDev(
    ctx,
    cx,
    box.y + box.height * 0.25,
    box.width * 0.38,
    box.height * 0.45,
  )
  const faceAsymmetry = clamp((Math.abs(leftMean - rightMean) - 1) / 10 * 100, 0, 100)

  const faceWidth = dist(positions[0]!, positions[16]!)
  const faceHeight = dist(positions[8]!, positions[27]!)
  const interOc = dist(positions[39]!, positions[42]!)
  const elongation = faceHeight / Math.max(1, faceWidth)
  const elongationScore = clamp(((elongation - 1.05) / 0.45) * 100, 0, 100)
  const fwIo = faceWidth / Math.max(1, interOc)

  const earL =
    (dist(positions[37]!, positions[41]!) +
      dist(positions[38]!, positions[40]!)) /
    (2 * Math.max(1, dist(positions[36]!, positions[39]!)))
  const earR =
    (dist(positions[43]!, positions[47]!) +
      dist(positions[44]!, positions[46]!)) /
    (2 * Math.max(1, dist(positions[42]!, positions[45]!)))
  const earAvg = (earL + earR) / 2

  const avgCornerY = (positions[48]!.y + positions[54]!.y) / 2
  const lipMidY = (positions[51]!.y + positions[57]!.y) / 2
  const mouthWarmth = clamp(((lipMidY - avgCornerY + 4) / 18) * 100, 0, 100)

  const mess = clamp(0.55 * jawPatchiness + 0.35 * faceAsymmetry + 0.1 * textureScore, 0, 100)
  const stylingNeat = clamp(100 - mess + (predAge < 30 ? 6 : predAge > 55 ? 4 : 0), 0, 100)

  return {
    textureScore,
    jawPatchiness,
    faceAsymmetry,
    elongationScore,
    fwIo,
    earAvg,
    mouthWarmth,
    stylingNeat,
  }
}
