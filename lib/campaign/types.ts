/**
 * Campaign Pipeline Types
 *
 * Shared types for the social campaign asset pipeline.
 * Used by CLI scripts (campaign:ingest, campaign:download, campaign:render, campaign:index).
 */

export type CampaignPlatform = 'instagram' | 'x' | 'bluesky' | 'linkedin' | 'threads';

export type CampaignCategory = 'cards' | 'talks';

export interface CampaignItem {
  platform: CampaignPlatform;
  image_url: string;
  slug: string;
  post_id?: string;
  caption: string;
  alt_text: string;
  tags: string[];
  speaker_handle?: string;
  talk_url?: string;
  card_name?: string;
  talk_title?: string;
  speaker_name?: string;
  talk_slug?: string; // Primary talk slug (for square image variants)
  category: CampaignCategory;
  scheduled_date?: string; // YYYY-MM-DD
}

export interface CampaignManifest {
  campaign_slug: string;
  created_at: string;
  items: CampaignItem[];
  source: 'csv' | 'json' | 'signal-deck';
}

export interface RenderSpec {
  name: string;
  width: number;
  height: number;
  format: 'jpg' | 'png';
  quality: number;
}

export const PLATFORM_RENDER_SPECS: Record<CampaignPlatform, RenderSpec[]> = {
  instagram: [
    { name: 'feed_4x5', width: 1080, height: 1350, format: 'jpg', quality: 95 },
    { name: 'square_1x1', width: 1080, height: 1080, format: 'jpg', quality: 95 },
  ],
  x: [{ name: 'og_card', width: 1200, height: 630, format: 'jpg', quality: 90 }],
  bluesky: [{ name: 'og_card', width: 1200, height: 630, format: 'jpg', quality: 90 }],
  linkedin: [{ name: 'og_card', width: 1200, height: 627, format: 'jpg', quality: 90 }],
  threads: [
    // square_1x1 parked for future sprint (crops talk info at bottom)
  ],
};

export interface DownloadError {
  slug: string;
  platform: CampaignPlatform;
  url: string;
  error: string;
  timestamp: string;
}

export interface CampaignSummary {
  campaign_slug: string;
  generated_at: string;
  total_items: number;
  by_platform: Record<string, { total: number; rendered: number; missing: number }>;
}

export type SquareVariant = 'card_talk' | 'card_only' | 'talk';
export const SQUARE_VARIANTS: { variant: SquareVariant; suffix: string }[] = [
  { variant: 'card_talk', suffix: '' },          // square_1x1.jpg
  { variant: 'card_only', suffix: '_card_only' }, // square_1x1_card_only.jpg
  { variant: 'talk', suffix: '_talk' },            // square_1x1_talk.jpg
];
