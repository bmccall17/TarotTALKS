/**
 * Test script for Instagram route handler
 * Run with: npx tsx scripts/test-instagram-route.ts
 *
 * NOTE: Run AFTER deployment to live site
 */

// Ensure this is treated as a module
export {};

const BASE_URL = 'https://tarottalks.app';
const TEST_SLUGS = ['the-fool', 'the-magician', 'the-tower'];

async function runTests() {
  let passed = 0;
  let failed = 0;

  console.log('Testing Instagram route handler...\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  for (const slug of TEST_SLUGS) {
    const url = `${BASE_URL}/cards/${slug}/instagram`;
    console.log(`Testing: ${url}`);

    try {
      // Test 1: Route returns 200
      const response = await fetch(url);
      if (response.ok) {
        console.log(`  ✓ Returns 200 OK`);
        passed++;
      } else {
        console.log(`  ✗ Returns ${response.status}`);
        failed++;
        continue;
      }

      // Test 2: Content-Type is image/png
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('image/png')) {
        console.log(`  ✓ Content-Type: image/png`);
        passed++;
      } else {
        console.log(`  ✗ Content-Type: ${contentType}`);
        failed++;
      }

      // Test 3: Response body is not empty
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 10000) {
        // Expect > 10KB for a real image
        console.log(`  ✓ Image size: ${(buffer.byteLength / 1024).toFixed(1)} KB`);
        passed++;
      } else {
        console.log(`  ✗ Image too small: ${buffer.byteLength} bytes`);
        failed++;
      }

      // Test 4: PNG signature check (first 8 bytes)
      const signature = new Uint8Array(buffer.slice(0, 8));
      const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
      const isPng = pngSignature.every((b, i) => signature[i] === b);
      if (isPng) {
        console.log(`  ✓ Valid PNG signature`);
        passed++;
      } else {
        console.log(`  ✗ Invalid PNG signature`);
        failed++;
      }
    } catch (error) {
      console.log(`  ✗ Fetch error: ${error}`);
      failed++;
    }

    console.log(''); // Blank line between cards
  }

  // Test 5: Invalid slug returns appropriate response (not 500)
  console.log(`Testing invalid slug...`);
  try {
    const response = await fetch(`${BASE_URL}/cards/definitely-not-a-real-card-xyz/instagram`);
    if (response.ok) {
      // Should return a fallback image, not crash
      console.log(`  ✓ Invalid slug returns fallback image (${response.status})`);
      passed++;
    } else if (response.status === 404) {
      console.log(`  ✓ Invalid slug returns 404`);
      passed++;
    } else {
      console.log(`  ✗ Invalid slug returns ${response.status}`);
      failed++;
    }
  } catch (error) {
    console.log(`  ✗ Error on invalid slug: ${error}`);
    failed++;
  }

  // Summary
  console.log(`\n========================================`);
  console.log(`Phase 2 Tests: ${passed} passed, ${failed} failed`);
  console.log(`========================================`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
