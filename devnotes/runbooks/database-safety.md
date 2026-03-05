# Database Safety Runbook

**Last updated:** Mar 5, 2026

How to avoid losing data. Written after the Dec 11, 2025 incident where `npm run db:seed` wiped all 78 card full meanings.

---

## The Golden Rule

**`npm run db:seed` is destructive.** It deletes everything and rebuilds from seed files. Seed files are often out of date.

---

## Before Seeding: Export Checklist

Do ALL of these before running `npm run db:seed`:

### 1. Export Talks (script exists)
```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/export-db-to-seed-files.ts
```
Exports to `lib/db/seed-data/talks.ts`. Preserves YouTube metadata, durations, years.

### 2. Export Cards (script may not exist yet)
```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/export-cards-to-seed-files.ts
```
If this script doesn't exist, **DO NOT SEED** until you create it or manually verify the card seed files contain all full meanings (symbolism, advice, journaling prompts, astrology, numerology).

### 3. Verify Completeness
- Cards: Check `lib/db/seed-data/cards.ts` and `cards-minor.ts` have full meanings, not just basics
- Talks: Check `lib/db/seed-data/talks.ts` has youtubeVideoId, durationSeconds, year
- Mappings: Check `lib/db/seed-data/mappings.ts` has all card-talk pairs
- Themes: Check `lib/db/seed-data/themes.ts`

### 4. Only THEN Seed
```bash
npm run db:seed
```

---

## Running SQL Migrations

For schema changes, always use Supabase SQL Editor directly (per CLAUDE.md: no local testing).

### Pre-migration checklist:
- [ ] Read the migration SQL carefully
- [ ] Check if it drops indexes or columns (destructive)
- [ ] For new indexes: verify the column names match actual query patterns
- [ ] For column changes: check for NULL values that would violate new constraints

### Post-migration verification:
- [ ] Run a SELECT on affected tables to confirm data integrity
- [ ] Check `pg_indexes` if you added/changed indexes
- [ ] Hit the relevant admin pages to confirm they still load

### Index verification query:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'your_table_name'
ORDER BY indexname;
```

---

## Key Database Facts

| Fact | Detail |
|------|--------|
| Host | Supabase (Postgres) |
| Connection | pgbouncer on port 6543, `prepare: false` |
| Pool size | `max: 1` per serverless instance |
| Seed script | `lib/db/seed.ts` — **destructive rebuild** |
| ORM | Drizzle |
| Schema | `lib/db/schema.ts` |

---

## Known Data Loss Risks

1. **Seeding without export** — Wipes enhanced data not in seed files
2. **JSONL backups are malformed** — `docs/fullmeaning_*.jsonl` files have JSON syntax errors and markdown fences, cannot be auto-parsed
3. **Card export script may not exist** — `scripts/export-cards-to-seed-files.ts` was identified as needed but may not have been created yet
4. **Seed files drift from DB** — Any field added via admin UI (full meanings, thumbnails) won't be in seed files unless explicitly exported

---

## Recovery Options (If Data Is Lost)

1. **From production DB** — If the live site still has the data, export from there
2. **From Supabase backups** — Check Supabase Dashboard > Database > Backups (Pro plan feature)
3. **Manual re-entry** — Last resort. Use AI to regenerate card meanings
4. **JSONL files** — `docs/fullmeaning_*.jsonl` exist but need manual JSON cleanup first

---

## File Reference

| File | Purpose |
|------|---------|
| `lib/db/seed.ts` | The destructive seed script |
| `lib/db/schema.ts` | Drizzle schema definitions |
| `lib/db/seed-data/cards.ts` | Major Arcana seed data |
| `lib/db/seed-data/cards-minor.ts` | Minor Arcana seed data |
| `lib/db/seed-data/talks.ts` | Talks seed data |
| `lib/db/seed-data/mappings.ts` | Card-talk mappings |
| `lib/db/seed-data/themes.ts` | Theme collections |
| `scripts/export-db-to-seed-files.ts` | Talk export (working) |
| `scripts/export-cards-to-seed-files.ts` | Card export (may not exist) |
| `devnotes/PREVENTING-DATA-LOSS.md` | Full incident report |
