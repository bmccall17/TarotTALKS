/**
 * Replicate AI Upscaling Service
 *
 * Uses Real-ESRGAN via Replicate API for AI-powered image enhancement.
 * Generates actual detail that doesn't exist in the source image,
 * unlike traditional interpolation-based upscaling.
 */

import Replicate from 'replicate';
import { logApiCall } from '@/lib/db/queries/api-usage';

// Model configuration
const REAL_ESRGAN_MODEL = 'nightmareai/real-esrgan';
const REAL_ESRGAN_VERSION = 'f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa';

// Cost estimate for logging (~2s on T4 GPU)
export const REPLICATE_COST_PER_IMAGE = 0.002;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

export interface UpscaleOptions {
  scale?: 2 | 4;
  faceEnhance?: boolean;
  talkId?: string;
  source?: string;
}

export interface UpscaleSuccess {
  success: true;
  outputUrl: string;
  processingTimeMs: number;
  costUsd: number;
}

export interface UpscaleError {
  success: false;
  error: string;
}

export type UpscaleResult = UpscaleSuccess | UpscaleError;

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upscale an image using Real-ESRGAN via Replicate API.
 *
 * @param imageUrl - Must be a publicly accessible URL (Supabase storage URLs work)
 * @param options - Upscaling options
 * @returns Result with output URL or error
 */
export async function upscaleWithAI(
  imageUrl: string,
  options: UpscaleOptions = {}
): Promise<UpscaleResult> {
  const {
    scale = 2,
    faceEnhance = false,
    talkId,
    source = 'ai-upscale',
  } = options;

  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    return {
      success: false,
      error: 'REPLICATE_API_TOKEN not configured',
    };
  }

  const replicate = new Replicate({ auth: apiToken });
  const startTime = Date.now();
  let lastError: string = 'Unknown error';

  // Retry loop
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🤖 [Replicate] Attempt ${attempt}/${MAX_RETRIES} - Upscaling image...`);

      // Use predictions API for better visibility
      const prediction = await replicate.predictions.create({
        version: REAL_ESRGAN_VERSION,
        input: {
          image: imageUrl,
          scale,
          face_enhance: faceEnhance,
        },
      });

      // Wait for prediction to complete
      let completedPrediction = prediction;
      let dots = 0;
      while (completedPrediction.status !== 'succeeded' && completedPrediction.status !== 'failed' && completedPrediction.status !== 'canceled') {
        await sleep(1000);
        completedPrediction = await replicate.predictions.get(prediction.id);
        dots++;
        if (dots % 3 === 0) {
          process.stdout.write('.');
        }
      }
      if (dots > 0) console.log(); // newline after dots

      const processingTimeMs = Date.now() - startTime;

      if (completedPrediction.status === 'failed') {
        throw new Error(`Prediction failed: ${completedPrediction.error || 'Unknown error'}`);
      }

      if (completedPrediction.status === 'canceled') {
        throw new Error('Prediction was canceled');
      }

      const output = completedPrediction.output;

      // Handle various output formats from Replicate
      let outputUrl: string | null = null;

      if (typeof output === 'string') {
        outputUrl = output;
      } else if (Array.isArray(output) && output.length > 0) {
        outputUrl = typeof output[0] === 'string' ? output[0] : null;
      } else if (output && typeof output === 'object') {
        // Some models return { output: "url" } or { url: "url" }
        const obj = output as Record<string, unknown>;
        if (typeof obj.output === 'string') {
          outputUrl = obj.output;
        } else if (typeof obj.url === 'string') {
          outputUrl = obj.url;
        } else if (typeof obj.image === 'string') {
          outputUrl = obj.image;
        }
      }

      if (!outputUrl) {
        throw new Error(`No output URL returned from Replicate. Got: ${JSON.stringify(output)}`);
      }

      // Log successful API call
      await logApiCall({
        apiName: 'replicate',
        success: true,
        source,
        modelId: REAL_ESRGAN_MODEL,
        costUsd: REPLICATE_COST_PER_IMAGE,
        properties: {
          talkId,
          scale,
          faceEnhance,
          processingTimeMs,
          outputUrl: outputUrl.substring(0, 100), // Truncate for logging
        },
      });

      console.log(`✅ [Replicate] Upscaled in ${processingTimeMs}ms`);

      return {
        success: true,
        outputUrl,
        processingTimeMs,
        costUsd: REPLICATE_COST_PER_IMAGE,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`❌ [Replicate] Attempt ${attempt} failed:`, lastError);

      // Don't retry on certain errors
      if (
        lastError.includes('Invalid API token') ||
        lastError.includes('invalid image') ||
        lastError.includes('not found')
      ) {
        break;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`⏳ [Replicate] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  // Log failed API call
  await logApiCall({
    apiName: 'replicate',
    success: false,
    errorType: 'api_error',
    source,
    modelId: REAL_ESRGAN_MODEL,
    properties: {
      talkId,
      error: lastError,
      attempts: MAX_RETRIES,
    },
  });

  return {
    success: false,
    error: lastError,
  };
}

/**
 * Check if Replicate API is configured and accessible.
 */
export async function isReplicateAvailable(): Promise<boolean> {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    return false;
  }

  try {
    const replicate = new Replicate({ auth: apiToken });
    // Just check if we can access the model info
    await replicate.models.get('nightmareai', 'real-esrgan');
    return true;
  } catch {
    return false;
  }
}
