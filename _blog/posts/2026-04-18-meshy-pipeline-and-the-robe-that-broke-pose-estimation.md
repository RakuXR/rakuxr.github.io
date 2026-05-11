---
title: "The Meshy Pipeline and the Robe That Broke Pose Estimation"
date: 2026-04-18
author: Kevin Griffin
tags: [meshy, asset-pipeline, generative-ai, content-packs, weekend-build]
description: "Six weeks of feeding Meshy.ai through a seven-stage asset pipeline taught the team three things the API docs do not. Robes obscure the silhouette pose estimation needs. Japanese character names crash anything that pipes stdout to a file. And Meshy's remesh endpoint can vanish on you mid-sprint."
series: learning-to-code-with-ai
slug: meshy-pipeline-and-the-robe-that-broke-pose-estimation
---

The asset pipeline is one of the boring-and-load-bearing pieces of the engine. It is the thing that turns a designer's idea ("I want twenty enemies for the tower defense pack") into a folder of textured, rigged, LOD-ed 3D assets the runtime can load. For the last six weeks the pipeline that has been doing that work is Meshy.ai, wired through a seven-stage script that lives at `scripts/meshy_asset_pipeline.py` in the runtime repo.

This Saturday morning the v1 bridge between the Meshy pipeline and the SDK pack format is settled enough that I can write down what we learned. Three things. None of them are in the API docs.

## What the seven stages actually do

In order, on every asset:

1. Text-to-3D generation in preview mode.
2. PBR texture map generation: albedo, metallic, roughness, normal.
3. LOD0 polling and download.
4. Remesh task creation against the v1 API.
5. LOD1 remesh polling and download.
6. Asset file organization on disk.
7. Content pack assembly.

The pipeline drives one asset all the way through, then moves to the next. It does not batch. The reason it does not batch came out of the third lesson below, painfully.

## Lesson one: robes break pose estimation

The Meshy text-to-3D output is fine for a wide range of humanoid designs. Skeleton, soldier, knight, mage with bare arms. The pipeline rigs them, the rig works, the asset ships.

It is not fine for heavily-robed humanoids. The RPG content pack hit this in Sprint 2. Four assets that should have rigged cleanly failed silhouette extraction during pose estimation. Two were expected (slime and wolf_enemy are not humanoids, the pose estimator is not supposed to find arms on them). Two were a surprise: `mage_hero` and `blacksmith`. Both humanoid. Both failed.

The failure mode is the silhouette. Meshy's pose estimator looks at the rendered outline of the model to find limbs. A mage in a long robe has no visible legs in the silhouette, so there are no leg keypoints to anchor a skeleton to. A blacksmith in an apron has no visible torso seam between chest and hips, so the spine joint guesses wrong. The model is fine. The rig is wrong.

The fix in the pipeline is to log the failure, save the un-rigged geometry, and surface a flag in the asset manifest that says "this one needs a manual rig pass." The fix in the prompts is to specify "tight clothing, exposed limbs" in the text prompt for any humanoid that needs autorigging. The longer fix is on Meshy's side and not ours to make.

Across thirteen genres, the failure rate is uneven. Tower defense has one rigging failure in five. Platformer has one in six. RPG has four in eleven, and three of those four are clothing geometry. The lesson generalizes: when a generative model fails, the failure is usually not random, and the failure mode tells you something about the training data the model was built on.

## Lesson two: Unicode crashes anything that pipes stdout to a file

The Oni faction in the RPG pack uses Japanese character names. 風 for wind, 雷 for thunder, 金剛 for diamond. These are the asset names in the Meshy job submissions. The pipeline runs in the background, redirects stdout to a log file, and parses the log later for which assets succeeded.

The first time the Oni assets ran, every single one of them failed. The error was a `UnicodeEncodeError` from Python's stdout. The default encoding on the build machines is ASCII for stdout when stdout is not a TTY. The Japanese characters are not ASCII. The print statement crashes before the asset is even submitted to Meshy.

The fix is one line in the launcher script: `PYTHONIOENCODING=utf-8`. Once that environment variable is set, the print statements work and the assets generate.

The lesson is older than I am: anything that pipes Unicode through a stdout-redirected pipeline needs the encoding set explicitly. Two days lost to a problem that has been documented for twenty years. Logged in the behavior journal. Fixed in the launcher. Not fixed by Meshy because it is not Meshy's problem to fix.

## Lesson three: vendor APIs vanish

Halfway through Sprint 2, the Meshy v2 `/remesh` endpoint started returning 404. Not for a specific asset. For every call.

The remesh stage is what turns LOD0 (high-poly, expensive to render) into LOD1 (low-poly, cheap to render). Without remesh, the assets ship with LOD0 only. They render fine on the developer machines and they kill the frame rate on the AR glasses target.

I do not know whether the endpoint was deprecated, gated behind a higher-tier plan, moved without a redirect, or temporarily down. The Meshy docs still reference it. Calls to it 404. The pipeline cannot wait for the vendor to figure out which it is.

The fix is in `meshy_asset_pipeline.py` at the remesh stage. A try/except around the remesh call. On failure, log the asset as LOD0-only, write that fact into the asset manifest, and continue with the rest of the pipeline. Every asset has LOD0. Some have LOD1. The pack ships either way.

The lesson is the one every project that depends on a vendor API learns eventually: the API you depend on is not yours, and it can change underneath you, and the only defense is graceful degradation. We have it now.

## Where the pipeline is now

Eight of thirteen genres complete. Space shooter, puzzle, card battle, runner, platformer, racing, tower defense, RPG. Five remaining (sports, simulation, sandbox, fighting, MMO-lite) on the queue.

The credit budget is the surprise win. The estimate for Sprint 2 was around 510 credits across both factions of the genre. Actual spend ran 25 to 35 percent below the estimate, consistently. That gives the program enough headroom to push through the remaining five genres without a budget conversation.

The v1 bridge that landed at the start of this month, `scripts/generate_rakupack.py` with twenty-four conformance tests, is what makes this all addressable from the SDK side. A developer using the SDK does not have to know that an asset came out of Meshy versus came out of a hand-modeled pipeline. The pack format is the contract. The Meshy pipeline produces packs. The SDK loads packs.

## Why I am writing this one down

Two reasons.

The first is that the three lessons above are the kind of friction that does not show up in vendor demos and does not show up in marketing pages. Robes and pose estimation. Unicode and stdout. Remesh and 404. If you are evaluating a generative-3D vendor and you read this and you say "that is the kind of thing I would want to know before I committed to it," then the writing has earned its keep.

The second is that the pipeline is now stable enough that the next conversation is not "does Meshy work for us." It is "what do we want the asset library to be." That is a designer conversation, not an engineering one. The engineering side has done its job by getting out of the way.

Eight genres down. Five to go. The pipeline survives a 404. The pipeline survives a Japanese character. The pipeline does not, yet, survive a robe. Saturday well spent.
