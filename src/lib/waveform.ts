const MAX_DECODE_BYTES = 300 * 1024 * 1024;

/**
 * Reduce decoded audio channels to per-bucket peak amplitudes in [0, 1],
 * normalized so the loudest bucket reaches 1 (keeps quiet recordings
 * visible on the rail).
 */
export function bucketPeaks(
  channels: Float32Array[],
  buckets: number
): number[] {
  if (channels.length === 0 || buckets <= 0) {
    return [];
  }

  const sampleCount = channels[0].length;
  if (sampleCount === 0) {
    return [];
  }

  const bucketSize = Math.max(1, Math.floor(sampleCount / buckets));
  const peaks: number[] = [];

  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const start = bucket * bucketSize;
    if (start >= sampleCount) {
      peaks.push(0);
      continue;
    }

    const end = Math.min(sampleCount, start + bucketSize);
    let peak = 0;
    for (const channel of channels) {
      for (let i = start; i < end; i += 1) {
        const value = Math.abs(channel[i]);
        if (value > peak) {
          peak = value;
        }
      }
    }
    peaks.push(peak);
  }

  const loudest = Math.max(...peaks);
  if (loudest <= 0) {
    return peaks;
  }

  return peaks.map((peak) => peak / loudest);
}

/**
 * Decode the audio track of a media file and return normalized waveform
 * peaks, or null when decoding isn't possible (no Web Audio support,
 * unsupported container, or a file too large to decode safely).
 */
export async function computeWaveformPeaks(
  source: Blob,
  buckets = 600
): Promise<number[] | null> {
  if (typeof AudioContext === "undefined" || source.size > MAX_DECODE_BYTES) {
    return null;
  }

  let context: AudioContext | null = null;
  try {
    const arrayBuffer = await source.arrayBuffer();
    context = new AudioContext();
    const audio = await context.decodeAudioData(arrayBuffer);
    const channels = Array.from({ length: audio.numberOfChannels }, (_, i) =>
      audio.getChannelData(i)
    );
    return bucketPeaks(channels, buckets);
  } catch {
    return null;
  } finally {
    void context?.close().catch(() => undefined);
  }
}
