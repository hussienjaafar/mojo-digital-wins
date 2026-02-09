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
 * - Subscriber model for progress updates (supports preload)
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';

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

// 180 second (3 min) timeout for FFmpeg loading - ~30MB wasm download on slow networks
const FFMPEG_LOAD_TIMEOUT_MS = 180 * 1000;

// 90 second timeout per CDN attempt (gives each CDN a fair chance)
const PER_CDN_TIMEOUT_MS = 90 * 1000;

// 10MB chunks for reading files
const FILE_CHUNK_SIZE = 10 * 1024 * 1024;

// CDN sources for FFmpeg core files (fallback order)
// IMPORTANT: Only CDNs that host BOTH ffmpeg-core.js AND ffmpeg-core.wasm
// cdnjs does NOT host the .wasm file, so it's excluded
// Using v0.12.10 for compatibility with @ffmpeg/ffmpeg v0.12.15
const CDN_SOURCES = [
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
  'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm',
];

// =============================================================================
// Singleton FFmpeg Instance
// =============================================================================

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

// Subscriber model for progress updates (allows late-joining)
type ProgressCallback = (progress: AudioExtractionProgress) => void;
const loadProgressSubscribers = new Set<ProgressCallback>();

function notifyLoadProgress(progress: AudioExtractionProgress) {
  for (const callback of loadProgressSubscribers) {
    try {
      callback(progress);
    } catch (e) {
      console.warn('[AudioExtractor] Progress callback error:', e);
    }
  }
}

function clearLoadProgressSubscribers() {
  loadProgressSubscribers.clear();
}

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
 * Fetch a file with progress tracking
 */
async function fetchWithProgress(
  url: string,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');
  
  const chunks: BlobPart[] = [];
  let loaded = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value.slice().buffer);
    loaded += value.length;
    onProgress(loaded, total);
  }
  
  return new Blob(chunks);
}

/**
 * Create a blob URL from fetched content with progress
 */
async function fetchToBlobURL(
  url: string,
  mimeType: string,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<string> {
  const blob = await fetchWithProgress(url, onProgress, signal);
  const typedBlob = new Blob([blob], { type: mimeType });
  return URL.createObjectURL(typedBlob);
}

/**
 * Try to load FFmpeg from a CDN with progress tracking
 * Single-threaded FFmpeg.wasm only needs: ffmpeg-core.js and ffmpeg-core.wasm
 * (No worker file needed - that's only for @ffmpeg/core-mt multi-threaded version)
 */
async function loadFFmpegFromCDN(
  ffmpeg: FFmpeg,
  baseURL: string,
  onProgress: (progress: AudioExtractionProgress) => void,
  signal: AbortSignal
): Promise<void> {
  let coreLoaded = 0;
  let coreTotal = 0;
  let wasmLoaded = 0;
  let wasmTotal = 0;

  const updateProgress = () => {
    const totalSize = coreTotal + wasmTotal;
    const loadedSize = coreLoaded + wasmLoaded;
    if (totalSize > 0) {
      const percent = Math.round((loadedSize / totalSize) * 90); // 0-90% for downloads
      const loadedMB = (loadedSize / 1024 / 1024).toFixed(1);
      const totalMB = (totalSize / 1024 / 1024).toFixed(1);
      const progress: AudioExtractionProgress = {
        stage: 'loading',
        percent,
        message: `Downloading audio processor (${loadedMB}MB / ${totalMB}MB)...`,
      };
      onProgress(progress);
      notifyLoadProgress(progress);
    }
  };

  // Fetch only the TWO required files (no worker needed for single-threaded mode)
  const [coreURL, wasmURL] = await Promise.all([
    fetchToBlobURL(
      `${baseURL}/ffmpeg-core.js`,
      'text/javascript',
      (loaded, total) => {
        coreLoaded = loaded;
        coreTotal = total || 1024 * 100; // Estimate ~100KB for JS
        updateProgress();
      },
      signal
    ),
    fetchToBlobURL(
      `${baseURL}/ffmpeg-core.wasm`,
      'application/wasm',
      (loaded, total) => {
        wasmLoaded = loaded;
        wasmTotal = total || 1024 * 1024 * 30; // Estimate ~30MB for WASM
        updateProgress();
      },
      signal
    ),
  ]);

  // Report initialization phase
  const initProgress: AudioExtractionProgress = {
    stage: 'loading',
    percent: 95,
    message: 'Initializing audio processor...',
  };
  onProgress(initProgress);
  notifyLoadProgress(initProgress);

  // Load FFmpeg with only coreURL and wasmURL (single-threaded mode)
  await ffmpeg.load({ coreURL, wasmURL });
}

/**
 * Get or initialize the FFmpeg instance (singleton pattern)
 * Supports late-joining progress callbacks via subscriber model
 * Each CDN attempt gets its own timeout and abort controller
 */
async function getFFmpeg(onProgress?: (progress: AudioExtractionProgress) => void): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) {
    return ffmpegInstance;
  }

  // Register progress callback if provided (supports late-joining)
  if (onProgress) {
    loadProgressSubscribers.add(onProgress);
  }

  // If already loading, return existing promise (late-joiner will get progress)
  if (ffmpegLoadPromise) {
    return ffmpegLoadPromise;
  }

  ffmpegLoadPromise = (async () => {
    console.log('[AudioExtractor] Loading FFmpeg.wasm...');
    const loadStart = performance.now();
    
    const initialProgress: AudioExtractionProgress = {
      stage: 'loading',
      percent: 0,
      message: 'Starting audio processor download...',
    };
    notifyLoadProgress(initialProgress);

    const ffmpeg = new FFmpeg();

    // Only log to buffer, not console (reduces overhead)
    ffmpeg.on('log', ({ message }) => {
      addToLogBuffer(message);
    });

    // Global timeout for all CDN attempts combined
    const globalTimeoutId = setTimeout(() => {
      console.error('[AudioExtractor] Global timeout reached after all CDN attempts');
    }, FFMPEG_LOAD_TIMEOUT_MS);

    // Track errors from each CDN for better error reporting
    const errors: { cdn: string; error: string; isTimeout: boolean; is404: boolean }[] = [];

    // Try each CDN source with its own abort controller
    for (let i = 0; i < CDN_SOURCES.length; i++) {
      const baseURL = CDN_SOURCES[i];
      const cdnName = baseURL.includes('jsdelivr') ? 'jsDelivr' : 
                      baseURL.includes('unpkg') ? 'unpkg' : `CDN ${i + 1}`;
      
      console.log(`[AudioExtractor] Trying ${cdnName} (${i + 1}/${CDN_SOURCES.length}): ${baseURL}`);
      
      // Create per-CDN abort controller and timeout
      const attemptAbortController = new AbortController();
      const attemptTimeoutId = setTimeout(() => {
        attemptAbortController.abort();
        console.warn(`[AudioExtractor] ${cdnName} attempt timed out after ${PER_CDN_TIMEOUT_MS / 1000}s`);
      }, PER_CDN_TIMEOUT_MS);
      
      try {
        // Notify which CDN we're trying
        const tryingProgress: AudioExtractionProgress = {
          stage: 'loading',
          percent: 2,
          message: `Connecting to ${cdnName}...`,
        };
        notifyLoadProgress(tryingProgress);
        
        await loadFFmpegFromCDN(ffmpeg, baseURL, (p) => notifyLoadProgress(p), attemptAbortController.signal);
        
        // Success! Clear all timeouts
        clearTimeout(attemptTimeoutId);
        clearTimeout(globalTimeoutId);
        
        const loadTime = performance.now() - loadStart;
        console.log(`[AudioExtractor] FFmpeg.wasm loaded in ${loadTime.toFixed(0)}ms from ${cdnName}`);
        
        const readyProgress: AudioExtractionProgress = {
          stage: 'loading',
          percent: 100,
          message: 'Audio processor ready',
        };
        notifyLoadProgress(readyProgress);

        ffmpegInstance = ffmpeg;
        clearLoadProgressSubscribers();
        return ffmpeg;
        
      } catch (error) {
        clearTimeout(attemptTimeoutId);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isTimeout = attemptAbortController.signal.aborted || errorMessage.includes('aborted');
        const is404 = errorMessage.includes('404') || errorMessage.includes('Not Found');
        
        errors.push({ 
          cdn: cdnName, 
          error: errorMessage,
          isTimeout,
          is404
        });
        
        // Log and notify about the failure
        if (is404) {
          console.warn(`[AudioExtractor] ${cdnName} missing required file (404), trying next...`);
          notifyLoadProgress({
            stage: 'loading',
            percent: 3,
            message: `${cdnName} unavailable, switching to backup...`,
          });
        } else if (isTimeout) {
          console.warn(`[AudioExtractor] ${cdnName} timed out, trying next...`);
          notifyLoadProgress({
            stage: 'loading',
            percent: 3,
            message: `${cdnName} slow, trying backup...`,
          });
        } else {
          console.warn(`[AudioExtractor] ${cdnName} failed: ${errorMessage}`);
          notifyLoadProgress({
            stage: 'loading',
            percent: 3,
            message: `${cdnName} error, trying backup...`,
          });
        }
        
        // Continue to next CDN
      }
    }

    // All CDNs failed - determine the best error message
    clearTimeout(globalTimeoutId);
    ffmpegLoadPromise = null;
    clearLoadProgressSubscribers();
    
    const allTimeouts = errors.length > 0 && errors.every(e => e.isTimeout);
    const all404s = errors.length > 0 && errors.every(e => e.is404);
    
    console.error('[AudioExtractor] All CDNs failed to load FFmpeg.wasm:', errors);
    
    if (allTimeouts) {
      throw new Error('FFMPEG_LOAD_TIMEOUT');
    } else if (all404s) {
      throw new Error('Audio processor files not found on any CDN. Please try again later.');
    } else {
      const lastErrorMsg = errors.length > 0 ? errors[errors.length - 1].error : 'Unknown error';
      throw new Error(`Failed to load audio processor: ${lastErrorMsg}`);
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
    // Reset promise so next attempt can retry
    ffmpegLoadPromise = null;
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
// Audio Extraction (with mutex to prevent parallel FFmpeg FS conflicts)
// =============================================================================

let extractionQueue: Promise<void> = Promise.resolve();

/**
 * Extract audio from a video file using FFmpeg.wasm
 *
 * Wraps the internal extraction with a mutex queue so that only one
 * extraction runs at a time (FFmpeg.wasm shares a single virtual filesystem).
 */
export async function extractAudio(
  videoFile: File,
  options: AudioExtractorOptions = {}
): Promise<AudioExtractionResult> {
  const result = await new Promise<AudioExtractionResult>((resolve, reject) => {
    extractionQueue = extractionQueue.then(async () => {
      try {
        const r = await extractAudioInternal(videoFile, options);
        resolve(r);
      } catch (e) {
        reject(e);
      }
    });
  });
  return result;
}

/**
 * Internal extraction implementation - must not be called directly.
 * Uses chunked file reading with progress and copy-first extraction strategy.
 */
async function extractAudioInternal(
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
    let extractionMode: 'copy' | 'reencode' = 'copy';
    let outputFileName = outputM4A;

    const copyStart = performance.now();
    try {
      // Try stream copy - works for AAC/MP3 audio in most MP4s
      await ffmpeg.exec([
        '-i', inputFileName,
        '-vn',              // No video
        '-acodec', 'copy',  // Stream copy audio
        '-y',               // Overwrite
        outputM4A,
      ]);

      // Check if output file exists and has content
      const copyOutput = await ffmpeg.readFile(outputM4A);
      if (copyOutput instanceof Uint8Array && copyOutput.length > 1000) {
        copySucceeded = true;
        timings.copyAttemptMs = performance.now() - copyStart;
        console.log(`[AudioExtractor] Stream copy succeeded in ${timings.copyAttemptMs.toFixed(0)}ms`);
      } else {
        throw new Error('Copy output too small or invalid');
      }
    } catch (copyError) {
      console.log('[AudioExtractor] Stream copy failed, falling back to re-encode:', copyError);
      timings.copyAttemptMs = performance.now() - copyStart;
      extractionMode = 'reencode';
      outputFileName = outputMP3;
      
      // Check if aborted
      if (abortController.signal.aborted) {
        throw new Error('EXTRACTION_TIMEOUT');
      }

      // Attempt 2: Re-encode to optimized speech format
      onProgress?.({
        stage: 'reencode',
        percent: 40,
        message: 'Converting audio (this may take a minute)...',
        elapsedMs: performance.now() - startTime,
      });

      const reencodeStart = performance.now();
      await ffmpeg.exec([
        '-i', inputFileName,
        '-vn',              // No video
        '-b:a', '64k',      // 64kbps bitrate (optimal for speech)
        '-ar', '16000',     // 16kHz sample rate (Whisper optimal)
        '-ac', '1',         // Mono
        '-y',               // Overwrite
        outputMP3,
      ]);
      timings.reencodeMs = performance.now() - reencodeStart;
      console.log(`[AudioExtractor] Re-encode completed in ${timings.reencodeMs.toFixed(0)}ms`);
    }

    // Check if aborted
    if (abortController.signal.aborted) {
      throw new Error('EXTRACTION_TIMEOUT');
    }

    // Read the output file
    onProgress?.({
      stage: 'finalizing',
      percent: 90,
      message: 'Finalizing audio file...',
      elapsedMs: performance.now() - startTime,
    });

    const readOutputStart = performance.now();
    const outputData = await ffmpeg.readFile(outputFileName);
    timings.readOutputMs = performance.now() - readOutputStart;

    if (!(outputData instanceof Uint8Array) || outputData.length < 1000) {
      throw new Error('Failed to extract audio: output file is empty or invalid');
    }

    // Clean up virtual filesystem
    try {
      await ffmpeg.deleteFile(inputFileName);
      if (copySucceeded && extractionMode === 'reencode') {
        await ffmpeg.deleteFile(outputM4A);
      }
      await ffmpeg.deleteFile(outputFileName);
    } catch (cleanupError) {
      console.warn('[AudioExtractor] Cleanup warning:', cleanupError);
    }

    // Create output blob and file
    const mimeType = extractionMode === 'copy' ? 'audio/mp4' : 'audio/mpeg';
    const fileExtension = extractionMode === 'copy' ? '.m4a' : '.mp3';
    const audioBlob = new Blob([outputData.buffer as ArrayBuffer], { type: mimeType });
    
    const baseName = originalFilename.replace(/\.[^.]+$/, '');
    const audioFilename = `${baseName}_audio${fileExtension}`;
    const audioFile = new File([audioBlob], audioFilename, { type: mimeType });

    timings.totalMs = performance.now() - startTime;
    clearTimeout(timeoutId);

    console.log(`[AudioExtractor] Extraction complete: ${(audioFile.size / 1024 / 1024).toFixed(2)}MB in ${(timings.totalMs / 1000).toFixed(1)}s (${extractionMode} mode)`);

    // Build diagnostics if enabled
    let diagnostics: DiagnosticsReport | undefined;
    if (enableDiagnostics) {
      diagnostics = {
        browser: {
          userAgent: navigator.userAgent,
          hardwareConcurrency: navigator.hardwareConcurrency || 0,
          crossOriginIsolated: self.crossOriginIsolated ?? false,
          sharedArrayBufferAvailable: typeof SharedArrayBuffer !== 'undefined',
        },
        file: {
          name: originalFilename,
          size: videoFile.size,
          type: videoFile.type,
        },
        extraction: {
          mode: extractionMode,
          detectedCodec,
          outputFormat: fileExtension.replace('.', ''),
          copyAttempted,
          copySucceeded,
        },
        timings,
        ffmpegLogs: getLogBuffer(),
      };
    }

    collectLogs = false;

    return {
      audioBlob,
      audioFile,
      originalFilename,
      extractionMode,
      timings,
      diagnostics,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    collectLogs = false;
    
    console.error('[AudioExtractor] Extraction failed:', error);
    
    // Provide specific error messages
    if (error instanceof Error) {
      if (error.message.includes('EXTRACTION_TIMEOUT') || abortController.signal.aborted) {
        throw new Error('EXTRACTION_TIMEOUT: Audio extraction timed out. The file may be too large or complex.');
      }
      if (error.message.includes('memory') || error.message.includes('Memory')) {
        throw new Error('EXTRACTION_MEMORY: Insufficient memory to process this file.');
      }
    }
    
    throw error;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get file extension from filename
 */
function getExtension(filename: string): string {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : '.mp4';
}

/**
 * Check if FFmpeg.wasm is supported in this browser
 */
export function isFFmpegSupported(): boolean {
  // FFmpeg.wasm requires:
  // 1. WebAssembly support
  // 2. SharedArrayBuffer (for threading) OR single-threaded mode
  // Modern browsers support WASM, but SAB requires COOP/COEP headers
  
  if (typeof WebAssembly === 'undefined') {
    console.warn('[AudioExtractor] WebAssembly not supported');
    return false;
  }

  // We use the non-threaded version which doesn't require SharedArrayBuffer
  return true;
}

/**
 * Check if a file should have audio extracted
 * (files over 25MB benefit from audio extraction for transcription)
 */
export function shouldExtractAudio(file: File): boolean {
  const EXTRACTION_THRESHOLD_BYTES = 25 * 1024 * 1024; // 25MB
  return file.size > EXTRACTION_THRESHOLD_BYTES;
}

/**
 * Format a diagnostics report for display/logging
 */
export function formatDiagnosticsReport(report: DiagnosticsReport): string {
  const lines: string[] = [
    '=== Audio Extraction Diagnostics ===',
    '',
    '-- Browser --',
    `User Agent: ${report.browser.userAgent}`,
    `CPU Cores: ${report.browser.hardwareConcurrency}`,
    `Cross-Origin Isolated: ${report.browser.crossOriginIsolated}`,
    `SharedArrayBuffer: ${report.browser.sharedArrayBufferAvailable}`,
    '',
    '-- File --',
    `Name: ${report.file.name}`,
    `Size: ${(report.file.size / 1024 / 1024).toFixed(2)} MB`,
    `Type: ${report.file.type}`,
    '',
    '-- Extraction --',
    `Mode: ${report.extraction.mode}`,
    `Detected Codec: ${report.extraction.detectedCodec}`,
    `Output Format: ${report.extraction.outputFormat}`,
    `Copy Attempted: ${report.extraction.copyAttempted}`,
    `Copy Succeeded: ${report.extraction.copySucceeded}`,
    '',
    '-- Timings --',
    `WASM Load: ${report.timings.wasmLoadMs.toFixed(0)}ms`,
    `Read File: ${report.timings.readFileMs.toFixed(0)}ms`,
    `Write File: ${report.timings.writeFileMs.toFixed(0)}ms`,
    `Copy Attempt: ${report.timings.copyAttemptMs.toFixed(0)}ms`,
    `Re-encode: ${report.timings.reencodeMs.toFixed(0)}ms`,
    `Read Output: ${report.timings.readOutputMs.toFixed(0)}ms`,
    `Total: ${report.timings.totalMs.toFixed(0)}ms (${(report.timings.totalMs / 1000).toFixed(1)}s)`,
    '',
  ];

  if (report.ffmpegLogs.length > 0) {
    lines.push('-- Last FFmpeg Logs --');
    // Show last 20 log lines
    const lastLogs = report.ffmpegLogs.slice(-20);
    lines.push(...lastLogs);
  }

  return lines.join('\n');
}
