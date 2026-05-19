const HOP_SIZE = 512;
const FRAME_SIZE = 1024;
const LOCAL_WINDOW = 20; // frames (~0.5s)
const THRESHOLD_MULTIPLIER = 1.5;
const MIN_GAP_SEC = 0.08;
const MAX_ONSETS = 30;

export function detectOnsets(buffer: AudioBuffer): number[] {
  const sr = buffer.sampleRate;
  const data = buffer.getChannelData(0);

  // RMS energy per hop
  const energy: number[] = [];
  for (let i = 0; i + HOP_SIZE <= data.length; i += HOP_SIZE) {
    let sum = 0;
    const end = Math.min(i + FRAME_SIZE, data.length);
    for (let j = i; j < end; j++) sum += data[j] * data[j];
    energy.push(sum / (end - i));
  }

  // Onset detection function: positive energy flux
  const odf = energy.map((e, i) => (i === 0 ? 0 : Math.max(0, e - energy[i - 1])));

  const minGapFrames = Math.round((MIN_GAP_SEC * sr) / HOP_SIZE);
  const onsets: number[] = [];
  let lastOnsetFrame = -minGapFrames;

  for (let i = 1; i < odf.length - 1; i++) {
    // adaptive threshold from local mean
    const lo = Math.max(0, i - LOCAL_WINDOW);
    const hi = Math.min(odf.length, i + LOCAL_WINDOW);
    let localMean = 0;
    for (let j = lo; j < hi; j++) localMean += odf[j];
    localMean /= hi - lo;

    const threshold = Math.max(THRESHOLD_MULTIPLIER * localMean, 1e-6);
    const isLocalPeak = odf[i] >= odf[i - 1] && odf[i] >= odf[i + 1];
    const gapOk = i - lastOnsetFrame >= minGapFrames;

    if (odf[i] > threshold && isLocalPeak && gapOk) {
      onsets.push((i * HOP_SIZE) / sr);
      lastOnsetFrame = i;
    }
  }

  // Fallback to fixed time slices when not enough onsets detected
  if (onsets.length < 3) {
    return [1, 2, 4, 7, 11, 16].filter((t) => t < buffer.duration);
  }

  return onsets.slice(0, MAX_ONSETS);
}
