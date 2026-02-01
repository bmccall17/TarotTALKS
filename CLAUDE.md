# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TarotTALKS** is a lookup instrument that maps the Tarot deck (all 78 cards) to TED talks. It helps users discover TED talks based on Tarot cards they've pulled, find cards that match talks they love, and explore curated themes that blend Tarot archetypes with TED content.

## Current State

This is an early-stage project currently in the design/planning phase. The repository contains:
- Product concept documentation (webapp_concept_01.md)
- Database schema design (webapp_concept_db_01.md)
- No implementation code yet

## Core Data Model

When implementing, follow the relational database schema outlined in webapp_concept_db_01.md:

### Primary Tables
- **cards**: 78 Tarot cards with meanings, keywords, images
- **talks**: TED/TEDx talks with metadata (title, speaker, URL, duration)
- **card_talk_mappings**: The interpretive layer linking cards to talks with curatorial notes
- **themes**: Curated collections (e.g., "Grief & Gratitude", "New Beginnings")
- **card_themes** and **talk_themes**: Many-to-many relationships

### Key Design Principles
- Use slugs for all entities to enable clean URLs (`/cards/the-tower`)
- Keep content (card meanings, talk details) separate from mappings (the curatorial layer)
- `card_talk_mappings` contains the core value: rationale for why a card and talk pair together
- Each mapping has `is_primary` (main talk for a card) and `strength` (1-5 rating)

## Core Use Cases (Priority Order)

1. **Card → Talks**: "I pulled the Tower. What talks should I watch?"
2. **Talk → Cards**: "What card(s) does this talk about vulnerability map to?"
3. **Theme → Cards & Talks**: Browse curated themes with blended recommendations
4. **Exploration**: Random card + talk pairing
5. **Search**: Omnibox search across cards, talks, and themes

## UX Design Principles

From webapp_concept_01.md:

- **Mobile-first**: Design for vertical scrolling, bottom navigation (Home, Cards, Talks, Themes)
- **Progressive disclosure**: Show essentials above the fold, hide deep content in accordions/drawers
  - Card detail: Show image, name, keywords, 1 primary talk above fold
  - Hide full meanings, related cards, journaling prompts below fold
- **Quick action focus**: Users should be able to "do something" in 1-2 taps
- **Desktop enhancements**: Side-by-side layouts, spread builders, multi-filter panels as bonus features

## Technology Recommendations

Based on the schema design document:
- **Database**: Start with SQLite for prototyping, migrate to Postgres/Supabase for production
- **Backend**: The schema supports standard RESTful or GraphQL queries
- **Search**: Start with SQL `ILIKE` queries, upgrade to full-text search later

## Content Structure

- Card images should be stored and referenced via `cards.image_url`
- Talk thumbnails referenced via `talks.thumbnail_url`
- Keywords stored as text or JSON arrays
- Curatorial notes split between:
  - Short rationale: `card_talk_mappings.rationale_short` (1-2 sentences)
  - Deep essays: `card_talk_mappings.rationale_long` (optional)

## Implementation Phases

When beginning development, suggested order:
1. Database schema setup with core tables (cards, talks, card_talk_mappings)
2. Basic API layer for CRUD operations
3. Card detail and Talk detail views (the heart of the app)
4. Search functionality across entities
5. Themes and curated collections
6. Advanced features (spreads, journaling, user accounts)

## Manually added instructions
⚠️ **FREE TIER CONSTRAINT:** App must remain FREE - use Gemini Free Tier for AI features. No paid APIs or subscriptions.

⚠️ **GIT RESTRICTION:** Claude must not run, simulate, or suggest any Git commands. All Git-related tasks (init, commit, push, pull, branch, merge, clone, etc.) are strictly handled by the human.

⚠️ **DOMAIN:** The correct domain is **tarottalks.app** (NOT .com, .net, .org, or .io). Always use `https://tarottalks.app` for all URLs referencing the live application.

⚠️ **LIVE TESTING ONLY:** All testing happens on the **live production deployment**. Do NOT suggest or request local testing (no `npm run dev`, no localhost). Instead:
- For database migrations: Provide SQL ready to paste into **Supabase SQL Editor**
- For code changes: After implementation, instruct to deploy and test on live site
- Test URLs should point to `https://tarottalks.app/...`

## Useful External Tools

- **X/Twitter Card Validator:** https://www.xcardvalidator.com/
- **Facebook Sharing Debugger:** https://developers.facebook.com/tools/debug/
- **LinkedIn Post Inspector:** https://www.linkedin.com/post-inspector/
