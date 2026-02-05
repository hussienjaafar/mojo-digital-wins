/**
 * Audio Extractor - Client-side audio extraction using FFmpeg.wasm
 *
 * Extracts audio tracks from video files directly in the browser,
 * reducing 200MB videos to ~10-20MB audio files suitable for transcription.
 *
 * Features:
 * - Lazy-loads FFmpeg.wasm (~30MB) on first use, cached by browser
 * - Codec detection: uses copy mode for AAC/MP3 (instant) or re-encodes
 * - Progress reporting during extraction
 * - Outputs M4A (copy mode) or MP3 (re-encode) optimized for speech
 * - Handles errors gracefully with user-friendly messages
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// =============================================================================
// Types
// =============================================================================

export interface AudioExtractionProgress {
  stage: 'loading' | 'probing' | 'extracting' | 'finalizing';
  percent: number;
  message: string;
}

export interface AudioExtractionResult {
  audioBlob: Blob;
  audioFile: File;
  originalFilename: string;
  audioDurationSec?: number;
  extractionMode: 'copy' | 'reencode';
  timings: ExtractionTimings;
}

export interface AudioExtractorOptions {
  onProgress?: (progress: AudioExtractionProgress) => void;
}

export interface ExtractionTimings {
  wasmLoadMs: number;
  writeInputMs: number;
  probeMs: number;
  extractMs: number;
  readOutputMs: number;
  totalMs: number;
}

// Detected audio codec info
interface AudioCodecInfo {
  codec: string;
  canCopy: boolean;
  outputExtension: string;
  outputMimeType: string;
}

// =============================================================================
// Singleton FFmpeg Instance
// =============================================================================

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

/**
 * Get or initialize the FFmpeg instance (singleton pattern)
 * FFmpeg is loaded lazily on first use and cached for subsequent calls
 */
async function getFFmpeg(onProgress?: (progress: AudioExtractionProgress) => void): Promise<FFmpeg> {
  // Return existing instance if already loaded
  if (ffmpegInstance?.loaded) {
    return ffmpegInstance;
  }

  // If already loading, wait for that promise
  if (ffmpegLoadPromise) {
    return ffmpegLoadPromise;
  }

  // Start loading FFmpeg
  ffmpegLoadPromise = (async () => {
    console.log('[AudioExtractor] Loading FFmpeg.wasm...');
    console.time('[FFmpeg] WASM Load');
    onProgress?.({
      stage: 'loading',
      percent: 0,
      message: 'Loading audio processor...',
    });

    const ffmpeg = new FFmpeg();

    // Set up logging (useful for debugging)
    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    // Load FFmpeg from CDN (uses SharedArrayBuffer if available for better performance)
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      console.timeEnd('[FFmpeg] WASM Load');
      console.log('[AudioExtractor] FFmpeg.wasm loaded successfully');
      onProgress?.({
        stage: 'loading',
        percent: 100,
        message: 'Audio processor ready',
      });

      ffmpegInstance = ffmpeg;
      return ffmpeg;
    } catch (error) {
      console.error('[AudioExtractor] Failed to load FFmpeg.wasm:', error);
      ffmpegLoadPromise = null; // Reset so we can try again
      throw new Error('Failed to load audio processor. Please try again or use a smaller file.');
    }
  })();

  return ffmpegLoadPromise;
}

/**
 * Preload FFmpeg.wasm during idle time
 * Call this when user navigates to a page that might need audio extraction
 */
export async function preloadFFmpeg(): Promise<void> {
  try {
    console.log('[AudioExtractor] Preloading FFmpeg.wasm...');
    await getFFmpeg();
    console.log('[AudioExtractor] Preload complete');
  } catch (error) {
    console.warn('[AudioExtractor] Preload failed (will retry on use):', error);
  }
}

/**
 * Check if FFmpeg is already loaded
 */
export function isFFmpegLoaded(): boolean {
  return ffmpegInstance?.loaded ?? false;
}

// =============================================================================
// Codec Detection
// =============================================================================

/**
 * Probe video file to detect audio codec
 * Uses FFmpeg's output when running with just -i flag
 */
async function probeAudioCodec(
  ffmpeg: FFmpeg,
  inputFileName: string
): Promise<AudioCodecInfo> {
  console.time('[FFmpeg] Probe');
  
  // Collect FFmpeg log output during probe
  const logLines: string[] = [];
  const logHandler = ({ message }: { message: string }) => {
    logLines.push(message);
  };
  
  ffmpeg.on('log', logHandler);
  
  try {
    // Run FFmpeg with just -i to get file info (will "fail" but output codec info)
    await ffmpeg.exec(['-i', inputFileName]);
  } catch {
    // Expected to fail - we just want the output
  }
  
  // Remove our handler
  ffmpeg.off('log', logHandler);
  console.timeEnd('[FFmpeg] Probe');
  
  // Parse output for audio codec info
  // Looking for lines like: "Stream #0:1: Audio: aac (LC), 48000 Hz, stereo"
  const audioLine = logLines.find(line => 
    line.includes('Audio:') && line.includes('Stream')
  );
  
  console.log('[AudioExtractor] Probe result:', audioLine || 'No audio stream found');
  
  if (!audioLine) {
    return {
      codec: 'unknown',
      canCopy: false,
      outputExtension: '.mp3',
      outputMimeType: 'audio/mpeg',
    };
  }
  
  // Extract codec name
  const codecMatch = audioLine.match(/Audio:\s*(\w+)/i);
  const codec = codecMatch?.[1]?.toLowerCase() || 'unknown';
  
  // Determine if we can use copy mode
  // AAC and MP3 can be copied directly
  if (codec === 'aac') {
    return {
      codec: 'aac',
      canCopy: true,
      outputExtension: '.m4a',
      outputMimeType: 'audio/mp4',
    };
  }
  
  if (codec === 'mp3') {
    return {
      codec: 'mp3',
      canCopy: true,
      outputExtension: '.mp3',
      outputMimeType: 'audio/mpeg',
    };
  }
  
  // For other codecs, we need to re-encode
  return {
    codec,
    canCopy: false,
    outputExtension: '.mp3',
    outputMimeType: 'audio/mpeg',
  };
}

// =============================================================================
// Audio Extraction
// =============================================================================

/**
 * Extract audio from a video file using FFmpeg.wasm
 *
 * Uses copy mode for AAC/MP3 audio (instant) or optimized re-encoding for others.
 *
 * @param videoFile - The video file to extract audio from
 * @param options - Optional callbacks for progress reporting
 * @returns The extracted audio as a Blob and File
 */
export async function extractAudio(
  videoFile: File,
  options: AudioExtractorOptions = {}
): Promise<AudioExtractionResult> {
  const { onProgress } = options;
  const originalFilename = videoFile.name;
  const timings: ExtractionTimings = {
    wasmLoadMs: 0,
    writeInputMs: 0,
    probeMs: 0,
    extractMs: 0,
    readOutputMs: 0,
    totalMs: 0,
  };

  const totalStart = performance.now();
  console.log(`[AudioExtractor] Starting extraction for: ${originalFilename} (${(videoFile.size / 1024 / 1024).toFixed(2)} MB)`);

  // Get FFmpeg instance (will load if not already loaded)
  const wasmStart = performance.now();
  const ffmpeg = await getFFmpeg(onProgress);
  timings.wasmLoadMs = performance.now() - wasmStart;

  try {
    // Write the input video file to FFmpeg's virtual filesystem
    onProgress?.({
      stage: 'probing',
      percent: 0,
      message: 'Analyzing video file...',
    });

    const inputFileName = 'input_video' + getExtension(originalFilename);
    
    console.time('[FFmpeg] Write Input');
    const writeStart = performance.now();
    await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));
    timings.writeInputMs = performance.now() - writeStart;
    console.timeEnd('[FFmpeg] Write Input');

    console.log('[AudioExtractor] Video file written to virtual FS');

    // Probe to detect audio codec
    const probeStart = performance.now();
    const codecInfo = await probeAudioCodec(ffmpeg, inputFileName);
    timings.probeMs = performance.now() - probeStart;
    
    console.log(`[AudioExtractor] Detected codec: ${codecInfo.codec}, canCopy: ${codecInfo.canCopy}`);

    // Set up progress tracking for extraction
    let lastProgressPercent = 0;
    const progressHandler = ({ progress }: { progress: number }) => {
      const percent = Math.round(progress * 100);
      if (percent > lastProgressPercent) {
        lastProgressPercent = percent;
        onProgress?.({
          stage: 'extracting',
          percent,
          message: codecInfo.canCopy 
            ? `Extracting audio (copy mode)... ${percent}%`
            : `Converting audio... ${percent}%`,
        });
      }
    };
    ffmpeg.on('progress', progressHandler);

    const outputFileName = `output_audio${codecInfo.outputExtension}`;
    
    console.time('[FFmpeg] Extract');
    const extractStart = performance.now();

    if (codecInfo.canCopy) {
      // FAST PATH: Copy audio stream directly (no re-encoding)
      // This is nearly instant for AAC/MP3 audio
      console.log('[AudioExtractor] Using copy mode (fast)');
      await ffmpeg.exec([
        '-i', inputFileName,
        '-vn',              // No video
        '-acodec', 'copy',  // Copy audio stream directly
        outputFileName,
      ]);
    } else {
      // SLOW PATH: Re-encode with optimized settings for speech
      // Lower bitrate and sample rate for faster encoding
      console.log('[AudioExtractor] Using re-encode mode (optimized for speech)');
      await ffmpeg.exec([
        '-i', inputFileName,
        '-vn',                    // No video
        '-acodec', 'libmp3lame',  // MP3 encoder
        '-b:a', '64k',            // 64kbps CBR (faster than VBR, fine for speech)
        '-ar', '16000',           // 16kHz sample rate (Whisper's native rate)
        '-ac', '1',               // Mono
        outputFileName,
      ]);
    }
    
    timings.extractMs = performance.now() - extractStart;
    console.timeEnd('[FFmpeg] Extract');

    // Remove progress handler
    ffmpeg.off('progress', progressHandler);

    console.log('[AudioExtractor] Audio extraction complete');

    onProgress?.({
      stage: 'finalizing',
      percent: 90,
      message: 'Finalizing audio file...',
    });

    // Read the output audio file
    console.time('[FFmpeg] Read Output');
    const readStart = performance.now();
    const audioData = await ffmpeg.readFile(outputFileName);
    timings.readOutputMs = performance.now() - readStart;
    console.timeEnd('[FFmpeg] Read Output');

    // Clean up virtual filesystem
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);

    // Convert to Blob and File
    // Handle both Uint8Array and string returns from FFmpeg
    let audioBlob: Blob;
    if (typeof audioData === 'string') {
      audioBlob = new Blob([new TextEncoder().encode(audioData)], { type: codecInfo.outputMimeType });
    } else {
      // Create a new ArrayBuffer to ensure type compatibility
      const buffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(buffer);
      view.set(audioData);
      audioBlob = new Blob([buffer], { type: codecInfo.outputMimeType });
    }
    
    const audioFilename = originalFilename.replace(/\.[^.]+$/, codecInfo.outputExtension);
    const audioFile = new File([audioBlob], audioFilename, { type: codecInfo.outputMimeType });

    timings.totalMs = performance.now() - totalStart;

    console.log(`[AudioExtractor] Extracted audio: ${audioFilename} (${(audioBlob.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`[AudioExtractor] Timings:`, {
      wasmLoad: `${timings.wasmLoadMs.toFixed(0)}ms`,
      writeInput: `${timings.writeInputMs.toFixed(0)}ms`,
      probe: `${timings.probeMs.toFixed(0)}ms`,
      extract: `${timings.extractMs.toFixed(0)}ms`,
      readOutput: `${timings.readOutputMs.toFixed(0)}ms`,
      total: `${timings.totalMs.toFixed(0)}ms`,
    });

    onProgress?.({
      stage: 'finalizing',
      percent: 100,
      message: 'Audio extraction complete',
    });

    return {
      audioBlob,
      audioFile,
      originalFilename,
      extractionMode: codecInfo.canCopy ? 'copy' : 'reencode',
      timings,
    };
  } catch (error) {
    console.error('[AudioExtractor] Extraction failed:', error);
    throw new Error(
      `Failed to extract audio from video: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Check if a file should have its audio extracted before upload
 * Files larger than 25MB benefit from audio extraction
 */
export function shouldExtractAudio(file: File): boolean {
  const EXTRACTION_THRESHOLD_BYTES = 25 * 1024 * 1024; // 25MB
  return file.size > EXTRACTION_THRESHOLD_BYTES;
}

/**
 * Get file extension from filename
 */
function getExtension(filename: string): string {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0] : '.mp4';
}

/**
 * Check if the browser supports FFmpeg.wasm
 * Requires WebAssembly and SharedArrayBuffer (for multi-threading)
 */
export function isFFmpegSupported(): boolean {
  try {
    // Check for WebAssembly support
    if (typeof WebAssembly === 'undefined') {
      console.warn('[AudioExtractor] WebAssembly not supported');
      return false;
    }

    // Check for SharedArrayBuffer (required for multi-threading, but falls back to single-threaded)
    // FFmpeg.wasm works without SharedArrayBuffer, just slower
    if (typeof SharedArrayBuffer === 'undefined') {
      console.info('[AudioExtractor] SharedArrayBuffer not available, will use single-threaded mode');
    }

    return true;
  } catch {
    return false;
  }
}
