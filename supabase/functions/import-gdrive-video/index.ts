/**
 * =============================================================================
 * IMPORT GDRIVE VIDEO - Edge Function
 * =============================================================================
 *
 * Imports video files from Google Drive URLs for the Ad Copy Studio workflow.
 * Supports batch imports of up to 5 videos at a time.
 *
 * Features:
 * - Validates and parses Google Drive URLs
 * - Downloads videos using public share links
 * - Uploads to Supabase Storage
 * - Creates tracking records in meta_ad_videos table
 *
 * =============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getCorsHeaders } from "../_shared/security.ts";
import {
  extractFileId,
  streamFromGDrive,
  GDriveError,
  type GDriveErrorCode,
} from "../_shared/gdrive.ts";

// =============================================================================
// Types
// =============================================================================

interface ImportGDriveRequest {
  organization_id: string;
  gdrive_urls: string[];
  batch_id?: string;
  user_id: string;
}

interface ImportResult {
  url: string;
  status: 'success' | 'error';
  video_id?: string;
  filename?: string;
  file_size_bytes?: number;
  error_code?: string;
  error_message?: string;
  suggestion?: string;
}

interface ImportGDriveResponse {
  success: boolean;
  results: ImportResult[];
  batch_id: string;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_URLS_PER_REQUEST = 5;
const STORAGE_BUCKET = 'meta-ad-videos';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique video ID for uploaded videos
 */
function generateVideoId(): string {
  return `gdrive_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Sanitize filename for storage
 */
function sanitizeFilename(filename: string): string {
  // Remove or replace problematic characters
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/__+/g, '_')
    .substring(0, 100); // Limit filename length
}

/**
 * Get public URL for a file in Supabase Storage
 */
function getPublicUrl(supabaseUrl: string, bucket: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse request body
    const body: ImportGDriveRequest = await req.json();
    const { organization_id, gdrive_urls, batch_id, user_id } = body;

    // Validate required fields
    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!gdrive_urls || !Array.isArray(gdrive_urls) || gdrive_urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'gdrive_urls must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (gdrive_urls.length > MAX_URLS_PER_REQUEST) {
      return new Response(
        JSON.stringify({
          error: `Maximum ${MAX_URLS_PER_REQUEST} URLs allowed per request`,
          provided: gdrive_urls.length
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate all URLs are non-empty strings
    if (!gdrive_urls.every((url: unknown) => typeof url === 'string' && (url as string).trim().length > 0)) {
      return new Response(
        JSON.stringify({ success: false, error: 'All gdrive_urls must be non-empty strings' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[import-gdrive-video] Missing required environment variables');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate batch ID if not provided
    const finalBatchId = batch_id || crypto.randomUUID();

    console.log(`[import-gdrive-video] Starting import for org ${organization_id}, batch ${finalBatchId}, ${gdrive_urls.length} URLs`);

    // Process each URL
    const results: ImportResult[] = [];

    for (const url of gdrive_urls) {
      console.log(`[import-gdrive-video] Processing URL: ${url.substring(0, 60)}...`);

      try {
        // Extract file ID from URL
        const fileId = extractFileId(url);
        console.log(`[import-gdrive-video] Extracted file ID: ${fileId}`);

        // Stream the file from Google Drive (memory efficient)
        const { response, filename, contentType, contentLength } = await streamFromGDrive(fileId);
        console.log(`[import-gdrive-video] Streaming: ${filename} (${contentLength ? (contentLength / 1024 / 1024).toFixed(2) + ' MB' : 'size unknown'})`);

        // Generate unique video ID and storage path
        const videoId = generateVideoId();
        const sanitizedFilename = sanitizeFilename(filename);
        const storagePath = `${organization_id}/${finalBatchId}/${videoId}_${sanitizedFilename}`;

        // Stream directly to Supabase Storage (no buffering)
        // We need to get the body as a stream
        if (!response.body) {
          throw new Error('Response body is null - cannot stream');
        }

        // Convert ReadableStream to Uint8Array for Supabase Storage
        // Note: We use streaming to avoid loading entire file at once
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let totalSize = 0;
        const MAX_CHUNK_SIZE = 50 * 1024 * 1024; // 50MB safety limit for edge function
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          chunks.push(value);
          totalSize += value.length;
          
          // Safety check to prevent memory issues
          if (totalSize > MAX_CHUNK_SIZE) {
            reader.cancel();
            throw new GDriveError(
              'FILE_TOO_LARGE',
              `File exceeds ${MAX_CHUNK_SIZE / 1024 / 1024}MB limit for edge function processing`,
              'Please download the video manually and use the direct upload feature, which supports larger files.'
            );
          }
        }
        
        // Combine chunks
        const fileData = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of chunks) {
          fileData.set(chunk, offset);
          offset += chunk.length;
        }

        console.log(`[import-gdrive-video] Downloaded ${(totalSize / 1024 / 1024).toFixed(2)} MB, uploading to storage...`);

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, fileData, {
            contentType: contentType || 'video/mp4',
            upsert: false,
          });

        if (uploadError) {
          console.error(`[import-gdrive-video] Storage upload error:`, uploadError);
          results.push({
            url,
            status: 'error',
            error_code: 'STORAGE_ERROR',
            error_message: `Failed to upload to storage: ${uploadError.message}`,
            suggestion: 'Please try again or contact support if the issue persists',
          });
          continue;
        }

        // Get the public URL
        const videoUrl = getPublicUrl(supabaseUrl, STORAGE_BUCKET, storagePath);

        // Create record in meta_ad_videos table
        const { data: insertedVideo, error: dbError } = await supabase
          .from('meta_ad_videos')
          .insert({
            organization_id,
            ad_id: `gdrive_${videoId}`, // Ad ID for gdrive imports
            video_id: videoId,
            video_source_url: videoUrl,
            source: 'gdrive',
            original_filename: filename,
            video_file_size_bytes: totalSize,
            uploaded_by: user_id,
            status: 'PENDING',
            resolution_method: 'manual',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (dbError) {
          console.error(`[import-gdrive-video] Database insert error:`, dbError);

          // Try to clean up the uploaded file
          const { error: cleanupError } = await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
          if (cleanupError) {
            console.error(`[import-gdrive-video] Failed to cleanup ${storagePath}:`, cleanupError);
          } else {
            console.log(`[import-gdrive-video] Cleaned up ${storagePath}`);
          }

          results.push({
            url,
            status: 'error',
            error_code: 'DATABASE_ERROR',
            error_message: `Failed to create video record: ${dbError.message}`,
            suggestion: 'Please try again or contact support if the issue persists',
          });
          continue;
        }

        console.log(`[import-gdrive-video] Successfully imported: ${filename} -> ${insertedVideo.id}`);

        results.push({
          url,
          status: 'success',
          video_id: insertedVideo.id,
          filename,
          file_size_bytes: totalSize,
        });

      } catch (error) {
        // Handle GDriveError specifically
        if (error instanceof GDriveError) {
          console.error(`[import-gdrive-video] GDrive error for ${url}:`, error.code, error.message);
          results.push({
            url,
            status: 'error',
            error_code: error.code,
            error_message: error.message,
            suggestion: error.suggestion,
          });
        } else {
          // Handle generic errors
          console.error(`[import-gdrive-video] Unexpected error for ${url}:`, error);
          results.push({
            url,
            status: 'error',
            error_code: 'NETWORK_ERROR',
            error_message: error instanceof Error ? error.message : 'Unknown error occurred',
            suggestion: 'Please check the URL and try again',
          });
        }
      }
    }

    // Calculate overall success
    const successCount = results.filter(r => r.status === 'success').length;
    const overallSuccess = successCount > 0;

    console.log(`[import-gdrive-video] Complete. Success: ${successCount}/${gdrive_urls.length}`);

    const response: ImportGDriveResponse = {
      success: overallSuccess,
      results,
      batch_id: finalBatchId,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[import-gdrive-video] Unhandled error:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false,
        results: [],
        batch_id: '',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
