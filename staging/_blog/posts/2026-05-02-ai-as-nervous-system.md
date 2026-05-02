---
title: "AI as Nervous System, Not AI as Factory"
date: 2026-05-02
author: Kevin Griffin
tags: [architecture, positioning, ai-native, spatial-computing]
description: "Most engines that say 'AI-native' in 2026 mean they bolted on a chat panel. RakuAI is built differently — AI is a runtime primitive, not a feature next to the engine."
series: learning-to-code-with-ai
slug: ai-as-nervous-system-not-ai-as-factory
---

> Placeholder — Kevin will paste the final post body here before merge.

This is the published location for the post **AI as Nervous System, Not AI as Factory**.
The MVP scaffold around it (index, series landing, RSS, OG tags, prev/next, syntax
highlighting) is ready. Replace this body with the final Markdown.

## What goes here

A short orientation paragraph for readers who land on this page mid-series, then the
main argument. Code blocks like the one below render with build-time syntax highlighting
(Pygments) — no runtime JS:

```python
# Example: AI as a runtime primitive, not a panel
def step(world, agents):
    for agent in agents:
        intent = agent.brain.observe(world)   # AI is in the loop
        world.apply(agent.act(intent))
    return world
```

Inline `code` and **emphasis** also pick up the article styles. Links look
[like this](https://rakuai.com/), and the typography targets long-form reading: serif
body, 19px, generous line height, 680px column.
