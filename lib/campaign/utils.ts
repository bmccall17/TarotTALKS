/**
 * Campaign Pipeline Utilities
 *
 * Shared helpers for the campaign CLI scripts.
 */

import { parse } from 'csv-parse/sync';
import { mkdir, writeFile, readFile, access } from 'fs/promises';
import { join } from 'path';
import type { CampaignItem, CampaignManifest, CampaignPlatform, CampaignCategory } from './types';

const CAMPAIGNS_DIR = join(process.cwd(), 'campaigns');

/**
 * Parse CSV input into CampaignItems.
 * Expected columns: platform, slug, category, caption, alt_text, tags, image_url,
 *   speaker_handle, talk_url, card_name, talk_title, speaker_name, scheduled_date
 */
export function parseCsvInput(csvContent: string): CampaignItem[] {
  const records: Record<string, string>[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((row) => ({
    platform: (row.platform || 'instagram') as CampaignPlatform,
    slug: row.slug || '',
    category: (row.category || 'cards') as CampaignCategory,
    caption: row.caption || '',
    alt_text: row.alt_text || '',
    tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
    image_url: row.image_url || '',
    speaker_handle: row.speaker_handle || undefined,
    talk_url: row.talk_url || undefined,
    card_name: row.card_name || undefined,
    talk_title: row.talk_title || undefined,
    speaker_name: row.speaker_name || undefined,
    scheduled_date: row.scheduled_date || undefined,
  }));
}

/**
 * Parse JSON input into CampaignItems.
 */
export function parseJsonInput(jsonContent: string): CampaignItem[] {
  const data = JSON.parse(jsonContent);
  if (Array.isArray(data)) return data;
  if (data.items && Array.isArray(data.items)) return data.items;
  throw new Error('JSON must be an array of items or an object with an "items" array');
}

/**
 * Build a deterministic post directory path.
 * Format: campaigns/{campaign}/{platform}/{date}_{slug}/
 */
export function getPostDirectory(campaignSlug: string, platform: string, item: CampaignItem): string {
  const date = item.scheduled_date || new Date().toISOString().slice(0, 10);
  const dirName = `${date}_${item.slug}`;
  return join(CAMPAIGNS_DIR, campaignSlug, platform, dirName);
}

/**
 * Get the campaign root directory.
 */
export function getCampaignDir(campaignSlug: string): string {
  return join(CAMPAIGNS_DIR, campaignSlug);
}

/**
 * Ensure a directory exists, creating it recursively if needed.
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Write the campaign manifest to disk.
 */
export async function writeManifest(campaignSlug: string, manifest: CampaignManifest): Promise<void> {
  const dir = getCampaignDir(campaignSlug);
  await ensureDirectory(dir);
  const filePath = join(dir, 'manifest.json');
  await writeFile(filePath, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Read an existing manifest, or return null if it doesn't exist.
 */
export async function readManifest(campaignSlug: string): Promise<CampaignManifest | null> {
  const filePath = join(getCampaignDir(campaignSlug), 'manifest.json');
  try {
    await access(filePath);
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Check if a file exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a unique key for deduplication: platform + slug combo.
 */
export function itemKey(item: CampaignItem): string {
  return `${item.platform}:${item.slug}`;
}

/**
 * Log with emoji prefix for CLI readability.
 */
export function log(emoji: string, message: string): void {
  console.log(`${emoji}  ${message}`);
}
