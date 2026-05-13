import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { analyzePortrait, type AnalysisResult } from './lib/analyze'
import { loadFaceModels } from './lib/faceEngine'
import { LOOK_YOUNGER_SECTION, SHOW_GRAVITAS_SECTION } from './lib/afterResultTips'
import { DIMENSION_LABELS } from './lib/scoring'

type Status =
  | { kind: 'loading-models' }
  | { kind: 'ready' }
  | { kind: 'analyzing' }
  | { kind: 'error'; message: string }

function Bar({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint: string
}) {
  return (
    <div className="bar">
      <div className="bar-top">
        <span>{label}</span>
        <span className="bar-val">{Math.round(value)}</span>
      </div>
      <div className="bar-track" role="presentation">
        <div className="bar-fill" style={{ width: `${value}%` }} />
      </div>
      <p className="bar-hint">{hint}</p>
    </div>
  )
}

const A_HINTS = [
  '面長さと横幅バランスから「こけ感・締まり」の見え方',
  '額周辺のムラ感から質感の情報量を近似',
  '開き具合から「疲れ・たるみ」寄りを近似',
  '口角の立ち上がりから表情の若さ寄りを近似',
  '顎まわりのムラと左右差から“整え”を近似（高いほど若印象）',
] as const

const G_HINTS = [
  '輪郭の“重み”と落ち着き',
  'テクスチャの深み（物語感）',
  '視線の芯・落ち着き',
  '余裕のある表情の温度',
  '体裁・完成度の説得力',
] as const

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'loading-models' })
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [useCamera, setUseCamera] = useState(false)

  const retryLoadModels = useCallback(() => {
    setStatus({ kind: 'loading-models' })
    loadFaceModels()
      .then(() => {
        setModelsLoaded(true)
        setStatus({ kind: 'ready' })
      })
      .catch(() => {
        setModelsLoaded(false)
        setStatus({
          kind: 'error',
          message:
            'モデルの読み込みに失敗しました。通信が不安定な場合は「モデルを再読み込み」を試すか、ページを更新してください。',
        })
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    loadFaceModels()
      .then(() => {
        if (!cancelled) {
          setModelsLoaded(true)
          setStatus({ kind: 'ready' })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModelsLoaded(false)
          setStatus({
            kind: 'error',
            message:
              'モデルの読み込みに失敗しました。通信が不安定な場合は「モデルを再読み込み」を試すか、ページを更新してください。',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  const startCamera = async () => {
    try {
      stopCamera()
      setPreviewUrl(null)
      setResult(null)
      setUseCamera(true)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      const v = videoRef.current
      if (v) {
        v.srcObject = stream
        await v.play()
      }
      if (modelsLoaded) setStatus({ kind: 'ready' })
    } catch {
      setUseCamera(false)
      setStatus({
        kind: 'error',
        message: 'カメラを利用できませんでした。ブラウザの許可設定を確認してください。',
      })
    }
  }

  const onPickFile = (file: File | null) => {
    if (!file) return
    stopCamera()
    setUseCamera(false)
    setResult(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    if (modelsLoaded) setStatus({ kind: 'ready' })
  }

  const runAnalyze = async () => {
    setStatus({ kind: 'analyzing' })
    setResult(null)
    try {
      let data: AnalysisResult | null = null
      if (useCamera && videoRef.current) {
        data = await analyzePortrait(videoRef.current)
      } else if (previewUrl) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = previewUrl
        await img.decode()
        data = await analyzePortrait(img)
      } else {
        setStatus({
          kind: 'error',
          message: '画像を選ぶか、カメラを開始してください。',
        })
        return
      }
      if (!data) {
        setStatus({
          kind: 'error',
          message: '顔を検出できませんでした。正面・明るめ・顔アップで再撮影してください。',
        })
      } else {
        setResult(data)
        setStatus({ kind: 'ready' })
      }
    } catch {
      setStatus({
        kind: 'error',
        message: '解析中にエラーが発生しました。ページを更新して再試行してください。',
      })
    }
  }

  const canAnalyze = modelsLoaded && (useCamera || previewUrl !== null)
  const analyzing = status.kind === 'analyzing'

  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">エンタメ推定 · ブラウザ完結</p>
        <h1>見た目年齢 × 貫禄ラボ</h1>
        <p className="lede">
          5つの観点からざっくり採点。老け顔も「貫禄」として言語化します。
        </p>
      </header>

      {status.kind === 'loading-models' && (
        <p className="notice">AIモデルを読み込み中…（初回は数十秒かかることがあります）</p>
      )}
      {status.kind === 'error' && (
        <div className="error-block" role="alert">
          <p className="error">{status.message}</p>
          {!modelsLoaded && (
            <button type="button" className="btn secondary" onClick={retryLoadModels}>
              モデルを再読み込み
            </button>
          )}
        </div>
      )}

      <section className="panel controls">
        <div className="row">
          <label className="btn secondary">
            写真を選ぶ
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button type="button" className="btn secondary" onClick={startCamera}>
            カメラ起動
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!canAnalyze || analyzing}
            onClick={runAnalyze}
          >
            {analyzing ? '解析中…' : 'この顔で判定'}
          </button>
        </div>
        <div className="preview-wrap">
          {useCamera ? (
            <video ref={videoRef} className="preview" playsInline muted />
          ) : previewUrl ? (
            <img className="preview" src={previewUrl} alt="選択した写真" />
          ) : (
            <div className="preview placeholder">プレビュー</div>
          )}
        </div>
      </section>

      {result && (
        <section className="panel results">
          <div className="score-grid">
            <div className="score-card age">
              <p className="score-label">見た目年齢（合成スコア）</p>
              <p className="score-num">{result.apparentAge}</p>
              <p className="score-sub">
                モデル推定 {result.modelAge} 歳付近 / {result.genderLabel}
              </p>
              <p className="score-note">{result.summaryLine}</p>
            </div>
            <div className="score-card grav">
              <p className="score-label">貫禄スコア（補正後）</p>
              <p className="score-num">{result.gravitasAdjusted}</p>
              <p className="score-sub">
                素点 {result.gravitas} · ランク {result.rank.rank} — {result.rank.title}
              </p>
              <p className="score-note">{result.rank.body}</p>
            </div>
          </div>

          <h2 className="section-title">5項目 · 年齢感の材料（A）</h2>
          <div className="bars">
            {DIMENSION_LABELS.map((label, i) => (
              <Bar key={label} label={label} value={result.A[i]!} hint={A_HINTS[i]!} />
            ))}
          </div>

          <h2 className="section-title">5項目 · 貫禄の材料（G）</h2>
          <div className="bars">
            {DIMENSION_LABELS.map((label, i) => (
              <Bar key={`g-${label}`} label={label} value={result.G[i]!} hint={G_HINTS[i]!} />
            ))}
          </div>

          <div className="tips-grid">
            <div className="tips-card tips-younger">
              <h2 className="tips-title">{LOOK_YOUNGER_SECTION.title}</h2>
              <p className="tips-sub">{LOOK_YOUNGER_SECTION.subtitle}</p>
              <ul className="tips-list">
                {LOOK_YOUNGER_SECTION.items.map((item) => (
                  <li key={item.head}>
                    <strong>{item.head}</strong>
                    <span>{item.body}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="tips-card tips-grav">
              <h2 className="tips-title">{SHOW_GRAVITAS_SECTION.title}</h2>
              <p className="tips-sub">{SHOW_GRAVITAS_SECTION.subtitle}</p>
              <ul className="tips-list">
                {SHOW_GRAVITAS_SECTION.items.map((item) => (
                  <li key={item.head}>
                    <strong>{item.head}</strong>
                    <span>{item.body}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="tips-disclaimer">
            上記は生活習慣・撮影・振る舞いの一般的なヒントであり、医療行為や美容の効果を保証するものではありません。
          </p>
        </section>
      )}

      <footer className="foot">
        <p>
          本アプリはエンタメ用途の推定です。医療・美容の診断や優劣の断定をしません。写真はサーバーに送っていません（ブラウザ内で処理）。
        </p>
      </footer>
    </div>
  )
}
