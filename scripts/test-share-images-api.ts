/**
 * Test script for share-images API with Instagram support
 * Run with: npx tsx scripts/test-share-images-api.ts
 *
 * NOTE: Run AFTER deployment to live site
 */

// Ensure this is treated as a module
export {};

const BASE_URL = 'https://tarottalks.app';

async function runTests() {
  let passed = 0;
  let failed = 0;

  console.log('Testing share-images API...\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  // Test 1: GET returns instagram array in response for cards
  console.log('Test 1: GET /api/admin/share-images/save?category=cards...');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/share-images/save?category=cards`);
    const data = await response.json();

    if ('instagram' in data && Array.isArray(data.instagram)) {
      console.log(`  ✓ Response includes instagram array (${data.instagram.length} saved)`);
      passed++;
    } else {
      console.log(`  ✗ Response missing instagram array`);
      console.log(`  Got keys: ${JSON.stringify(Object.keys(data))}`);
      failed++;
    }

    // Also verify opengraph and twitter still present
    if ('opengraph' in data && 'twitter' in data) {
      console.log(`  ✓ Response still includes opengraph and twitter arrays`);
      passed++;
    } else {
      console.log(`  ✗ Missing opengraph or twitter arrays`);
      failed++;
    }
  } catch (error) {
    console.log(`  ✗ Fetch error: ${error}`);
    failed += 2;
  }

  // Test 2: Verify response structure for talks category
  console.log('\nTest 2: GET /api/admin/share-images/save?category=talks...');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/share-images/save?category=talks`);
    const data = await response.json();

    if ('instagram' in data && Array.isArray(data.instagram)) {
      console.log(`  ✓ Talks response includes instagram array`);
      passed++;
    } else {
      console.log(`  ✗ Talks response missing instagram array`);
      failed++;
    }
  } catch (error) {
    console.log(`  ✗ Fetch error: ${error}`);
    failed++;
  }

  // Test 3: Verify array types are correct
  console.log('\nTest 3: Verify array contents are strings...');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/share-images/save?category=cards`);
    const data = await response.json();

    const allArraysValid =
      data.opengraph.every((item: unknown) => typeof item === 'string') &&
      data.twitter.every((item: unknown) => typeof item === 'string') &&
      data.instagram.every((item: unknown) => typeof item === 'string');

    if (allArraysValid) {
      console.log(`  ✓ All arrays contain strings (slugs)`);
      passed++;
    } else {
      console.log(`  ✗ Arrays contain non-string values`);
      failed++;
    }
  } catch (error) {
    console.log(`  ✗ Fetch error: ${error}`);
    failed++;
  }

  // Summary
  console.log(`\n========================================`);
  console.log(`Phase 3 Tests: ${passed} passed, ${failed} failed`);
  console.log(`========================================`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
