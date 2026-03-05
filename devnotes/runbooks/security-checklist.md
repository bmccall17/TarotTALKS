# Security Checklist Runbook

**Last updated:** Mar 5, 2026

Security posture, known issues, and incident response steps.

---

## Current Security Status

**Baseline scan:** Feb 28, 2026 (Snyk Code + SCA)
**Full report:** `devnotes/snyk-code-scan-2026-02-28.md`

| Category | Status |
|----------|--------|
| Dependencies (SCA) | CLEAN — 111 deps, 0 vulnerabilities |
| Path Traversal (HIGH) | 2 findings — admin API routes |
| Hardcoded Secret (HIGH) | 1 finding — analytics hook |
| DOM XSS (MEDIUM) | 19 findings — admin components |
| Format String (MEDIUM) | 2 findings — share image generator |

All MEDIUM/HIGH findings are in **admin-only code** behind `ADMIN_TOKEN` auth.

---

## Known Unresolved Issues

### HIGH: Path Traversal (2 files)
- `app/api/admin/share-images/save/route.ts:46` — unsanitized input to `writeFile`
- `app/api/admin/talks/route.ts:90` — unsanitized input to `renameSync`
- **Fix:** Validate resolved path stays within allowed directory. Reject `..` sequences.

### HIGH: Hardcoded Secret
- `lib/hooks/useAnalytics.ts:6` — value hardcoded instead of env var
- **Fix:** Move to `NEXT_PUBLIC_ANALYTICS_ID` env var

### HIGH: No Rate Limiting on Admin Login
- Brute-force possible against `ADMIN_TOKEN`
- **Fix:** Upstash Redis rate limiter (5 attempts/min per IP)
- Full implementation plan in `devnotes/CRITICAL_SECURITY_ISSUE_instructions.md`

### CRITICAL: Secrets in Git History
- `.env.local` was committed historically (Supabase JWT, YouTube API key, DB password)
- **Status:** Secrets rotated, but history may not be cleaned
- Full cleanup instructions in `devnotes/CRITICAL_SECURITY_ISSUE_instructions.md`

---

## Secret Rotation Procedure

If a secret is compromised or you suspect exposure:

### 1. Supabase Credentials
1. Supabase Dashboard > Project Settings > API > JWT Settings > Rotate
2. Copy new anon key and service role key
3. Update Vercel env vars: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Update local `.env.local`
5. Redeploy

### 2. Database Password
1. Supabase Dashboard > Project Settings > Database > Reset Password
2. Update connection string in Vercel env vars (`POSTGRES_URL`)
3. Redeploy

### 3. YouTube API Key
1. Google Cloud Console > APIs & Services > Credentials
2. Regenerate key (or create new + delete old)
3. Update Vercel + local env vars
4. Redeploy

### 4. Admin Token
1. Generate new random token: `openssl rand -hex 32`
2. Update Vercel env var: `ADMIN_TOKEN`
3. Update local `.env.local`
4. Redeploy

### After ANY rotation:
- [ ] Verify production still works (hit a few pages)
- [ ] Verify admin login works with new token
- [ ] Check that API calls still authenticate (Supabase, YouTube)

---

## Running a Security Scan

### Snyk Code (SAST — first-party code)
Run via Claude Code MCP tool or CLI:
```bash
snyk code test /home/bam/projects/TarotTALKS
```

### Snyk SCA (dependencies)
```bash
snyk test /home/bam/projects/TarotTALKS
```

### When to scan:
- Before every release (per CLAUDE.md global rule)
- After adding new dependencies
- After a dedicated security hardening sprint

---

## Security Hardening Sprint Checklist

When you have time for a focused security improvement session:

- [ ] Fix path traversal in share-images save and talks routes
- [ ] Move hardcoded secret to env var
- [ ] Implement Upstash Redis rate limiting on admin login
- [ ] Add URL protocol validation to all dynamic `href` attributes in admin
- [ ] Sanitize error message inputs in share image generator
- [ ] Clean secrets from Git history (git-filter-repo)
- [ ] Re-run Snyk scan to verify fixes
- [ ] Add Content Security Policy headers

---

## File Reference

| File | Purpose |
|------|---------|
| `devnotes/CRITICAL_SECURITY_ISSUE_instructions.md` | Full remediation instructions |
| `devnotes/snyk-code-scan-2026-02-28.md` | Baseline scan results |
| `middleware.ts` | Auth enforcement point |
| `app/admin/login/page.tsx` | Admin login UI |
| `lib/hooks/useAnalytics.ts` | Hardcoded secret location |
