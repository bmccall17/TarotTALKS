🔴 CRITICAL SECURITY ISSUE instructions
Below are **step-by-step instructions for each 🔴 CRITICAL SECURITY ISSUE** called out in the audit. 

---

## 🔴 CRITICAL #1 — Secrets exposed in Git history

### Goal
1. **Rotate all leaked secrets immediately** (so anything already leaked is useless).
2. **Remove the secrets from Git history** (so new people with repo access can’t recover them later).
3. **Re-deploy with clean env vars.**

### Step-by-step

#### A) Rotate Supabase credentials (do this first)

1. **Rotate your Supabase JWT secret (this effectively rotates API keys).**
   * Supabase Dashboard → **Project Settings** → **API**
   * Find **JWT Settings / JWT Secret** → rotate/regenerate (wording varies by Supabase UI).
   * After this, your **anon key** and **service role key** (JWTs) must be replaced everywhere.
   + "Successfully migrated JWT secret"
   + 
? please review the JWT options in Supabase and advise me
? please help me clean up what's no longer needed in .env.local by reviewing this cleaned version. what can be deleted, what needs to stay exactly as it is, and what needs rotation?
2. **Rotate the database password** (if it was in `.env.local`).
   * Supabase Dashboard → **Project Settings** → **Database**
   * Reset/rotate the **database password**.
   * Update any connection strings (server-side only).

3. **Update your app’s environment variables everywhere**
   * **Local:** update `.env.local` (but do *not* commit it).
   * **Vercel:** Project → **Settings → Environment Variables** → replace:

     * `SUPABASE_SERVICE_ROLE_KEY`
     * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     * `SUPABASE_JWT_SECRET` (if you store it)
     * DB password/connection string vars (if present)

4. **Deploy** (after updating env vars), so production is using rotated values.

> If you have any logs/monitoring that might contain old keys, treat those as exposed too and rotate accordingly.

#### B) Rotate YouTube API key

1. Google Cloud Console → **APIs & Services → Credentials**
2. Find the **YouTube Data API key** used by TarotTALKS
3. **Regenerate** (or create a new key and delete the old one)
4. Update Vercel + local env vars
5. Redeploy

#### C) Remove secrets from Git history (so they’re not recoverable)

> This is separate from rotation. Rotation makes leaked keys useless; history rewrite removes the leak.

**Preferred tool:** `git-filter-repo`

1. **Make sure `.env.local` is ignored going forward**

   * Confirm `.gitignore` contains:

     * `.env.local`
     * and ideally `.env*.local`

2. **Create a fresh clone (recommended)**

   * This reduces the chance of accidentally reintroducing the secret blobs.

3. **Run `git-filter-repo` to delete `.env.local` from *all history***

   ```bash
   # from repo root
   git filter-repo --path .env.local --invert-paths --force
   ```

4. **Force-push rewritten history**

   ```bash
   git push origin --force --all
   git push origin --force --tags
   ```

5. **Invalidate old clones**

   * Anyone who has the repo cloned must **re-clone** (or hard-reset to the rewritten history), otherwise they can accidentally re-push the old history back.

6. **Confirm the secrets are gone**

   * Quick check:

     ```bash
     git log -- .env.local
     ```

     (Should show nothing.)
   * Also search for known secret fragments:

     ```bash
     git grep -n "SUPABASE" $(git rev-list --all) || true
     ```

7. **Treat the repo as “previously compromised”**

   * If the repo was public (or accessible to many), assume the secrets were harvested and keep the rotated versions as the only trusted ones.

---

## 🔴 CRITICAL #2 — No rate limiting on admin login (brute-force possible)

### Goal

Stop unlimited token-guess attempts by enforcing **max 5 attempts/minute per IP** (audit’s recommendation), ideally with a **distributed** store (works on Vercel/serverless).

### Step-by-step (Upstash Redis approach — works well on Vercel)

#### A) Add a distributed rate limiter backend

1. Create an **Upstash Redis** database (via Upstash console or Vercel integration).
2. Add env vars to Vercel (Project → Settings → Environment Variables):

   * `UPSTASH_REDIS_REST_URL`
   * `UPSTASH_REDIS_REST_TOKEN`
3. Also add them to your local `.env.local` for development.

#### B) Install rate limit packages

```bash
npm i @upstash/ratelimit @upstash/redis
```

#### C) Create a limiter utility

Create `lib/security/admin-rate-limit.ts` (name/location flexible):

```ts
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redis = Redis.fromEnv();

export const adminLoginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"), // 5 per minute
  prefix: "ratelimit:admin_login",
});
```

#### D) Enforce it in the **admin token verification path**

Your audit flags **`middleware.ts`** and **`app/admin/login/page.tsx`**. The safest pattern is:

* **Rate limit where the token is verified** (every failed attempt should count).
* Return **HTTP 429** when exceeded.

**Option 1 (most common): rate limit inside `middleware.ts`** (if token verification happens there)

1. In `middleware.ts`, identify the request IP:

   * Prefer `req.ip` if available
   * Fallback to `x-forwarded-for`

2. Apply limiter to the login route **and/or** to any route where token is checked.

Example pattern:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminLoginLimiter } from "./lib/security/admin-rate-limit";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Only rate-limit routes involved in admin auth
  const isAdminAuthRoute =
    pathname === "/admin/login" || pathname.startsWith("/api/admin/");

  if (isAdminAuthRoute) {
    const ip =
      req.ip ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";

    const { success, reset } = await adminLoginLimiter.limit(ip);

    if (!success) {
      const res = NextResponse.json(
        { error: "Too many attempts. Try again shortly." },
        { status: 429 }
      );
      // Optional but helpful for clients
      res.headers.set("Retry-After", String(Math.max(1, Math.floor((reset - Date.now()) / 1000))));
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
```

**Option 2 (cleaner): move verification into a dedicated API route and rate-limit there**
If your login page currently checks the token directly (client-side) or via middleware, it’s easy to centralize:

1. Create `app/api/admin/verify-token/route.ts`
2. Apply the rate limiter **inside** that route
3. Have `/admin/login` submit to it
4. On success, set an **httpOnly cookie** (so you don’t keep sending tokens around)

This is the most robust way to ensure **only failed attempts count** and to avoid leaking details.

#### E) Add exponential backoff (recommended by audit)

Even with a 5/min limit, backoff makes brute forcing miserable:

* After each failure, introduce a growing delay (e.g., 0s, 1s, 2s, 4s, 8s…) stored per IP in Redis.
* Or simpler: use stricter limits like `3/30s` + `10/10m`.

(If you want the simplest version: start with the 5/min limiter above; it already blocks the critical exploit path.)

#### F) Verify behavior

1. Try 6 incorrect token attempts in under a minute
2. Confirm you receive **429** with “Too many attempts…”
3. Confirm it works across deployments/regions (distributed storage is why)

---

If you paste your current `middleware.ts` and how `/admin/login/page.tsx` submits/verifies the token, I can tailor the exact insertion points so you don’t have to guess where the verification is happening.
