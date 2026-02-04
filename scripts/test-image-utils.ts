/**
 * Test script for lib/image-utils.ts
 * Run with: npx tsx scripts/test-image-utils.ts
 */

import {
  loadFonts,
  getFontConfig,
  generateSparkles,
  normalizeImageUrl,
  IMAGE_SIZES,
  IMAGE_STYLES,
} from '../lib/image-utils';

async function runTests() {
  let passed = 0;
  let failed = 0;

  console.log('Running image-utils tests...\n');

  // Test 1: loadFonts returns valid font buffers
  console.log('Test 1: loadFonts()...');
  const fonts = await loadFonts();
  if (fonts && fonts.regular instanceof ArrayBuffer && fonts.bold instanceof ArrayBuffer) {
    console.log('  ✓ Returns regular and bold ArrayBuffers');
    passed++;
  } else {
    console.log('  ✗ Failed to load fonts');
    failed++;
  }

  // Test 2: getFontConfig with fonts
  console.log('Test 2: getFontConfig() with fonts...');
  const config = getFontConfig(fonts);
  if (config.fontFamily === 'OpenDyslexic' && config.fontOptions.fonts?.length === 2) {
    console.log('  ✓ Returns correct font config with 2 font weights');
    passed++;
  } else {
    console.log('  ✗ Invalid font config');
    console.log(`  Got fontFamily: ${config.fontFamily}, fonts count: ${config.fontOptions.fonts?.length}`);
    failed++;
  }

  // Test 3: getFontConfig without fonts (fallback)
  console.log('Test 3: getFontConfig() fallback...');
  const fallbackConfig = getFontConfig(null);
  if (fallbackConfig.fontFamily.includes('system-ui') && !fallbackConfig.fontOptions.fonts) {
    console.log('  ✓ Falls back to system-ui');
    passed++;
  } else {
    console.log('  ✗ Fallback not working');
    console.log(`  Got fontFamily: ${fallbackConfig.fontFamily}`);
    failed++;
  }

  // Test 4: generateSparkles returns correct count and bounds
  console.log('Test 4: generateSparkles()...');
  const sparkles = generateSparkles({ width: 1080, height: 1080, padding: 25 }, 12345);
  const validSparkles = sparkles.every(
    (s) =>
      s.x >= 25 &&
      s.x <= 1055 &&
      s.y >= 25 &&
      s.y <= 1055 &&
      s.s >= 3 &&
      s.s <= 5 &&
      s.o >= 0.4 &&
      s.o <= 0.9
  );
  if (sparkles.length >= 12 && sparkles.length <= 15 && validSparkles) {
    console.log(`  ✓ Generated ${sparkles.length} sparkles within bounds`);
    passed++;
  } else {
    console.log('  ✗ Sparkles out of bounds or wrong count');
    console.log(`  Count: ${sparkles.length}, all valid: ${validSparkles}`);
    if (!validSparkles) {
      const invalidSparkle = sparkles.find(
        (s) => s.x < 25 || s.x > 1055 || s.y < 25 || s.y > 1055 || s.s < 3 || s.s > 5 || s.o < 0.4 || s.o > 0.9
      );
      console.log(`  Invalid sparkle example:`, invalidSparkle);
    }
    failed++;
  }

  // Test 5: generateSparkles is deterministic with same seed
  console.log('Test 5: generateSparkles() determinism...');
  const sparkles2 = generateSparkles({ width: 1080, height: 1080, padding: 25 }, 12345);
  if (JSON.stringify(sparkles) === JSON.stringify(sparkles2)) {
    console.log('  ✓ Same seed produces identical sparkles');
    passed++;
  } else {
    console.log('  ✗ Not deterministic');
    failed++;
  }

  // Test 6: normalizeImageUrl handles various inputs
  console.log('Test 6: normalizeImageUrl()...');
  const tests = [
    { input: '/images/card.png', expected: 'https://tarottalks.app/images/card.png' },
    { input: 'https://example.com/img.png', expected: 'https://example.com/img.png' },
    { input: 'http://example.com/img.png', expected: 'http://example.com/img.png' },
    { input: null, expected: null },
    { input: undefined, expected: null },
  ];
  let urlTestsPassed = true;
  for (const t of tests) {
    const result = normalizeImageUrl(t.input);
    if (result !== t.expected) {
      console.log(`  ✗ normalizeImageUrl(${t.input}) = ${result}, expected ${t.expected}`);
      urlTestsPassed = false;
    }
  }
  if (urlTestsPassed) {
    console.log('  ✓ All URL normalization cases pass');
    passed++;
  } else {
    failed++;
  }

  // Test 7: IMAGE_SIZES has instagram dimensions
  console.log('Test 7: IMAGE_SIZES.instagram...');
  if (IMAGE_SIZES.instagram.width === 1080 && IMAGE_SIZES.instagram.height === 1080) {
    console.log('  ✓ Instagram size is 1080x1080');
    passed++;
  } else {
    console.log('  ✗ Wrong Instagram dimensions');
    console.log(`  Got: ${IMAGE_SIZES.instagram.width}x${IMAGE_SIZES.instagram.height}`);
    failed++;
  }

  // Bonus Test 8: IMAGE_STYLES contains all required colors
  console.log('Test 8: IMAGE_STYLES constants...');
  const requiredStyles = ['gradient', 'brandGray', 'brandRed', 'textWhite', 'textMuted', 'textAccent', 'keywordBg'];
  const hasAllStyles = requiredStyles.every((key) => key in IMAGE_STYLES);
  if (hasAllStyles) {
    console.log('  ✓ All required style constants present');
    passed++;
  } else {
    console.log('  ✗ Missing style constants');
    const missing = requiredStyles.filter((key) => !(key in IMAGE_STYLES));
    console.log(`  Missing: ${missing.join(', ')}`);
    failed++;
  }

  // Summary
  console.log(`\n========================================`);
  console.log(`Phase 1 Tests: ${passed} passed, ${failed} failed`);
  console.log(`========================================`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
