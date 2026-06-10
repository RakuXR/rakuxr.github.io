# Robotics Pilot — Outreach List & Templates

Companion outreach material for `robotics.html` (Lane 8-R1, robotics vertical wedge).
Derived from `knowledge-transfer/2026-05-30-session-03/WAVE-8-LANE-R1-ROBOTICS.md`.

**Positioning recap:** RakuAI is the persistent, LLM-queryable spatial-memory layer
(per-facility Gaussian splat + 17 native MCP tools) that robotics stacks plug into.
We do **not** build robots, SLAM, or motion planning. Foundation-model robotics
firms (Skild, Physical Intelligence, Covariant) are **customers/partners, not
competitors**. 90-day pilots are free; the deliverable is a co-marketed case study.

---

## Top 10 named target accounts

| # | Company | Segment | Why they fit | Pilot shape | Warm-intro path |
|---|---------|---------|--------------|-------------|-----------------|
| 1 | **Symbotic** | Warehouse (Walmart-backed) | Largest deployed AMR fleet in retail; persistent scene memory across 40+ DCs is a real pain | Capture 2-3 DCs; MCP for "what changed since last shift" | AWS Activate BD (AWS marquee customer); LinkedIn 2nd-degree via Walmart Labs |
| 2 | **Locus Robotics** | E-commerce fulfillment AMRs | 100+ customer sites, each with quirks; scene memory unifies QA across the fleet | Per-site splat + MCP into their fleet manager | Boston-area robotics network; NVIDIA Inception alumni |
| 3 | **Figure AI** | General-purpose humanoid | OpenAI-tied LLM today but brand is "open to any model" — multi-vendor MCP fits | Capture a BMW Spartanburg cell; MCP via GPT-4o and Claude side-by-side | Cold via Brett Adcock (he replies); NVIDIA Inception (alumnus) |
| 4 | **1X Technologies** | Humanoid (NEO home robot) | Home environments need persistent memory most; privacy demands self-hosted MCP option | Single home capture; "where did I leave my keys" demo | Tencent / OpenAI investor mutuals; Norwegian robotics network |
| 5 | **Apptronik** | Humanoid (Apollo; GXO/Mercedes) | Industrial humanoid in logistics; multi-facility scene memory | Capture one Mercedes line; MCP as "facility brain" overlay | NVIDIA Inception (alumnus); UT Austin robotics alumni |
| 6 | **Agility Robotics (Digit)** | Bipedal logistics (Amazon, GXO) | Already in GXO + Amazon warehouses; complements existing nav stack | Per-facility splat at one GXO site; MCP via Anthropic | Amazon Robotics partner program; AWS Activate BD |
| 7 | **Boston Dynamics Spot ecosystem** *(partners, not BD direct: Levatas, Sully, Energy Robotics)* | Inspection quadruped | Spot generates massive inspection datasets; partners need a queryable layer to sell ROI | Capture inspection site; MCP for "every valve flagged red in Q3" | Spot developer Slack; Levatas direct outreach |
| 8 | **ANYbotics** | Industrial quadruped (oil & gas, mining) | Zurich-based; deployed at BP, Shell, BHP; same "data lake nobody queries" problem | EU pilot at one oil & gas site; MCP for compliance auditing | ETH Zurich robotics network; NVIDIA Inception EMEA alumni |
| 9 | **Berkshire Grey** | Picking + sortation (SoftBank) | Picking systems need to "remember" SKU racking; MCP surfaces anomalies | Capture one sortation cell; MCP into their Vision system | SoftBank Vision Fund mutuals; LinkedIn via former Symbotic staff |
| 10 | **Skild AI** | Foundation model for robotics | Model company, not robot company — needs a canonical scene representation at inference | Co-development: RakuAI splat as input to Skild's policy model; joint paper | Cold via Deepak Pathak (CMU); NVIDIA Inception alumni |

**Stretch (don't lead with):** Tesla Optimus (closed), Waymo (closed), Amazon
Robotics direct (Amazon-internal, won't buy outside tools).

**Delivery-segment adds (from landing page):** Starship Technologies, Serve Robotics.
**Humanoid add:** Unitree.

---

## Buyer personas (who actually signs)

- **Persona A — CTO at a Series B-D humanoid / mobile robotics startup.** Cares about
  shipping a F500 pilot in 6-9 months, burn rate, the next round, hiring perception
  engineers (impossible). Buys anything that removes a 6-month line item without
  LLM lock-in. Reach via NVIDIA Inception network, GTC/AI Summit floor, LinkedIn
  2nd-degree via Anthropic/NVIDIA mutuals.
- **Persona B — Head of Robotics Perception at a warehouse-automation company.**
  Cares about uptime, throughput, perception not regressing on new SKUs. Already
  has SLAM; lacks a clean "what changed in zone B since last shift?" answer. Buys
  drop-in point solutions with a killable 90-day pilot. Reach via ProMat/MODEX,
  AWS re:Invent industrial track, AWS Activate BDs.
- **Persona C — Robotics Engineering Director at an enterprise inspection vendor.**
  Cares about auditable, time-stamped, queryable reports months later. Their robots
  dump terabytes to S3 that never get opened. Buys per-site (their customers pay
  per-site). No firmware changes, no real-time cloud-LLM dependency during runs
  (low/no-connectivity). Reach via Spot developer Slack, ANYbotics partner program,
  Cognite customer base.

---

## Cold-outreach templates

### Template A — Warm intro via mutual connection (~150 words)

> Subject: spatial memory for [Company] robots — quick intro
>
> Hi [Name], [Mutual] suggested I reach out. I'm Kevin at RakuAI (NVIDIA Inception,
> May 2026 cohort). We build the persistent spatial-memory + LLM-query layer that
> sits between your perception stack and your high-level planner — every robot needs
> it, and most teams burn 6-12 months building it in-house. We're not Isaac (Isaac
> handles real-time; we handle the "what did this facility look like yesterday"
> question). Customers integrate via MCP — you keep your existing LLM (Claude, GPT,
> NIM-hosted Llama, your choice), we just expose your facility as a queryable scene.
> 90-day pilots are free; we co-publish the case study via Inception. Would 20 minutes
> next week make sense? Happy to come to [city] if you'd rather meet in person.
> — Kevin Hayes / RakuAI / kevin@rakuai.com

### Template B — NVIDIA Inception alumni (~150 words)

> Subject: Inception alumnus — spatial memory layer adjacent to Isaac
>
> Hi [Name] — fellow Inception (May 2026 cohort). Quick context: RakuAI is the
> persistent spatial-memory + multi-LLM query layer that sits adjacent to Isaac. We
> cover the "what does this facility remember about itself across reboots / shifts /
> weeks" problem that Isaac doesn't natively solve, and we're explicitly multi-LLM
> (Claude, GPT, NIM, your choice via MCP) so you're not locked to one vendor. I noticed
> [Company] is shipping into [logistics / manufacturing / etc.] — we're opening a
> 90-day free pilot program with 3-5 robotics teams and would love [Company] in the
> cohort. Co-marketed case study via Inception channels. Worth a 20-min call?
> — Kevin / RakuAI

### Template C — Cold to a robotics CTO (~150 words)

> Subject: skipping the 12-month "scene memory" build for [Company]
>
> [Name] — cold note, will keep it short. RakuAI is a hosted spatial-memory +
> LLM-query layer for mobile robots. The pitch: every team I've talked to has a
> 6-18 month "build persistent scene memory and wire it to our LLM" task in the
> backlog that nobody wants to own. We do that as a service: per-facility splat
> capture + MCP API your existing LLM (Claude / GPT / open-weights) can query in
> plain English. NVIDIA Inception alumnus, AWS Activate, integration-tested with
> Isaac. Free 90-day pilot, co-published case study. Open to a 20-minute call?
> Happy to send a 90-second demo video first. — Kevin Hayes / kevin@rakuai.com / RakuAI

---

## Honest status sheet (keep customer-facing materials accurate)

- **NVIDIA Inception** — accepted May 2026. ✅
- **NVIDIA Innovation Lab** — application status: applying, **NOT yet granted**. Do not
  claim as approved externally.
- **AWS Activate ($10K)** — under 5-7 day review.
- **Nebius H100 ($150K savings)** — submitted; not needed for v1.
- **Anthropic Claude Startups** — submitted, **NOT approved**. Frame Claude as the
  highest-quality option in the multi-vendor menu, not a co-marketing claim.
- **Microsoft Azure for Startups (via Inception, $5K)** — niche; Azure IoT Edge + ROS.

---

## Lane execution checklist

- [ ] File NVIDIA Innovation Lab application (Inception benefit) — parallelizable
- [ ] Build phone-scan-mocked Talk-to-a-Robot demo video (depends on Lane Demo-TTR)
- [ ] Identify Spot / Digit rental option for real-robot demo (budget $1K-$3K)
- [x] Draft outbound list for top 10 accounts (this doc)
- [ ] Investigate Skild integration partnership via Inception alumni channels
- [ ] Pricing instrumentation in `raku-api` for per-capture + per-MCP-query metering
- [ ] Pilot agreement template (NDA + IP terms + co-marketing clause)
- [x] Honest-status sheet of credits and approvals (above)
