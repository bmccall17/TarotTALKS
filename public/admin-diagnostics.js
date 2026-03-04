/**
 * TarotTALKS Admin Portal Diagnostics
 *
 * Paste this entire script into your browser DevTools console
 * while on any page at https://tarottalks.app/admin/*
 *
 * It tests every admin page and API route, shows:
 *   - Response time (ms)
 *   - HTTP status
 *   - PASS / FAIL / TIMEOUT
 *   - Which specific endpoint is hanging
 *
 * Results are printed as a formatted table + summary.
 */
(async function adminDiagnostics() {
  const BASE = window.location.origin;
  const TIMEOUT_MS = 35000; // 35s — allows for 30s maxDuration + network overhead
  const SLOW_MS = 2000;     // anything over 2s is "slow"

  // ── Styled console output ──
  const styles = {
    header: 'font-size:16px;font-weight:bold;color:#a78bfa;',
    pass:   'color:#4ade80;font-weight:bold;',
    fail:   'color:#f87171;font-weight:bold;',
    slow:   'color:#fbbf24;font-weight:bold;',
    info:   'color:#94a3b8;',
    bold:   'font-weight:bold;color:#e2e8f0;',
  };

//  console.clear();
  console.log('%c🔮 TarotTALKS Admin Diagnostics', styles.header);
  console.log('%c   ' + new Date().toLocaleString(), styles.info);
  console.log('%c   ' + BASE, styles.info);
  console.log('');

  // ── Test definitions ──
  // Each test: { name, url, method, type: 'page'|'api', critical }
  const tests = [
    // === DB Health Check (FIRST — isolates connection issues) ===
    { name: 'DB Health Check',    url: '/api/admin/health',  type: 'api', critical: true },

    // === SSR Pages (fetch the HTML) ===
    { name: 'Dashboard (SSR)',    url: '/admin',            type: 'page', critical: true },
    { name: 'Cards',              url: '/admin/cards',      type: 'page' },
    { name: 'Talks',              url: '/admin/talks',      type: 'page' },
    { name: 'Mappings (SSR)',     url: '/admin/mappings',   type: 'page' },
    { name: 'Themes',             url: '/admin/themes',     type: 'page' },
    { name: 'Spreads',            url: '/admin/spreads',    type: 'page' },
    { name: 'Validation (SSR)',   url: '/admin/validation', type: 'page' },
    { name: 'Signal Deck',        url: '/admin/signal-deck',type: 'page' },
    { name: 'Behavior',           url: '/admin/behavior',   type: 'page' },
    { name: 'Share Images',       url: '/admin/share-images',type: 'page' },
    { name: 'Content Lab',        url: '/admin/content-lab', type: 'page' },
    { name: 'Platform Style',     url: '/admin/platform-style', type: 'page' },

    // === API Routes (JSON responses) ===
    { name: 'API: Behavior (7d)',     url: '/api/admin/behavior?days=7',     type: 'api', critical: true },
    { name: 'API: API Usage (7d)',    url: '/api/admin/api-usage?days=7',    type: 'api', critical: true },
    { name: 'API: Platform Usage',    url: '/api/admin/platform-usage',      type: 'api', critical: true },
    { name: 'API: Validation',        url: '/api/admin/validation',          type: 'api' },
    { name: 'API: Social Shares',     url: '/api/admin/social-shares',       type: 'api' },
    { name: 'API: Unposted Cards',    url: '/api/admin/social-shares/unposted', type: 'api' },
    { name: 'API: Mentions',          url: '/api/admin/mentions',            type: 'api' },
    { name: 'API: Share Images List', url: '/api/admin/share-images/list',   type: 'api' },
    { name: 'API: Spreads Stats',     url: '/api/admin/spreads/stats',       type: 'api' },
    { name: 'API: Platform Style',    url: '/api/admin/platform-style',      type: 'api' },
    { name: 'API: API Logs (yt)',     url: '/api/admin/api-usage/logs?api=youtube&days=7&limit=5', type: 'api' },
    { name: 'API: Brand Config',      url: '/api/admin/content-assistant/brand-config', type: 'api' },
    { name: 'API: Calendar',          url: '/api/admin/content-assistant/calendar', type: 'api' },
  ];

  // ── Run a single test with timeout ──
  async function runTest(test) {
    const url = BASE + test.url;
    const start = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const resp = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': test.type === 'api' ? 'application/json' : 'text/html' },
        credentials: 'include', // send auth cookies
      });

      clearTimeout(timeoutId);
      const ms = Math.round(performance.now() - start);
      const ok = resp.ok; // 2xx status

      // For API routes, try to peek at the response for error messages
      let errorHint = '';
      let healthData = null;
      if (test.type === 'api') {
        try {
          const body = await resp.clone().text();
          const parsed = JSON.parse(body);
          if (!ok) {
            errorHint = parsed.error || parsed.message || '';
          }
          // Capture health check data for detailed output
          if (test.name === 'DB Health Check') {
            healthData = parsed;
          }
        } catch { /* ignore */ }
      }

      // For pages, check if the HTML contains "Dashboard Error" or similar
      if (test.type === 'page' && ok) {
        try {
          const html = await resp.text();
          if (html.includes('Dashboard Error') || html.includes('Error loading') || html.includes('error-boundary')) {
            return { ...test, ms, status: resp.status, ok: false, result: 'RENDER_ERROR', errorHint: 'Page rendered but contains error state' };
          }
        } catch { /* ignore */ }
      }

      return {
        ...test,
        ms,
        status: resp.status,
        ok,
        result: !ok ? 'FAIL' : ms > SLOW_MS ? 'SLOW' : 'PASS',
        errorHint,
        healthData,
      };
    } catch (err) {
      const ms = Math.round(performance.now() - start);
      const isTimeout = err.name === 'AbortError';
      return {
        ...test,
        ms,
        status: 0,
        ok: false,
        result: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        errorHint: isTimeout ? `No response after ${TIMEOUT_MS / 1000}s` : err.message,
      };
    }
  }

  // ── Run all tests sequentially (to avoid overwhelming the server) ──
  console.log('%cRunning ' + tests.length + ' tests sequentially...', styles.info);
  console.log('');

  const results = [];
  for (const test of tests) {
    // Print progress
    console.log('%c  ⏳ Testing: ' + test.name + '...', styles.info);
    const result = await runTest(test);
    results.push(result);

    // Print immediate result
    const icon = result.result === 'PASS' ? '✅' :
                 result.result === 'SLOW' ? '🟡' :
                 result.result === 'TIMEOUT' ? '⏰' :
                 result.result === 'RENDER_ERROR' ? '💥' : '❌';
    const style = result.result === 'PASS' ? styles.pass :
                  result.result === 'SLOW' ? styles.slow : styles.fail;
    const suffix = result.errorHint ? ` — ${result.errorHint}` : '';
    console.log(`%c  ${icon} ${result.name}: ${result.ms}ms (${result.status || 'no response'}) ${result.result}${suffix}`, style);

    // Special: print health check details
    if (result.name === 'DB Health Check' && result.healthData) {
      const h = result.healthData;
      console.log(`%c    DB Status: ${h.status} | Timings: SELECT 1=${h.timings?.select1}ms, COUNT cards=${h.timings?.countCards}ms, date query=${h.timings?.dateQuery}ms`, styles.info);
      console.log(`%c    Env: POSTGRES_URL=${h.env?.hasPostgresUrl}, DATABASE_URL=${h.env?.hasDatabaseUrl}`, styles.info);
      if (h.error) console.log(`%c    Error: ${h.error}`, styles.fail);
    }
  }

  // ── Summary Table ──
  console.log('');
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', styles.header);
  console.log('%c  RESULTS SUMMARY', styles.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', styles.header);

  // Format as console.table
  const tableData = results.map(r => ({
    'Endpoint': r.name,
    'Time (ms)': r.ms,
    'Status': r.status || '—',
    'Result': r.result,
    'Type': r.type.toUpperCase(),
    'Note': r.errorHint || (r.critical ? '(critical)' : ''),
  }));
  console.table(tableData);

  // ── Scorecard ──
  const passed = results.filter(r => r.result === 'PASS').length;
  const slow = results.filter(r => r.result === 'SLOW').length;
  const failed = results.filter(r => !['PASS', 'SLOW'].includes(r.result)).length;
  const criticalFails = results.filter(r => r.critical && !r.ok).length;
  const avgMs = Math.round(results.reduce((sum, r) => sum + r.ms, 0) / results.length);
  const maxResult = results.reduce((a, b) => a.ms > b.ms ? a : b);

  console.log('');
  console.log('%c  SCORECARD', styles.bold);
  console.log(`%c  ✅ Passed:  ${passed}/${results.length}`, styles.pass);
  if (slow > 0) console.log(`%c  🟡 Slow:    ${slow} (>${SLOW_MS}ms)`, styles.slow);
  if (failed > 0) console.log(`%c  ❌ Failed:  ${failed}`, styles.fail);
  if (criticalFails > 0) console.log(`%c  🚨 Critical failures: ${criticalFails}`, styles.fail);
  console.log(`%c  ⏱  Average: ${avgMs}ms`, styles.info);
  console.log(`%c  🐌 Slowest: ${maxResult.name} (${maxResult.ms}ms)`, styles.info);
  console.log('');

  // ── Failures detail ──
  const failures = results.filter(r => !['PASS', 'SLOW'].includes(r.result));
  if (failures.length > 0) {
    console.log('%c  FAILURES:', styles.fail);
    failures.forEach(f => {
      console.log(`%c    ${f.name}: ${f.result} — ${f.errorHint || 'HTTP ' + f.status}`, styles.fail);
      console.log(`%c      URL: ${BASE}${f.url}`, styles.info);
    });
    console.log('');
  }

  // ── Performance breakdown ──
  const slowEndpoints = results.filter(r => r.ms > 1000).sort((a, b) => b.ms - a.ms);
  if (slowEndpoints.length > 0) {
    console.log('%c  SLOW ENDPOINTS (>1000ms):', styles.slow);
    slowEndpoints.forEach(s => {
      const bar = '█'.repeat(Math.min(Math.round(s.ms / 200), 30));
      console.log(`%c    ${bar} ${s.name}: ${s.ms}ms`, styles.slow);
    });
    console.log('');
  }

  // ── Overall verdict ──
  if (failed === 0 && slow === 0) {
    console.log('%c  🎉 ALL CLEAR — Every endpoint is fast and healthy!', styles.pass);
  } else if (failed === 0) {
    console.log('%c  ⚡ FUNCTIONAL — All endpoints respond, but some are slow.', styles.slow);
  } else {
    console.log('%c  🔥 ISSUES DETECTED — ' + failed + ' endpoint(s) failing. See details above.', styles.fail);
  }

  console.log('');
  console.log('%c  Tip: Screenshot this output or copy with right-click → "Copy all messages"', styles.info);
  console.log('%c  Re-run: paste this script again or call adminDiagnostics()', styles.info);
  console.log('');

  // Store globally for re-run
  window.__adminDiagResults = results;
  window.adminDiagnostics = adminDiagnostics;

  return results;
})();
