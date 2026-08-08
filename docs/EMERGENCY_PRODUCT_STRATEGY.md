# H2O PR — Emergency Product Strategy

## Mission

H2O PR is not a reservoir dashboard. Its primary job during a water emergency is to help a person answer, in this order:

1. **Where can I obtain water now?**
2. **Who can help me in my municipality?**
3. **Is my municipality under a current drought/rationing event?**
4. **What must I do to use the water safely?**
5. Only then: weather, reservoirs, background context and technical detail.

The product is designed for Puerto Rico residents under stress, with special attention to older adults, caregivers, people with disabilities, low-bandwidth users and people who may not be comfortable navigating a conventional app.

## Non-negotiable data rule

H2O PR must never invent a water point, opening hour, service state, rationing schedule, reservoir reading, phone number or provider availability.

Every operational item has one of three public states:

- **CONFIRMED / PERMANENT** — official source identifies it as a standing resource or it has been freshly confirmed for the active incident.
- **RECONFIRM** — the place or number was published by a credible source, but current-day availability has not been confirmed. The interface must show a call-before-you-go action.
- **NOT AVAILABLE** — we do not have a defensible answer. H2O PR routes the resident to the best verified municipal/NMEAD/AAA contact instead of filling the screen with a guess.

Freshness is a product feature. Every operational record should carry `verifiedOn`, `sourceDate`, `lastCheckedAt` and a source URL whenever possible.

## Emergency home screen

The home screen must prioritize four large actions:

- **Encontrar agua** — oasis / distribution points sorted for the selected municipality.
- **Llamar ayuda local** — municipal OMME where verified, NMEAD regional office for every one of the 78 municipalities, and AAA.
- **Hablar con H2O PR** — voice-first interaction for users who cannot or do not want to navigate menus.
- **Conseguir entrega** — clearly labeled private bulk-water and cistern providers, separated from government resources.

Reservoir charts and forecast cards belong below these emergency actions.

## Accessibility and older-adult design

- Spanish-first; English can be added as a secondary language.
- 48px+ primary tap targets.
- High contrast; no color-only status communication.
- Large-text mode saved on device.
- Every telephone number is a one-tap `tel:` action.
- Voice summaries read numbers slowly and identify the municipality before giving instructions.
- No dense maps as the only way to find a resource; every point must also exist as a readable list item with a directions button.
- Avoid tiny dashboard typography, visual noise, decorative charts and jargon.
- Emergency actions must work on a narrow phone with one hand.

## Voice roadmap

### Phase A — browser voice (implemented)

Use Web Speech APIs when the browser supports them:

- speech recognition for simple intents: water, oasis, OMME/help, AAA, supplier/cistern, health/boil-water, weather, municipality names.
- speech synthesis for spoken answers.
- no audio recordings stored by H2O PR.
- text/tap interface remains fully usable when browser voice is unavailable.

### Phase B — real H2O PR voice agent

Deploy a backend voice service at `api.h20pr.com` so users can use a browser realtime conversation and eventually call a Puerto Rico phone number.

The agent must be retrieval-grounded. It may answer only from the verified H2O PR resource registry and live official feeds. For high-risk operational questions it must state freshness, for example:

> “This oasis was published on July 8 but I cannot confirm it is open today. Call 787-… before leaving. Would you like me to repeat the number?”

It must never turn an old distribution point into a claim that the point is active now.

## Backend architecture

GitHub Pages remains useful as a resilient static frontend, but it cannot be the operational backend.

Target architecture:

`h20pr.com` → static emergency UI / PWA

`api.h20pr.com` → H2O PR API, ingestion, community reports, verification and voice

`PostgreSQL/PostGIS` → historical readings, resources, reports, source checks and audit trail

`Redis` → short-lived caching / rate limiting / live incident state

The original PRdata app contains useful patterns to reuse: server-side official-source ingestion, retry/backoff, API normalization, WebSocket/polling fallback and database history. Its simulated fallback values and artificial trends must not be reused.

## Core API model

### Water point

- id
- municipality
- name
- address / coordinates
- status (`confirmed`, `permanent`, `reconfirm`, `closed`)
- source
- sourceDate
- lastCheckedAt
- hours
- accessibility
- container / gallon limitations if published
- confirmation phone
- incident id

### Municipal contact

- municipality
- organization
- function (`water`, `emergency`, `elder-care`, etc.)
- phone
- hours
- source
- verifiedOn

### Community report

- municipality
- barrio / sector
- coarse location only
- report type (`no_water`, `low_pressure`, `water_restored`, `oasis_seen`, etc.)
- timestamp
- verification / corroboration count
- moderation state

Exact household addresses should not be exposed publicly.

## Source hierarchy

Priority order:

1. Municipality / OMME / NMEAD / AAA / Health / NWS / other official government publication.
2. Direct statement by an identified private water provider for its own services.
3. Trusted news source for current incident context when the official source is not readily machine-readable.
4. Community reports, always labeled as community signal and never promoted to an official fact without corroboration.

## Current live-data tracks

- AAA reservoir chart: automated refresh.
- NWS forecasts and weather alerts: browser/API live fetch.
- NMEAD regional contact coverage: all 78 municipalities.
- Municipal OMME/direct water assistance contacts: verified progressively from municipality sources, with current crisis municipalities first.
- Oasis/distribution points: official municipal/AAA publications with explicit freshness labels.
- Private water delivery/cistern providers: direct business sources, separated from government aid.

## Community intelligence

The missing layer in Puerto Rico is often neighborhood-level service reality. H2O PR should accept reports such as “no water in sector X” and “service restored” and cluster them by sector and time.

Rules:

- Reports expire quickly (for example 6–12 hours unless reconfirmed).
- Show counts and recency, not a false binary claim that an entire municipality has or lacks water.
- Rate-limit spam and duplicate submissions.
- Separate official, municipal and community layers visually.
- Keep a moderation/audit trail.

## Distribution-point operations

During an active crisis, a small verification desk is more valuable than another chart. H2O PR should support an admin queue where volunteers/staff can call municipalities and update:

- Is the oasis open right now?
- What hours?
- Exact location?
- Is potable water currently available?
- Are containers required?
- Is there an accessibility accommodation?
- When was this confirmed and by whom/source?

A record older than the incident-defined freshness threshold automatically changes from **CONFIRMED** to **RECONFIRM**.

## Next engineering milestones

1. Finish verified municipal OMME directory, prioritizing every municipality under active rationing.
2. Build the server-side H2O PR API and database at `api.h20pr.com`.
3. Add community service reports with privacy-preserving location and automatic expiration.
4. Add a water-point verification/admin workflow.
5. Add realtime voice agent grounded exclusively in the resource API.
6. Add PWA offline cache of the user's municipality, phone numbers and last verified water points.
7. Add SMS/WhatsApp-friendly share cards for a water point and local emergency contacts.
8. Add incident/rationing calendars only when sourced and machine-readable; never infer a household schedule from municipality alone.

## Success metric

The product succeeds when an older adult can open H2O PR, select or say their municipality, and within seconds either:

- receive a currently confirmed place to obtain water, or
- get one large button that calls the correct local emergency office to ask where water is being distributed today.

Everything else is secondary.
