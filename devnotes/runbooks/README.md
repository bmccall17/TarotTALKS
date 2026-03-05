# Operational Runbooks

Quick-reference guides for diagnosing and maintaining TarotTALKS. Designed for when you're coming back to the project after time away and need to remember how things work.

## Runbooks

| Runbook | When to Use |
|---------|-------------|
| [Admin Performance](admin-performance.md) | Admin pages slow or timing out |
| [Database Safety](database-safety.md) | Before seeding, migrating, or touching the DB |
| [Cost Control](cost-control.md) | Weekly audit, cost spike, or approaching free tier limits |
| [Security Checklist](security-checklist.md) | Security incident, secret rotation, or hardening sprint |
| [Social Share Images](social-share-images.md) | Share images broken, blank, or not rendering |
| [Deployment & Vercel](deployment-vercel.md) | Deploy issues, stale builds, timeout config, caching |

## Quick Links

| What | Where |
|------|-------|
| Admin diagnostics (browser) | `fetch('/admin-diagnostics.js').then(r=>r.text()).then(eval)` |
| DB health check | `https://tarottalks.app/api/admin/health` |
| Vercel dashboard | `https://vercel.com` (check Usage tab) |
| Supabase dashboard | `https://supabase.com/dashboard` |
| Snyk scan baseline | `devnotes/snyk-code-scan-2026-02-28.md` |
| Security instructions | `devnotes/CRITICAL_SECURITY_ISSUE_instructions.md` |
| Data loss prevention | `devnotes/PREVENTING-DATA-LOSS.md` |
