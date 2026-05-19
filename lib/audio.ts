import { detectOnsets } from './onsets';

let ctx: AudioContext | null = null;
let currentSrc: AudioBufferSourceNode | null = null;
let scheduledStop: ReturnType<typeof setTimeout> | null = null;

function getContext(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext();
  }
  return ctx;
}

export async function loadPreview(url: string): Promise<{ buffer: AudioBuffer; onsets: number[] }> {
  const audioCtx = getContext();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch preview: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = await audioCtx.decodeAudioData(arrayBuffer);
  const onsets = detectOnsets(buffer);
  return { buffer, onsets };
}

export function stopCurrent() {
  if (scheduledStop !== null) {
    clearTimeout(scheduledStop);
    scheduledStop = null;
  }
  if (currentSrc) {
    try { currentSrc.stop(); } catch { /* already stopped */ }
    currentSrc = null;
  }
}

export function playFull(buffer: AudioBuffer, onEnded?: () => void): void {
  playUpToNote(buffer, [], -1, onEnded);
}

export function playUpToNote(
  buffer: AudioBuffer,
  onsets: number[],
  noteIndex: number,
  onEnded?: () => void
): void {
  stopCurrent();

  const audioCtx = getContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const endTime = noteIndex < onsets.length ? onsets[noteIndex] : buffer.duration;

  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(audioCtx.destination);
  src.start(0, 0, endTime);
  currentSrc = src;

  // Use onended event for reliable callback
  src.onended = () => {
    currentSrc = null;
    onEnded?.();
  };

  // Safety timeout slightly after expected end
  scheduledStop = setTimeout(() => {
    stopCurrent();
    onEnded?.();
  }, (endTime + 0.5) * 1000);
}
