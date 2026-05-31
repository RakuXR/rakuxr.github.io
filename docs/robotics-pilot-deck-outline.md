# Robotics Pilot — Slide Deck Outline

Companion pitch-deck outline for the robotics vertical wedge (Lane 8-R1).
Pairs with `robotics.html` and `robotics-pilot-outreach.md`. ~12 slides, ~15 min.

---

1. **Title** — RakuAI: the spatial memory your robots query in plain English.
   NVIDIA Inception member (May 2026). kevin@rakuai.com.

2. **The problem** — Every mobile robot needs (a) persistent spatial memory that
   survives reboots/shifts/updates, and (b) an LLM that can reason about it in plain
   English. Building either in-house = 6-18 engineer-months, then maintained forever.

3. **Where we sit in the stack** — ABOVE perception (we consume images/depth/poses),
   BELOW task planning (we serve the planner's LLM). The scene-memory + scene-QA layer.
   Diagram: perception → [RakuAI] → planner.

4. **What we do NOT build** — SLAM (cuVSLAM, ORB-SLAM3, RTAB-Map), motion planning
   (Nav2, MoveIt, OMPL), hardware, sim engines (Isaac/Gazebo/MuJoCo/RoboMaker),
   action-policy models (Skild/PI/Covariant). Focus is the pitch.

5. **The wedge** — A per-facility Gaussian splat that lives forever + an MCP API any
   LLM can query. Sold per-capture and per-query, hosted. The moat: LLM is NOT
   vendor-locked.

6. **How it works** — MCP-from-robot diagram. Robot/planner → on-robot (Jetson Orin)
   or cloud MCP client → RakuAI MCP (17 native tools) → raku-runtime → structured
   answer { object_id, pose, changed_at, confidence }.

7. **Live query examples** — "what's blocking aisle 7?", "did the pallet move since
   Tuesday?", "is there a person near the charging dock?", "show me every valve
   flagged red in Q3."

8. **Segments & targets** — Warehouse (Symbotic, Locus, Fetch), Humanoid (Figure, 1X,
   Apptronik, Agility, Unitree), Delivery (Starship, Serve), Inspection (Spot
   ecosystem, ANYbotics). Lead warehouse for revenue; humanoid for visibility.

9. **The ROI math** — Status quo: $250K-$1.2M to build in-house + maintenance forever.
   With RakuAI: $0 engineer-months, $0.50-$2.00/capture, cents/query, hosting included.
   Net year-1 savings: $250K-$1M.

10. **The partner stack** — NVIDIA Isaac (complementary), Cosmos (synthetic data),
    Omniverse (digital twin via splat export), NIM (multi-vendor LLM), Brev + Jetson
    Orin (Inception discount), DLI (50% off training), Innovation Lab (office hours —
    *applying, not granted*). AWS RoboMaker + G5/G6e + Greengrass.

11. **The 90-day free pilot** — Wks 1-2 free capture + MCP relay live. Wks 3-8
    integration support + Innovation Lab office hours. Wks 9-12 ROI report + joint
    co-marketed case study. Conversion: per-facility license OR per-capture + per-query.

12. **Honest status & ask** — Credit status sheet (Inception ✅, AWS Activate in review,
    Anthropic NOT approved, Innovation Lab applying). Ask: 20-minute call; pick a
    facility for a free pilot. Foundation-model robotics firms = customers, not
    competitors.

---

## Honesty guardrails for the deck

- Never claim NVIDIA Innovation Lab is granted (it is "applying").
- Never claim Anthropic Claude Startups co-marketing (submitted, not approved).
- Frame Skild / Physical Intelligence / Covariant as partners/customers.
- If a prospect already has a happy persistent-memory + LLM-bridge stack, there is no
  sale — say so.
