# OwningCost Event Taxonomy

This document is the canonical reference for what events fire on the OwningCost platform, what they mean, and what parameters they include. Update this whenever the event surface changes.

**Implementation:** all events are defined in `analytics.js`. The module is loaded on every substantive page via a `<script src="analytics.js" defer>` tag in the page `<head>`.

**Privacy:** all events respect the consent.js mechanism. If a user has not consented to analytics, gtag returns silently and no events are sent.

---

## Key events (mark as conversions in GA4 admin)

These six events should be marked as "Key events" in the GA4 admin (Admin → Events → toggle "Mark as key event"). They represent meaningful user actions worth measuring as conversions.

### 1. `calculator_complete`

**Fires when:** a user changes any input in a calculator form (`form.calc`) AND the result element (`.calc__out`) re-renders. Suppressed on initial page-load default render to avoid false positives.

**Parameters:**
- `calc_name` (string) — the URL slug of the calculator page (e.g. `true-monthly-cost-calculator`)
- `page_location` (string) — full pathname

**Why it matters:** Closest signal to "user successfully ran a calculation." Better than a button-click event because it excludes invalid attempts and form-validation errors.

**Implementation:** MutationObserver on `.calc__out` + interaction flag on `form.calc`. Debounced to 1500ms.

---

### 2. `cta_click`

**Fires when:** a user clicks any internal `a.btn`, `a.btn--primary`, or `a.btn--ghost` link. Excludes outbound links (those fire `outbound_click` instead) and excludes calc-internal buttons (which fire `calculator_complete`).

**Parameters:**
- `cta_text` (string) — visible button text, up to 60 chars
- `cta_href` (string) — destination URL
- `cta_location` (string) — page slug where the click happened

**Why it matters:** Tells you which CTAs convert. Critical for measuring homepage flow improvements and category-hub routing effectiveness.

---

### 3. `form_submit`

**Fires when:** any real `<form>` (NOT a calculator form) is submitted. Calculator forms are excluded because they have their own `calculator_complete` event.

**Parameters:**
- `form_name` (string) — form's `name` or `id` attribute, falls back to `unnamed_form`
- `form_action` (string) — form's `action` attribute
- `page_location` (string) — pathname

**Why it matters:** Closes the form funnel measurement. You already have `form_start` from GA4 enhanced measurement (which is noisy but directionally useful); now you have explicit, accurate `form_submit` data.

**Note:** GA4 enhanced measurement also automatically captures `form_submit`, but reliability is poor (one source reports thousands of false submits per day on a sample site). Consider disabling enhanced measurement form tracking in GA4 admin once this custom event is firing reliably.

---

### 4. `scroll_75`

**Fires when:** a user scrolls past 75% of the `<main>` element. Fires at most once per page load.

**Parameters:**
- `page_location` (string) — pathname
- `page_slug` (string) — URL slug

**Why it matters:** Differentiates "loaded and bounced" from "actually read most of the content." Essential metric for evaluating Learn page quality. Most useful when paired with engagement time.

**Note:** GA4 has a built-in `scroll` event at 90% via enhanced measurement. `scroll_75` catches engaged readers who didn't quite finish, which is a more sensitive signal.

---

### 5. `outbound_click`

**Fires when:** a user clicks any link (not just `.btn`) with an `http://` or `https://` URL on a different host.

**Parameters:**
- `link_url` (string) — destination URL
- `link_text` (string) — visible link text, up to 60 chars
- `page_location` (string) — pathname

**Why it matters:** Shows which OwningCost pages successfully send users to take action elsewhere (lender sites, government sites cited, etc.). Useful for evaluating the practical impact of educational content.

---

### 6. `return_visit`

**Fires when:** a known visitor returns within 30 days, at least 30 minutes after their last visit. localStorage-backed.

**Parameters:**
- `days_since_last` (integer) — days since last visit
- `page_slug` (string) — URL slug of landing page on the return visit

**Why it matters:** Best metric for "the site provides ongoing value." A growing return_visit count over time is the cleanest signal of an audience forming.

**Privacy note:** localStorage value is `oc_last_visit` (timestamp). Cleared if user clears site data.

---

## Legacy events (preserved, not key events)

These existed before Session 2 and continue to fire. Useful for specific funnels but not marked as key events.

### `methodology_view`

**Fires when:** a user clicks any link to `methodology.html`, including deep anchors.

**Parameters:**
- `from_page` (string) — page slug where click originated
- `target_anchor` (string) — anchor within methodology, or `(root)`

### `listing_check_run`

**Fires when:** a user clicks the run button on the signature Listing Reality Check tool. Fires alongside `calculator_complete` for that one specific tool, so the LRC funnel is visible in reports.

**Parameters:**
- `page_location` (string) — pathname

### `ai_underlying_click`

**Fires when:** a user clicks through from one of the 6 AI redirect pages (`scenario-assistant`, `listing-analyzer`, etc.) to its underlying calculator.

**Parameters:**
- `ai_page` (string) — source AI page slug
- `target_calc` (string) — destination calc slug
- `link_text` (string) — link text

---

## What's automatically tracked by GA4 (no custom code)

GA4 enhanced measurement provides these for free if enabled in admin:
- `page_view` (always)
- `session_start` (always)
- `first_visit` (always)
- `user_engagement` (always)
- `scroll` (at 90% — overlaps with custom `scroll_75`)
- `click` (outbound — overlaps with custom `outbound_click`)
- `file_download` (auto)
- `video_*` (auto for embedded YouTube)
- `form_start` / `form_submit` (auto — UNRELIABLE, see notes above)

**Recommendation:** disable enhanced measurement form tracking in GA4 admin to avoid duplicate/noisy data. Keep the rest enabled.

---

## How to add a new event

1. Add the event firing code to `analytics.js` in the appropriate section.
2. Document it in this file (event name, when it fires, parameters, why it matters).
3. After deploying, verify in GA4 DebugView before considering it complete.
4. If it's a meaningful conversion, mark it as a key event in GA4 admin.

---

## Maintenance notes

- **Throw safety:** all event firing is wrapped in try/catch. Analytics should never crash the page.
- **gtag readiness:** the `track()` function checks for gtag availability and falls back to pushing into `dataLayer` if not loaded yet.
- **Page slug consistency:** all events that reference the current page use `pageSlug()` which strips `.html` and normalizes `/` to `index`. Use the same function for consistency.

Last updated: Session 2 (May 2026).
