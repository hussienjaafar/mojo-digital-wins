/**
 * Audio Extractor - Client-side audio extraction using FFmpeg.wasm
 *
 * Extracts audio tracks from video files directly in the browser,
 * reducing 200MB videos to ~10-20MB audio files suitable for transcription.
 *
 * Features:
 * - Lazy-loads FFmpeg.wasm (~30MB) on first use, cached by browser
 * - Chunked file reading with progress reporting
 * - Copy-first extraction: tries stream copy before re-encoding
 * - Timeout protection to prevent infinite hangs
 * - Diagnostics report for debugging slow extractions
 * - Progress reporting with stage visibility
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

// =============================================================================
// Types
// =============================================================================

export type ExtractionStage = 
  | 'loading' 
  | 'reading'
  | 'writing'
  | 'copy-attempt' 
  | 'reencode' 
  | 'finalizing';

export interface AudioExtractionProgress {
  stage: ExtractionStage;
  percent: number;
  message: string;
  elapsedMs?: number;
}

export interface ExtractionTimings {
  wasmLoadMs: number;
  readFileMs: number;
  writeFileMs: number;
  copyAttemptMs: number;
  reencodeMs: number;
  readOutputMs: number;
  totalMs: number;
}

export interface DiagnosticsReport {
  browser: {
    userAgent: string;
    hardwareConcurrency: number;
    crossOriginIsolated: boolean;
    sharedArrayBufferAvailable: boolean;
  };
  file: {
    name: string;
    size: number;
    type: string;
  };
  extraction: {
    mode: 'copy' | 'reencode';
    detectedCodec: string;
    outputFormat: string;
    copyAttempted: boolean;
    copySucceeded: boolean;
  };
  timings: ExtractionTimings;
  ffmpegLogs: string[];
}

export interface AudioExtractionResult {
  audioBlob: Blob;
  audioFile: File;
  originalFilename: string;
  audioDurationSec?: number;
  extractionMode: 'copy' | 'reencode';
  timings: ExtractionTimings;
  diagnostics?: DiagnosticsReport;
}

export interface AudioExtractorOptions {
  onProgress?: (progress: AudioExtractionProgress) => void;
  enableDiagnostics?: boolean;
  timeoutMs?: number;
}

// =============================================================================
// Constants
// =============================================================================

// 3 minute timeout for extraction (reasonable for most files)
const DEFAULT_EXTRACTION_TIMEOUT_MS = 3 * 60 * 1000;

// 10MB chunks for reading files
const FILE_CHUNK_SIZE = 10 * 1024 * 1024;

// =============================================================================
// Singleton FFmpeg Instance
// =============================================================================

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

// Log ring buffer for diagnostics (last 200 lines)
const LOG_BUFFER_SIZE = 200;
let logRingBuffer: string[] = [];
let collectLogs = false;

function addToLogBuffer(message: string) {
  if (!collectLogs) return;
  logRingBuffer.push(message);
  if (logRingBuffer.length > LOG_BUFFER_SIZE) {
    logRingBuffer.shift();
  }
}

function clearLogBuffer() {
  logRingBuffer = [];
}

function getLogBuffer(): string[] {
  return [...logRingBuffer];
}

/**
 * Get or initialize the FFmpeg instance (singleton pattern)
 */
async function getFFmpeg(onProgress?: (progress: AudioExtractionProgress) => void): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) {
    return ffmpegInstance;
  }

  if (ffmpegLoadPromise) {
    return ffmpegLoadPromise;
  }

  ffmpegLoadPromise = (async () => {
    console.log('[AudioExtractor] Loading FFmpeg.wasm...');
    const loadStart = performance.now();
    
    onProgress?.({
      stage: 'loading',
      percent: 0,
      message: 'Loading audio processor...',
    });

    const ffmpeg = new FFmpeg();

    // Only log to buffer, not console (reduces overhead)
    ffmpeg.on('log', ({ message }) => {
      addToLogBuffer(message);
    });

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      const loadTime = performance.now() - loadStart;
      console.log(`[AudioExtractor] FFmpeg.wasm loaded in ${loadTime.toFixed(0)}ms`);
      
      onProgress?.({
        stage: 'loading',
        percent: 100,
        message: 'Audio processor ready',
      });

      ffmpegInstance = ffmpeg;
      return ffmpeg;
    } catch (error) {
      console.error('[AudioExtractor] Failed to load FFmpeg.wasm:', error);
      ffmpegLoadPromise = null;
      throw new Error('Failed to load audio processor. Please try again or use a smaller file.');
    }
  })();

  return ffmpegLoadPromise;
}

/**
 * Preload FFmpeg.wasm during idle time
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
// Chunked File Reading
// =============================================================================

/**
 * Read a file in chunks with progress reporting
 * This prevents memory pressure and shows real progress during file preparation
 */
async function readFileWithProgress(
  file: File,
  onProgress: (percent: number, message: string) => void
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const totalSize = file.size;
  
  console.log(`[AudioExtractor] Reading file in chunks: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
  
  while (offset < totalSize) {
    const chunkEnd = Math.min(offset + FILE_CHUNK_SIZE, totalSize);
    const chunk = file.slice(offset, chunkEnd);
    
    const buffer = await chunk.arrayBuffer();
    chunks.push(new Uint8Array(buffer));
    
    offset = chunkEnd;
    const percent = Math.round((offset / totalSize) * 100);
    onProgress(percent, `Reading file: ${percent}%`);
  }
  
  // Combine chunks into single Uint8Array
  const combined = new Uint8Array(totalSize);
  let position = 0;
  for (const chunk of chunks) {
    combined.set(chunk, position);
    position += chunk.length;
  }
  
  console.log(`[AudioExtractor] File read complete: ${chunks.length} chunks`);
  return combined;
}

// =============================================================================
// Audio Extraction
// =============================================================================

/**
 * Extract audio from a video file using FFmpeg.wasm
 *
 * Uses chunked file reading with progress and copy-first extraction strategy.
 */
export async function extractAudio(
  videoFile: File,
  options: AudioExtractorOptions = {}
): Promise<AudioExtractionResult> {
  const { 
    onProgress, 
    enableDiagnostics = false,
    timeoutMs = DEFAULT_EXTRACTION_TIMEOUT_MS,
  } = options;
  
  const originalFilename = videoFile.name;
  const startTime = performance.now();
  
  // Enable log collection for diagnostics
  collectLogs = enableDiagnostics;
  clearLogBuffer();
  
  const timings: ExtractionTimings = {
    wasmLoadMs: 0,
    readFileMs: 0,
    writeFileMs: 0,
    copyAttemptMs: 0,
    reencodeMs: 0,
    readOutputMs: 0,
    totalMs: 0,
  };

  // Diagnostics tracking
  let detectedCodec = 'unknown';
  let copyAttempted = false;
  let copySucceeded = false;

  console.log(`[AudioExtractor] Starting extraction for: ${originalFilename} (${(videoFile.size / 1024 / 1024).toFixed(2)} MB)`);

  // Create abort controller for timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  try {
    // Load FFmpeg
    const wasmStart = performance.now();
    const ffmpeg = await getFFmpeg(onProgress);
    timings.wasmLoadMs = performance.now() - wasmStart;

    // Check if aborted
    if (abortController.signal.aborted) {
      throw new Error('EXTRACTION_TIMEOUT');
    }

    // Read file in chunks with progress
    onProgress?.({
      stage: 'reading',
      percent: 0,
      message: 'Reading video file...',
      elapsedMs: performance.now() - startTime,
    });

    const readStart = performance.now();
    const fileData = await readFileWithProgress(videoFile, (percent, message) => {
      // Map reading progress to 0-20% of total
      const mappedPercent = Math.round(percent * 0.2);
      onProgress?.({
        stage: 'reading',
        percent: mappedPercent,
        message,
        elapsedMs: performance.now() - startTime,
      });
    });
    timings.readFileMs = performance.now() - readStart;

    // Check if aborted
    if (abortController.signal.aborted) {
      throw new Error('EXTRACTION_TIMEOUT');
    }

    // Write file to FFmpeg virtual filesystem
    onProgress?.({
      stage: 'writing',
      percent: 20,
      message: 'Preparing for extraction...',
      elapsedMs: performance.now() - startTime,
    });

    const inputFileName = 'input_video' + getExtension(videoFile.name);
    
    const writeStart = performance.now();
    await ffmpeg.writeFile(inputFileName, fileData);
    timings.writeFileMs = performance.now() - writeStart;
    
    console.log(`[AudioExtractor] File written to virtual FS in ${timings.writeFileMs.toFixed(0)}ms`);

    // Check if aborted
    if (abortController.signal.aborted) {
      throw new Error('EXTRACTION_TIMEOUT');
    }

    // =========================================================================
    // COPY-FIRST STRATEGY: Try stream copy, fall back to re-encode
    // =========================================================================
    
    const outputM4A = 'output_audio.m4a';
    const outputMP3 = 'output_audio.mp3';
    
    // Attempt 1: Try copy mode directly (fastest path)
    onProgress?.({
      stage: 'copy-attempt',
      percent: 25,
      message: 'Trying fast stream copy...',
      elapsedMs: performance.now() - startTime,
    });

    copyAttempted = true;
    const copyStart = performance.now();
    
    try {
      // Use explicit stream mapping for reliability
      await ffmpeg.exec([
        '-i', inputFileName,
        '-map', '0:a:0',      // Select first audio stream
        '-vn',                 // No video
        '-sn',                 // No subtitles
        '-c:a', 'copy',       // Copy audio codec
        '-y',                  // Overwrite
        outputM4A,
      ]);
      
      timings.copyAttemptMs = performance.now() - copyStart;
      
      // Verify output exists and has content
      const outputData = await ffmpeg.readFile(outputM4A);
      if (outputData && (typeof outputData !== 'string' ? outputData.length > 1000 : outputData.length > 1000)) {
        copySucceeded = true;
        detectedCodec = 'aac (copy)';
        console.log(`[AudioExtractor] Copy mode succeeded in ${timings.copyAttemptMs.toFixed(0)}ms`);
        
        timings.readOutputMs = 0; // Already read
        
        // Cleanup input file
        try {
          await ffmpeg.deleteFile(inputFileName);
        } catch (e) {
          console.warn('[AudioExtractor] Cleanup warning:', e);
        }
        
        // Build result
        const audioBlob = createBlob(outputData, 'audio/mp4');
        const audioFilename = originalFilename.replace(/\.[^.]+$/, '.m4a');
        const audioFile = new File([audioBlob], audioFilename, { type: 'audio/mp4' });
        
        // Cleanup output
        await ffmpeg.deleteFile(outputM4A);
        
        timings.totalMs = performance.now() - startTime;
        
        onProgress?.({
          stage: 'finalizing',
          percent: 100,
          message: 'Audio extraction complete (copy mode)',
          elapsedMs: timings.totalMs,
        });
        
        const result: AudioExtractionResult = {
          audioBlob,
          audioFile,
          originalFilename,
          extractionMode: 'copy',
          timings,
        };
        
        if (enableDiagnostics) {
          result.diagnostics = buildDiagnostics(videoFile, timings, {
            mode: 'copy',
            detectedCodec,
            copyAttempted,
            copySucceeded,
          });
        }
        
        logExtractionSummary(result);
        clearTimeout(timeoutId);
        return result;
      }
    } catch (copyError) {
      console.log('[AudioExtractor] Copy mode failed, trying re-encode:', copyError);
      addToLogBuffer(`Copy attempt failed: ${copyError}`);
    }
    
    timings.copyAttemptMs = performance.now() - copyStart;

    // Check if aborted
    if (abortController.signal.aborted) {
      throw new Error('EXTRACTION_TIMEOUT');
    }
    
    // Attempt 2: Re-encode with optimized settings for speech
    onProgress?.({
      stage: 'reencode',
      percent: 30,
      message: 'Converting audio (this may take a moment)...',
      elapsedMs: performance.now() - startTime,
    });

    const reencodeStart = performance.now();
    
    // Set up progress tracking
    let lastPercent = 30;
    const progressHandler = ({ progress }: { progress: number }) => {
      const percent = Math.min(95, 30 + Math.round(progress * 65));
      if (percent > lastPercent) {
        lastPercent = percent;
        onProgress?.({
          stage: 'reencode',
          percent,
          message: `Converting audio... ${percent}%`,
          elapsedMs: performance.now() - startTime,
        });
      }
    };
    ffmpeg.on('progress', progressHandler);

    // Try AAC first (often faster than MP3 in WASM)
    let reencodeSucceeded = false;
    let finalOutput = outputMP3;
    let outputMimeType = 'audio/mpeg';
    
    try {
      await ffmpeg.exec([
        '-i', inputFileName,
        '-vn',                     // No video
        '-c:a', 'aac',             // AAC encoder
        '-b:a', '64k',             // 64kbps (sufficient for speech)
        '-ar', '16000',            // 16kHz (Whisper's native rate)
        '-ac', '1',                // Mono
        '-y',
        outputM4A,
      ]);
      
      finalOutput = outputM4A;
      outputMimeType = 'audio/mp4';
      reencodeSucceeded = true;
      detectedCodec = 'reencode-aac';
    } catch (aacError) {
      console.log('[AudioExtractor] AAC encode failed, trying MP3:', aacError);
      addToLogBuffer(`AAC encode failed: ${aacError}`);
      
      // Fallback to MP3
      try {
        await ffmpeg.exec([
          '-i', inputFileName,
          '-vn',
          '-c:a', 'libmp3lame',
          '-b:a', '64k',
          '-ar', '16000',
          '-ac', '1',
          '-y',
          outputMP3,
        ]);
        
        finalOutput = outputMP3;
        outputMimeType = 'audio/mpeg';
        reencodeSucceeded = true;
        detectedCodec = 'reencode-mp3';
      } catch (mp3Error) {
        console.error('[AudioExtractor] All encoding attempts failed:', mp3Error);
        addToLogBuffer(`MP3 encode failed: ${mp3Error}`);
        throw new Error('Failed to extract audio: all encoding methods failed');
      }
    }
    
    ffmpeg.off('progress', progressHandler);
    timings.reencodeMs = performance.now() - reencodeStart;

    // Read output
    onProgress?.({
      stage: 'finalizing',
      percent: 95,
      message: 'Finalizing audio file...',
      elapsedMs: performance.now() - startTime,
    });

    const readOutputStart = performance.now();
    const audioData = await ffmpeg.readFile(finalOutput);
    timings.readOutputMs = performance.now() - readOutputStart;

    // Cleanup files
    try {
      await ffmpeg.deleteFile(inputFileName);
      await ffmpeg.deleteFile(finalOutput);
    } catch (e) {
      console.warn('[AudioExtractor] Cleanup warning:', e);
    }

    // Build result
    const audioBlob = createBlob(audioData, outputMimeType);
    const audioFilename = originalFilename.replace(/\.[^.]+$/, finalOutput === outputM4A ? '.m4a' : '.mp3');
    const audioFile = new File([audioBlob], audioFilename, { type: outputMimeType });

    timings.totalMs = performance.now() - startTime;

    onProgress?.({
      stage: 'finalizing',
      percent: 100,
      message: 'Audio extraction complete',
      elapsedMs: timings.totalMs,
    });

    const result: AudioExtractionResult = {
      audioBlob,
      audioFile,
      originalFilename,
      extractionMode: 'reencode',
      timings,
    };

    if (enableDiagnostics) {
      result.diagnostics = buildDiagnostics(videoFile, timings, {
        mode: 'reencode',
        detectedCodec,
        copyAttempted,
        copySucceeded,
      });
    }

    logExtractionSummary(result);
    clearTimeout(timeoutId);
    return result;

  } catch (error: any) {
    clearTimeout(timeoutId);
    collectLogs = false;
    
    // Handle timeout specifically
    if (error.message === 'EXTRACTION_TIMEOUT' || abortController.signal.aborted) {
      throw new Error('EXTRACTION_TIMEOUT: Audio extraction took too long. Try a smaller file or skip extraction.');
    }
    
    // Handle memory errors
    if (error.message?.includes('memory') || error.message?.includes('OOM')) {
      throw new Error('EXTRACTION_MEMORY: File too large for browser memory. Try a smaller file.');
    }
    
    throw error;
  } finally {
    collectLogs = false;
  }
}

// =============================================================================
// Utilities
// =============================================================================

function createBlob(data: Uint8Array | string, mimeType: string): Blob {
  if (typeof data === 'string') {
    return new Blob([new TextEncoder().encode(data)], { type: mimeType });
  }
  const buffer = new ArrayBuffer(data.length);
  const view = new Uint8Array(buffer);
  view.set(data);
  return new Blob([buffer], { type: mimeType });
}

function getExtension(filename: string): string {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0] : '.mp4';
}

function logExtractionSummary(result: AudioExtractionResult) {
  console.log(`[AudioExtractor] Extraction complete:`, {
    file: result.audioFile.name,
    size: `${(result.audioFile.size / 1024 / 1024).toFixed(2)}MB`,
    mode: result.extractionMode,
    timings: {
      wasmLoad: `${result.timings.wasmLoadMs.toFixed(0)}ms`,
      readFile: `${result.timings.readFileMs.toFixed(0)}ms`,
      writeFile: `${result.timings.writeFileMs.toFixed(0)}ms`,
      copyAttempt: `${result.timings.copyAttemptMs.toFixed(0)}ms`,
      reencode: `${result.timings.reencodeMs.toFixed(0)}ms`,
      readOutput: `${result.timings.readOutputMs.toFixed(0)}ms`,
      total: `${result.timings.totalMs.toFixed(0)}ms`,
    },
  });
}

function buildDiagnostics(
  file: File,
  timings: ExtractionTimings,
  extraction: {
    mode: 'copy' | 'reencode';
    detectedCodec: string;
    copyAttempted: boolean;
    copySucceeded: boolean;
  }
): DiagnosticsReport {
  return {
    browser: {
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      crossOriginIsolated: typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false,
      sharedArrayBufferAvailable: typeof SharedArrayBuffer !== 'undefined',
    },
    file: {
      name: file.name,
      size: file.size,
      type: file.type,
    },
    extraction: {
      mode: extraction.mode,
      detectedCodec: extraction.detectedCodec,
      outputFormat: extraction.mode === 'copy' ? 'm4a' : 'mp3/m4a',
      copyAttempted: extraction.copyAttempted,
      copySucceeded: extraction.copySucceeded,
    },
    timings,
    ffmpegLogs: getLogBuffer(),
  };
}

/**
 * Check if a file should have its audio extracted before upload
 */
export function shouldExtractAudio(file: File): boolean {
  const EXTRACTION_THRESHOLD_BYTES = 25 * 1024 * 1024; // 25MB
  return file.size > EXTRACTION_THRESHOLD_BYTES;
}

/**
 * Check if the browser supports FFmpeg.wasm
 */
export function isFFmpegSupported(): boolean {
  try {
    if (typeof WebAssembly === 'undefined') {
      console.warn('[AudioExtractor] WebAssembly not supported');
      return false;
    }

    if (typeof SharedArrayBuffer === 'undefined') {
      console.info('[AudioExtractor] SharedArrayBuffer not available, will use single-threaded mode');
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Format diagnostics report as copyable text
 */
export function formatDiagnosticsReport(report: DiagnosticsReport): string {
  const lines = [
    '=== Audio Extraction Diagnostics ===',
    '',
    '## Browser',
    `User Agent: ${report.browser.userAgent}`,
    `CPU Cores: ${report.browser.hardwareConcurrency}`,
    `Cross-Origin Isolated: ${report.browser.crossOriginIsolated}`,
    `SharedArrayBuffer: ${report.browser.sharedArrayBufferAvailable}`,
    '',
    '## File',
    `Name: ${report.file.name}`,
    `Size: ${(report.file.size / 1024 / 1024).toFixed(2)} MB`,
    `Type: ${report.file.type}`,
    '',
    '## Extraction',
    `Mode: ${report.extraction.mode}`,
    `Detected Codec: ${report.extraction.detectedCodec}`,
    `Output Format: ${report.extraction.outputFormat}`,
    `Copy Attempted: ${report.extraction.copyAttempted}`,
    `Copy Succeeded: ${report.extraction.copySucceeded}`,
    '',
    '## Timings',
    `WASM Load: ${report.timings.wasmLoadMs.toFixed(0)}ms`,
    `Read File: ${report.timings.readFileMs.toFixed(0)}ms`,
    `Write File: ${report.timings.writeFileMs.toFixed(0)}ms`,
    `Copy Attempt: ${report.timings.copyAttemptMs.toFixed(0)}ms`,
    `Re-encode: ${report.timings.reencodeMs.toFixed(0)}ms`,
    `Read Output: ${report.timings.readOutputMs.toFixed(0)}ms`,
    `Total: ${report.timings.totalMs.toFixed(0)}ms`,
    '',
  ];

  if (report.ffmpegLogs.length > 0) {
    lines.push('## FFmpeg Logs (last 50 lines)');
    lines.push(...report.ffmpegLogs.slice(-50));
  }

  return lines.join('\n');
}
