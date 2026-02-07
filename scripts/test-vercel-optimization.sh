#!/bin/bash
# ============================================================
# Vercel Usage Optimization - Pre/Post Implementation Tests
# ============================================================
# Run BEFORE changes to see current (failing) state.
# Run AFTER changes to verify all fixes applied correctly.
# ============================================================

PASS=0
FAIL=0
TOTAL=0

pass() {
  PASS=$((PASS + 1))
  TOTAL=$((TOTAL + 1))
  echo "  ✅ PASS: $1"
}

fail() {
  FAIL=$((FAIL + 1))
  TOTAL=$((TOTAL + 1))
  echo "  ❌ FAIL: $1"
}

check_revalidate() {
  local file="$1"
  local expected="$2"
  local label="$3"

  if [ ! -f "$file" ]; then
    fail "$label — file not found: $file"
    return
  fi

  if grep -q "export const revalidate = $expected;" "$file"; then
    pass "$label — revalidate = $expected"
  else
    # Show what's actually there
    local actual
    actual=$(grep "revalidate" "$file" 2>/dev/null || echo "(no revalidate export found)")
    fail "$label — expected revalidate = $expected, found: $actual"
  fi
}

check_no_revalidate() {
  local file="$1"
  local label="$2"

  if [ ! -f "$file" ]; then
    fail "$label — file not found: $file"
    return
  fi

  if grep -q "export const revalidate" "$file"; then
    fail "$label — found revalidate (should NOT have one)"
  else
    pass "$label — no revalidate (intentionally uncached)"
  fi
}

check_cache_header() {
  local file="$1"
  local expected_pattern="$2"
  local label="$3"

  if [ ! -f "$file" ]; then
    fail "$label — file not found: $file"
    return
  fi

  if grep -q "$expected_pattern" "$file"; then
    pass "$label"
  else
    local actual
    actual=$(grep "Cache-Control" "$file" 2>/dev/null || echo "(no Cache-Control header found)")
    fail "$label — expected '$expected_pattern', found: $actual"
  fi
}

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Vercel Usage Optimization — Test Suite                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# --------------------------------------------------
# PHASE 1: OG/Twitter Image Route Caching
# --------------------------------------------------
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 1: Cache All Dynamic OG/Twitter Image Routes (24h)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_revalidate \
  "app/cards/[slug]/opengraph-image.tsx" \
  "86400" \
  "cards/[slug]/opengraph-image"

check_revalidate \
  "app/cards/[slug]/twitter-image.tsx" \
  "86400" \
  "cards/[slug]/twitter-image"

check_revalidate \
  "app/talks/[slug]/twitter-image.tsx" \
  "86400" \
  "talks/[slug]/twitter-image"

check_revalidate \
  "app/spreads/[id]/opengraph-image.tsx" \
  "86400" \
  "spreads/[id]/opengraph-image"

check_revalidate \
  "app/spreads/[id]/twitter-image.tsx" \
  "86400" \
  "spreads/[id]/twitter-image"

# Already done — verify it's still there
check_revalidate \
  "app/talks/[slug]/opengraph-image.tsx" \
  "86400" \
  "talks/[slug]/opengraph-image (already done — verify)"

echo ""

# --------------------------------------------------
# PHASE 2: SSR → ISR Page Caching
# --------------------------------------------------
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 2: Switch SSR Pages to ISR (revalidate = 0 → cached)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_revalidate \
  "app/cards/[slug]/page.tsx" \
  "86400" \
  "cards/[slug]/page (24h)"

check_revalidate \
  "app/cards/page.tsx" \
  "86400" \
  "cards/page (24h)"

check_revalidate \
  "app/talks/[slug]/page.tsx" \
  "3600" \
  "talks/[slug]/page (1h)"

check_revalidate \
  "app/talks/page.tsx" \
  "3600" \
  "talks/page (1h)"

check_revalidate \
  "app/themes/[slug]/page.tsx" \
  "86400" \
  "themes/[slug]/page (24h)"

check_revalidate \
  "app/themes/page.tsx" \
  "86400" \
  "themes/page (24h)"

echo ""

# --------------------------------------------------
# PHASE 3: Search API Cache Headers
# --------------------------------------------------
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 3: Search API Cache-Control Header"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_cache_header \
  "app/api/search/route.ts" \
  "s-maxage=60, stale-while-revalidate=300" \
  "search API — CDN caching (s-maxage=60, swr=300)"

echo ""

# --------------------------------------------------
# NEGATIVE TESTS: Instagram routes must NOT be cached
# --------------------------------------------------
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "GUARD RAILS: Instagram routes must stay uncached"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_no_revalidate \
  "app/cards/[slug]/instagram/route.tsx" \
  "cards/[slug]/instagram"

check_no_revalidate \
  "app/cards/[slug]/instagram-feed/route.tsx" \
  "cards/[slug]/instagram-feed"

check_no_revalidate \
  "app/talks/[slug]/instagram/route.tsx" \
  "talks/[slug]/instagram"

check_no_revalidate \
  "app/talks/[slug]/instagram-feed/route.tsx" \
  "talks/[slug]/instagram-feed"

echo ""

# --------------------------------------------------
# SUMMARY
# --------------------------------------------------
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "RESULTS: $PASS/$TOTAL passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAIL -eq 0 ]; then
  echo ""
  echo "🎉 ALL TESTS PASSED — Ready to deploy!"
  echo ""
  exit 0
else
  echo ""
  echo "⚠️  $FAIL test(s) still failing — changes needed."
  echo ""
  exit 1
fi
