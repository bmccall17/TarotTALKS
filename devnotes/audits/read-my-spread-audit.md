# Read My Spread Feature - Technical Audit

**Audit Date:** February 1, 2026
**Version:** Current Production
**Domain:** https://tarottalks.app

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [User Flow Overview](#2-user-flow-overview)
3. [UI Components](#3-ui-components)
4. [API Endpoints](#4-api-endpoints)
5. [AI Integration](#5-ai-integration)
6. [Scoring Algorithm](#6-scoring-algorithm)
7. [Database Schema](#7-database-schema)
8. [Data Flow Diagram](#8-data-flow-diagram)
9. [Technical Specifications](#9-technical-specifications)
10. [Areas for Feedback](#10-areas-for-feedback)

---

## 1. Executive Summary

The "Read My Spread" feature is a TED talk recommendation system that analyzes Tarot spreads (2-3 cards) and matches them to relevant TED talks using a scoring algorithm, with optional AI-enhanced rationale generation.

| Aspect | Current Implementation |
|--------|----------------------|
| **AI Model** | Google Gemini 1.5 Flash (Free Tier) |
| **Cards Supported** | 2-3 cards per spread |
| **Scoring Range** | 0-50 points |
| **Rationale Sources** | Template (default) or AI-generated |
| **Persistence** | Spreads saved to PostgreSQL with shareable URLs |

---

## 2. User Flow Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   STEP 1    │───▶│   STEP 2    │───▶│   STEP 3    │───▶│   STEP 4    │
│   Focus     │    │   Loading   │    │   Result    │    │   Share     │
│   Selection │    │   State     │    │   Display   │    │   Options   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Step 1: Focus Selection
User chooses what they want guidance on:
- **Predefined Options:** Relationships, Work/Calling, Courage/Change, Grief/Healing, Creativity, Money/Stability, Identity/Purpose
- **Surprise Me:** Random/serendipitous match
- **Custom:** User types their own focus question

### Step 2: Loading State
- Animated card visuals
- Rotating messages: "Consulting the cards...", "Finding your talk...", "Weaving the threads...", etc.
- Duration: 1-3 seconds typically

### Step 3: Result Display
- Card images with position labels
- Recommended talk thumbnail (clickable)
- AI or template-generated rationale
- Action buttons: "Try Another", "Share", "Close"

### Step 4: Share (Optional)
- Copy link to clipboard
- Copy link + rationale text
- Native share dialog (mobile)

---

## 3. UI Components

### 3.1 ReadMySpreadModal
**File:** `components/ritual/SpreadReading/ReadMySpreadModal.tsx`

**Purpose:** Main container orchestrating the 4-step flow

**Props:**
```typescript
{
  cards: CardData[];           // All 78 tarot cards
  revealedCards: number[];     // Indices of revealed cards (2-3)
  onClose: () => void;
  onTalkClick?: (talkSlug: string) => void;
}
```

**State Management:**
- `step`: Current step ('focus' | 'loading' | 'result' | 'share')
- `result`: ReadingResult object with talk + rationale
- `error`: Error message for display

---

### 3.2 FocusStep
**File:** `components/ritual/SpreadReading/FocusStep.tsx`

**Focus Type Options:**
| Value | Label | Description |
|-------|-------|-------------|
| `relationships` | Relationships | Love, connection, family, community |
| `work` | Work / Calling | Career, purpose, leadership, success |
| `courage` | Courage / Change | Transformation, fear, growth |
| `grief` | Grief / Healing | Loss, acceptance, letting go |
| `creativity` | Creativity | Art, imagination, expression |
| `money` | Money / Stability | Wealth, security, resources |
| `identity` | Identity / Purpose | Self, authenticity, meaning |
| `surprise_me` | Surprise Me | No focus filter applied |
| `custom` | Custom | User types free-form text |

**UI Elements:**
- Chip buttons for predefined options
- Expandable textarea for custom focus
- "Back" and "Read My Spread" action buttons

---

### 3.3 LoadingState
**File:** `components/ritual/SpreadReading/LoadingState.tsx`

**Rotating Messages (every 2 seconds):**
1. "Consulting the cards..."
2. "Finding your talk..."
3. "Weaving the threads..."
4. "Seeking wisdom..."
5. "Aligning the stars..."

**Animations:**
- Floating card animation
- Subtle glow effects

---

### 3.4 ResultDisplay
**File:** `components/ritual/SpreadReading/ResultDisplay.tsx`

**Displayed Elements:**
1. **Cards Section:** Card images with position labels ("Aware Self", "Supporting Shadow", "Emerging Path")
2. **Talk Section:** Thumbnail, title, speaker, duration badge (clickable)
3. **Rationale:** Italicized quote block
4. **Actions:** Try Another, Share, Close

**Props:**
```typescript
{
  talk: SpreadTalk;
  rationale: string;
  cards: SpreadCard[];
  score: number;
  matchReasons: MatchReason[];
  spreadShortId?: string;
  onTryAgain: () => void;
  onShare?: () => void;
  onClose: () => void;
  onTalkClick?: () => void;
}
```

---

### 3.5 ShareStep
**File:** `components/ritual/SpreadReading/ShareStep.tsx`

**Share Options:**
1. **Link Only:** `https://tarottalks.app/spreads/{shortId}`
2. **Link + Text:** Includes rationale with URL

**Features:**
- Copy to clipboard with success feedback
- Native Share API for mobile devices
- Back button to return to result

---

## 4. API Endpoints

### 4.1 POST /api/spreads/spread-reading
**File:** `app/api/spreads/spread-reading/route.ts`

**Purpose:** Generate spread reading with talk recommendation

**Request:**
```typescript
{
  cardIds: string[];          // 2-3 card UUIDs in position order
  focusType?: FocusType;      // Optional focus category
  focusText?: string;         // Optional custom text
  save?: boolean;             // Default: true
}
```

**Response:**
```typescript
{
  type: 'single' | 'multiple_options';
  talk: SpreadTalk;
  rationale: string;
  rationaleSource: 'template' | 'ai';
  aiModel?: string;           // 'gemini-1.5-flash' if AI used
  score: number;              // 0-50
  matchReasons: MatchReason[];
  alternativeTalks?: SpreadTalk[];  // If multiple_options
  cards: SpreadCard[];
  spread?: {
    id: string;
    shortId: string;          // For shareable URL
  };
}
```

**Processing Steps:**
1. Validate cardIds (2-3 UUIDs required)
2. Fetch cards, talks, and mappings from database
3. Score all talks using 6-factor algorithm
4. Select top recommendation
5. Generate rationale (AI or template)
6. Save spread to database (if save=true)
7. Return result

---

### 4.2 GET /api/spreads/[id]
**File:** `app/api/spreads/[id]/route.ts`

**Purpose:** Fetch saved spread for public share pages

**Response:** Full spread object with cards and talk data

**Caching:** `public, max-age=3600, stale-while-revalidate=86400`

---

## 5. AI Integration

### 5.1 Model Configuration
**File:** `lib/services/gemini.ts`

| Setting | Value |
|---------|-------|
| **Model** | `gemini-1.5-flash` |
| **API** | Google Generative Language API v1beta |
| **Temperature** | 0.7 (moderate creativity) |
| **Max Output Tokens** | 256 (~100-150 words) |
| **Top P** | 0.8 |
| **Top K** | 40 |

### 5.2 Rate Limiting
```typescript
MAX_REQUESTS_PER_MINUTE = 10   // Conservative (15 allowed on free tier)
RESET_INTERVAL = 60 seconds
```
**Note:** In-memory counter resets on server restart

### 5.3 AI Trigger Conditions
AI rationale is generated when:
- User provides **custom focus text** longer than 10 characters
- OR `forceAI=true` flag is explicitly set

Otherwise, template-based rationale is used.

### 5.4 Prompt Template
**File:** `lib/spread-reading/generate-rationale.ts`

```
You are a TarotTALKS spread reader. Given these cards and this TED talk,
write a 2-3 sentence rationale explaining why this talk speaks to this spread.

Cards:
- [Card Name] in [Position]: [Card Summary]
- [Card Name] in [Position]: [Card Summary]
- [Card Name] in [Position]: [Card Summary]

User's focus: [Custom focus text if provided]

Recommended talk: "[Talk Title]" by [Speaker Name]
Talk description: [Talk Description]

Write a warm, insightful rationale using second person ("you").
Keep it under 100 words. Don't mention the card positions by name
("Aware Self", etc.) - just weave the themes together naturally.
Focus on the emotional resonance between the cards and the talk.
```

### 5.5 Context Sent to AI
| Data | Source |
|------|--------|
| Card names | `cards.name` |
| Card summaries | `cards.summary` |
| Card positions | "Aware Self", "Supporting Shadow", "Emerging Path" |
| User focus text | User input (if provided) |
| Talk title | `talks.title` |
| Talk speaker | `talks.speaker_name` |
| Talk description | `talks.description` |

### 5.6 Template Fallback Structure
**File:** `lib/spread-reading/generate-rationale.ts`

When AI is not used or fails:
```
[Opening - links first card to talk]
+
[Middle - describes match quality]
+
[Closing - encouraging statement]
```

**Example:**
> "As The Tower appears in your spread, 'Why We Don't Talk About Mental Health' offers a powerful perspective. This talk weaves together all three cards in your spread. Let the speaker's words illuminate your path."

---

## 6. Scoring Algorithm

**File:** `lib/spread-reading/score-talks.ts`

### 6.1 Scoring Factors (0-50 max points)

| Factor | Max Points | Description |
|--------|-----------|-------------|
| **Mapping Strength** | 15 | Sum of curator-assigned strength ratings (1-5 per card) |
| **Multi-Card Bonus** | 10 | +10 for 3 cards matched, +5 for 2 cards |
| **Theme Overlap** | 10 | Shared themes between cards and talk (2 pts per theme) |
| **Primary Talk Bonus** | 5 | Talk marked as primary for any card in spread |
| **Focus Match** | 5 | Focus keywords found in talk metadata |
| **Keyword Match** | 5 | Custom focus text keywords found in talk |

### 6.2 Detailed Breakdown

#### Mapping Strength (0-15)
- Source: `card_talk_mappings.strength` (curator ratings 1-5)
- Calculation: Sum of all strength values for matched card-talk pairs
- Capped at 15 points

#### Multi-Card Bonus (0-10)
- 3 cards matched to same talk: **+10 points**
- 2 cards matched to same talk: **+5 points**
- 1 card matched: **0 points**

#### Theme Overlap (0-10)
- Source: `cards.themes_json` and `talks.themes_json`
- Calculation: `overlapping_themes * 2`, capped at 10

#### Primary Talk Bonus (0-5)
- If talk has `is_primary=true` for any card in spread: **+5 points**

#### Focus Match (0-5)
- Only applied if focusType is predefined (not 'surprise_me' or 'custom')
- Checks focus keywords against talk themes, title, description, core_message
- Calculation: `keyword_matches * 2`, capped at 5

**Focus Keywords by Type:**
| Focus Type | Keywords |
|------------|----------|
| relationships | love, connection, family, partnership, community, trust, intimacy, belonging |
| work | career, purpose, leadership, success, ambition, calling, profession, business |
| courage | change, fear, bravery, transformation, risk, growth, resilience, challenge |
| grief | loss, healing, sorrow, death, mourning, acceptance, letting go, grief |
| creativity | art, imagination, innovation, expression, creation, inspiration, design, play |
| money | wealth, finance, abundance, security, prosperity, stability, resources, material |
| identity | self, authenticity, identity, purpose, meaning, values, who am I, becoming |

#### Keyword Match (0-5)
- Only applied if custom focusText > 3 characters
- Extracts keywords from user text (filters stop words and short words)
- Counts keyword occurrences in talk metadata
- Capped at 5 points

### 6.3 Low Score Handling
If top talk score < 10 points:
- Returns `type: 'multiple_options'` with top 3 talks
- Allows user to choose from alternatives

---

## 7. Database Schema

### 7.1 Spreads Table
**File:** `lib/db/schema.ts`

```sql
CREATE TABLE spreads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id VARCHAR(12) NOT NULL UNIQUE,

  -- Cards (ordered by position)
  card_1_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  card_2_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  card_3_id UUID REFERENCES cards(id) ON DELETE SET NULL,

  -- User input
  focus_type focus_type_enum,
  focus_text TEXT,

  -- Generated result
  talk_id UUID REFERENCES talks(id) ON DELETE SET NULL,
  rationale TEXT NOT NULL,
  rationale_source VARCHAR(20) DEFAULT 'template',
  ai_model VARCHAR(50),
  score INTEGER,
  match_reasons JSONB,

  -- Privacy
  privacy_level privacy_level_enum DEFAULT 'full',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### 7.2 Indexes
```sql
CREATE INDEX idx_spreads_short_id ON spreads(short_id);
CREATE INDEX idx_spreads_created_at ON spreads(created_at DESC);
CREATE INDEX idx_spreads_card_1 ON spreads(card_1_id);
CREATE INDEX idx_spreads_card_2 ON spreads(card_2_id);
CREATE INDEX idx_spreads_card_3 ON spreads(card_3_id);
CREATE INDEX idx_spreads_talk ON spreads(talk_id);
```

### 7.3 Related Tables Used

**cards** - Provides: name, summary, keywords, themes_json, archetypes_json, image_url

**talks** - Provides: title, speaker_name, description, thumbnail_url, duration_seconds, themes_json, core_message

**card_talk_mappings** - Provides: card_id, talk_id, is_primary, strength (1-5), rationale_short

### 7.4 Short ID Generation
- Initial: 10 random alphanumeric characters
- Fallback: 16 characters if collision detected
- Up to 5 collision retry attempts

---

## 8. Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                                 │
│  ReadMySpreadModal → FocusStep → LoadingState → ResultDisplay         │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               │ POST /api/spreads/spread-reading
                               │ { cardIds, focusType, focusText, save }
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        API ROUTE                                      │
│  1. Validate cardIds (2-3 required)                                   │
│  2. Fetch cards: getCardsForSpread(cardIds)                           │
│  3. Fetch talks: getTalksForScoring()                                 │
│  4. Fetch mappings: getMappingsForCards(cardIds)                      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     SCORING ENGINE                                    │
│  scoreTalksForSpread() - Score ALL talks against spread               │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ For each talk:                                                  │  │
│  │   + Mapping Strength (0-15)                                     │  │
│  │   + Multi-Card Bonus (0-10)                                     │  │
│  │   + Theme Overlap (0-10)                                        │  │
│  │   + Primary Talk Bonus (0-5)                                    │  │
│  │   + Focus Match (0-5)                                           │  │
│  │   + Keyword Match (0-5)                                         │  │
│  │   = Total Score (0-50)                                          │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  getTopRecommendation() - Select highest scoring talk                 │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   RATIONALE GENERATION                                │
│  shouldUseAI()? → Custom focusText > 10 chars = YES                   │
│                                                                       │
│  ┌─────────────────────┐     ┌─────────────────────┐                 │
│  │   AI PATH           │     │   TEMPLATE PATH     │                 │
│  │                     │     │                     │                 │
│  │  Send to Gemini:    │     │  Generate from:     │                 │
│  │  - Card names       │     │  - Opening phrase   │                 │
│  │  - Card summaries   │     │  - Middle (match)   │                 │
│  │  - Card positions   │     │  - Closing phrase   │                 │
│  │  - Focus text       │     │                     │                 │
│  │  - Talk title       │     │  ~30-50 words       │                 │
│  │  - Talk description │     │                     │                 │
│  │                     │     │                     │                 │
│  │  Returns:           │     │  Returns:           │                 │
│  │  ~100 words         │     │  Template text      │                 │
│  │  source: 'ai'       │     │  source: 'template' │                 │
│  │  model: 'gemini-    │     │                     │                 │
│  │         1.5-flash'  │     │                     │                 │
│  └─────────────────────┘     └─────────────────────┘                 │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     DATABASE SAVE                                     │
│  createSpread() - Generate shortId, insert record                     │
│  Returns: { id, shortId }                                             │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     API RESPONSE                                      │
│  {                                                                    │
│    type: 'single',                                                    │
│    talk: { id, slug, title, speaker, thumbnail, duration },           │
│    rationale: "...",                                                  │
│    rationaleSource: 'template' | 'ai',                                │
│    aiModel: 'gemini-1.5-flash' (if AI),                               │
│    score: 0-50,                                                       │
│    matchReasons: [...],                                               │
│    cards: [...],                                                      │
│    spread: { id, shortId }                                            │
│  }                                                                    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 9. Technical Specifications

### 9.1 Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18+ (Client Components) |
| Framework | Next.js 14+ (App Router) |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| AI | Google Gemini 1.5 Flash |
| Styling | Tailwind CSS |

### 9.2 Configuration

| Setting | Value |
|---------|-------|
| Max cards per spread | 3 |
| Min cards per spread | 2 |
| Max score | 50 points |
| Low score threshold | 10 points |
| Rationale max tokens | 256 |
| Rate limit | 10 RPM |
| ShortId length | 10-16 chars |
| Cache (share pages) | 1hr + 24hr stale |

### 9.3 Environment Variables

```bash
GOOGLE_GEMINI_API_KEY=xxx    # Required for AI rationale
```

### 9.4 File Locations

| Purpose | Path |
|---------|------|
| Modal | `components/ritual/SpreadReading/ReadMySpreadModal.tsx` |
| Steps | `components/ritual/SpreadReading/FocusStep.tsx` |
|  | `components/ritual/SpreadReading/LoadingState.tsx` |
|  | `components/ritual/SpreadReading/ResultDisplay.tsx` |
|  | `components/ritual/SpreadReading/ShareStep.tsx` |
| API | `app/api/spreads/spread-reading/route.ts` |
|  | `app/api/spreads/[id]/route.ts` |
| Scoring | `lib/spread-reading/score-talks.ts` |
| Rationale | `lib/spread-reading/generate-rationale.ts` |
| Gemini | `lib/services/gemini.ts` |
| Types | `lib/spread-reading/types.ts` |
| DB Queries | `lib/db/queries/spreads.ts` |
| Schema | `lib/db/schema.ts` |
| OG Images | `app/spreads/[id]/opengraph-image.tsx` |
|  | `app/spreads/[id]/twitter-image.tsx` |

---

## 10. Areas for Feedback

Please provide your vision and feedback on any of the following areas:

### Flow & UX
- [ ] **Step sequence:** Is 4 steps (Focus → Loading → Result → Share) the right flow?
- [ ] **Focus selection:** Are the 9 focus options the right categories?
- [ ] **Loading experience:** Are the rotating messages appropriate?
- [ ] **Result presentation:** How should the talk + rationale be displayed?
- [ ] **Share flow:** Is sharing a separate step, or should it be integrated?

### UI & Visual Design
- [ ] **Modal design:** Full-screen vs. centered modal vs. bottom sheet?
- [ ] **Card display:** How should the 2-3 cards be visualized?
- [ ] **Talk presentation:** Thumbnail size, metadata shown, click behavior?
- [ ] **Rationale styling:** Quote block, card-style, or different presentation?
- [ ] **Position labels:** "Aware Self", "Supporting Shadow", "Emerging Path" - keep/change?

### AI & Rationale
- [ ] **When to use AI:** Currently only for custom focus text > 10 chars
- [ ] **Rationale tone:** Warm/mystical vs. practical/insightful?
- [ ] **Rationale length:** ~100 words - shorter or longer?
- [ ] **Template quality:** Is the fallback template acceptable?

### Scoring & Matching
- [ ] **Scoring weights:** Are the point allocations correct?
- [ ] **Focus keywords:** Are the theme keywords comprehensive?
- [ ] **Low score handling:** Multiple options at score < 10?
- [ ] **Primary talk priority:** Should it be weighted more?

### Features
- [ ] **Try Another:** Regenerate with same cards - keep/remove/modify?
- [ ] **Multiple options:** Show alternatives when confidence is low?
- [ ] **Privacy levels:** full/cards_only/cards_and_talk options?
- [ ] **Social sharing:** OG image design, share text format?

### Technical
- [ ] **Performance:** Any concerns with scoring all talks?
- [ ] **Rate limiting:** 10 RPM sufficient?
- [ ] **Caching strategy:** Current approach acceptable?

---

*This document is ready for your feedback. Please annotate or respond with your vision for how the feature should evolve.*
