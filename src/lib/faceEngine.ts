import * as faceapi from 'face-api.js'

/** Same-origin weights from `public/models` (served under Vite `BASE_URL`). */
const MODEL_URI = `${import.meta.env.BASE_URL}models`

let loadPromise: Promise<void> | null = null
let weightsLoaded = false

export function loadFaceModels(): Promise<void> {
  if (weightsLoaded) return Promise.resolve()
  if (!loadPromise) {
    loadPromise = (async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URI),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URI),
        faceapi.nets.ageGenderNet.loadFromUri(MODEL_URI),
      ])
      weightsLoaded = true
    })().finally(() => {
      loadPromise = null
    })
  }
  return loadPromise
}

export function runDetection(
  input: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
) {
  return faceapi
    .detectSingleFace(
      input,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.45,
      }),
    )
    .withFaceLandmarks()
    .withAgeAndGender()
}
