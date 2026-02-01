/**
 * Spread Reading Library
 *
 * Provides talk recommendations for tarot spreads with scoring and rationale generation.
 */

// Types
export * from './types';

// Scoring
export { scoreTalksForSpread, getTopRecommendation } from './score-talks';

// Rationale generation
export { generateRationale, generateShareRationale } from './generate-rationale';
