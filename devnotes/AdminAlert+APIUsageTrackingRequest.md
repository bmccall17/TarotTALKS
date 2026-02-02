AdminAlert+APIUsageTrackingRequest.md
---

**Admin Alert + API Usage Tracking Request**

I’d like to add API health visibility to the admin panel for **Gemini** and **YouTube**.

Goal: I want to quickly see **when APIs are maxing out**, **how often**, and **how closely they’re tied to actual user intent**, especially Read My Spread usage.

**1. Admin Alerts**

* Show a visible alert (greenlight/redlight) in the admin panel whenever:
  * Gemini API hits a rate limit / quota limit
  * YouTube API hits a rate limit / quota limit

* one altet/light for each API that includes a hover message:
  * Total number of limit hits in the selected time range
  * Timestamp of most recent limit hit
  * estimated time for the limit to reset

**2. API Call Counters**
* Track and store:
  * Total successful Gemini API calls
  * Total successful YouTube API calls
  * Total failed calls due specifically to rate/quota limits
* These should respect the existing time filter (Last 7 days, etc.)

**3. Read My Spread Attribution**
* In the **Read My Spread** section of Behavior Analytics:
  * Show how many CTR clicks resulted in BELOW the total number of CTR "Clicked" count as a breakdown of that count:
    * A Gemini API call
    * A YouTube API call
  * Ideally expressed as:
    * `Read My Spread clicks → Gemini calls (count)`
    * `Read My Spread clicks → YouTube calls (count)`
**4. Implementation Notes (non-prescriptive)**
* Logging can be lightweight (event-based or counters)
* No user-facing changes required
* Admin-only visibility is fine

---
