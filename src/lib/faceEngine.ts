import * as faceapi from 'face-api.js'

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models'

let loading: Promise<void> | null = null

export function loadFaceModels(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
      ])
    })()
  }
  return loading
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
