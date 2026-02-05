 /**
  * Audio Extractor - Client-side audio extraction using FFmpeg.wasm
  *
  * Extracts audio tracks from video files directly in the browser,
  * reducing 200MB videos to ~10-20MB audio files suitable for transcription.
  *
  * Features:
  * - Lazy-loads FFmpeg.wasm (~30MB) on first use, cached by browser
  * - Progress reporting during extraction
  * - Outputs MP3 format optimized for speech
  * - Handles errors gracefully with user-friendly messages
  */
 
 import { FFmpeg } from '@ffmpeg/ffmpeg';
 import { fetchFile, toBlobURL } from '@ffmpeg/util';
 
 // =============================================================================
 // Types
 // =============================================================================
 
 export interface AudioExtractionProgress {
   stage: 'loading' | 'extracting' | 'finalizing';
   percent: number;
   message: string;
 }
 
 export interface AudioExtractionResult {
   audioBlob: Blob;
   audioFile: File;
   originalFilename: string;
   audioDurationSec?: number;
 }
 
 export interface AudioExtractorOptions {
   onProgress?: (progress: AudioExtractionProgress) => void;
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
 
 // =============================================================================
 // Audio Extraction
 // =============================================================================
 
 /**
  * Extract audio from a video file using FFmpeg.wasm
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
 
   console.log(`[AudioExtractor] Starting extraction for: ${originalFilename} (${(videoFile.size / 1024 / 1024).toFixed(2)} MB)`);
 
   // Get FFmpeg instance (will load if not already loaded)
   const ffmpeg = await getFFmpeg(onProgress);
 
   // Set up progress tracking for extraction
   let lastProgressPercent = 0;
   ffmpeg.on('progress', ({ progress }) => {
     const percent = Math.round(progress * 100);
     if (percent > lastProgressPercent) {
       lastProgressPercent = percent;
       onProgress?.({
         stage: 'extracting',
         percent,
         message: `Extracting audio... ${percent}%`,
       });
     }
   });
 
   try {
     // Write the input video file to FFmpeg's virtual filesystem
     onProgress?.({
       stage: 'extracting',
       percent: 0,
       message: 'Preparing video file...',
     });
 
     const inputFileName = 'input_video' + getExtension(originalFilename);
     const outputFileName = 'output_audio.mp3';
 
     await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));
 
     console.log('[AudioExtractor] Video file written to virtual FS');
 
     // Extract audio using FFmpeg
     // -i: input file
     // -vn: no video
     // -acodec libmp3lame: use LAME MP3 encoder
     // -q:a 2: high quality audio (VBR ~190kbps, good for speech)
     // -ar 44100: sample rate (good balance of quality/size)
     // -ac 1: mono (speech doesn't need stereo, halves file size)
     await ffmpeg.exec([
       '-i', inputFileName,
       '-vn',
       '-acodec', 'libmp3lame',
       '-q:a', '2',
       '-ar', '44100',
       '-ac', '1',
       outputFileName,
     ]);
 
     console.log('[AudioExtractor] Audio extraction complete');
 
     onProgress?.({
       stage: 'finalizing',
       percent: 90,
       message: 'Finalizing audio file...',
     });
 
     // Read the output audio file
     const audioData = await ffmpeg.readFile(outputFileName);
 
     // Clean up virtual filesystem
     await ffmpeg.deleteFile(inputFileName);
     await ffmpeg.deleteFile(outputFileName);
 
     // Convert to Blob and File
     // Handle both Uint8Array and string returns from FFmpeg
     let audioBlob: Blob;
     if (typeof audioData === 'string') {
       audioBlob = new Blob([new TextEncoder().encode(audioData)], { type: 'audio/mpeg' });
     } else {
       // Create a new ArrayBuffer to ensure type compatibility
       const buffer = new ArrayBuffer(audioData.length);
       const view = new Uint8Array(buffer);
       view.set(audioData);
       audioBlob = new Blob([buffer], { type: 'audio/mpeg' });
     }
     const audioFilename = originalFilename.replace(/\.[^.]+$/, '.mp3');
     const audioFile = new File([audioBlob], audioFilename, { type: 'audio/mpeg' });
 
     console.log(`[AudioExtractor] Extracted audio: ${audioFilename} (${(audioBlob.size / 1024 / 1024).toFixed(2)} MB)`);
 
     onProgress?.({
       stage: 'finalizing',
       percent: 100,
       message: 'Audio extraction complete',
     });
 
     return {
       audioBlob,
       audioFile,
       originalFilename,
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