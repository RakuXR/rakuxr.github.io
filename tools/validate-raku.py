#!/usr/bin/env python3
"""
Raku Game File Validator

Validates .raku files against the official schema at rakuai.com/schema.json.
Can also validate against a local schema file.

Usage:
    python3 validate-raku.py game.raku
    python3 validate-raku.py game.raku --schema path/to/schema.json
    python3 validate-raku.py samples/*.raku
    python3 validate-raku.py game.raku --fix
"""

import json
import sys
import os
import re
import argparse
from pathlib import Path

# Embedded minimal schema for offline validation
# Full schema available at https://rakuai.com/schema.json
EMBEDDED_SCHEMA = {
    "required": ["schema_version", "game"],
    "properties": {
        "schema_version": {"type": "string", "enum": ["1.0"]},
        "game": {
            "type": "object",
            "required": ["title", "genre", "template"],
            "properties": {
                "title": {"type": "string"},
                "genre": {
                    "type": "string",
                    "enum": [
                        "shooter", "platformer", "puzzle", "rpg", "racing",
                        "tower-defense", "arena-combat", "survival",
                        "music-rhythm", "custom"
                    ]
                },
                "template": {
                    "type": "string",
                    "enum": [
                        "space-shooter", "tower-defense", "puzzle", "platformer",
                        "arena-combat", "custom-advanced", "racing",
                        "rpg-adventure", "survival", "music-rhythm"
                    ]
                },
                "description": {"type": "string"},
                "max_players": {"type": "integer", "minimum": 1, "maximum": 16}
            }
        },
        "ai": {"type": "object"},
        "entities": {"type": "array"},
        "scenes": {"type": "array"},
        "rendering": {"type": "object"},
        "audio": {"type": "object"},
        "xr": {"type": "object"},
        "ai_disclosure": {
            "type": "object",
            "required": ["live_generated", "pre_generated", "description", "systems"],
            "properties": {
                "live_generated": {"type": "boolean"},
                "pre_generated": {"type": "boolean"},
                "description": {"type": "string"},
                "systems": {"type": "array"},
                "guardrails": {"type": "string"}
            }
        }
    }
}

VALID_GENRES = {
    "shooter", "platformer", "puzzle", "rpg", "racing",
    "tower-defense", "arena-combat", "survival", "music-rhythm", "custom"
}

VALID_TEMPLATES = {
    "space-shooter", "tower-defense", "puzzle", "platformer",
    "arena-combat", "custom-advanced", "racing",
    "rpg-adventure", "survival", "music-rhythm"
}

FREE_TEMPLATES = {
    "space-shooter", "tower-defense", "puzzle", "platformer",
    "racing", "rpg-adventure", "survival", "music-rhythm"
}

PRO_TEMPLATES = {"arena-combat", "custom-advanced"}

VALID_AI_SYSTEMS = {
    "dda", "npc-dialogue", "content-generation", "adaptive-audio",
    "emotional-tracking", "player-profiling", "slm-inference"
}

VALID_POST_PROCESSING = {
    "bloom", "ssao", "ssr", "taa", "fxaa", "dof",
    "motion-blur", "color-grading", "fog"
}

# Common LLM hallucination fields — fields that ChatGPT/Claude/Gemini
# frequently invent that don't exist in the Raku schema
LLM_HALLUCINATED_FIELDS = {
    "game_id", "version", "author", "settings", "gameplay", "controls",
    "ui", "analytics", "assets", "levels", "metadata", "config",
    "physics", "input", "network", "multiplayer", "save_system"
}

# Common wrong schema_version values LLMs produce
WRONG_VERSIONS = {"1.0.0", "2.0", "0.1", "1", "v1.0", "v1"}


class ValidationError:
    def __init__(self, path, message, severity="error", fix_hint=None):
        self.path = path
        self.message = message
        self.severity = severity
        self.fix_hint = fix_hint

    def __str__(self):
        icon = "ERROR" if self.severity == "error" else "WARN"
        line = f"  [{icon}] {self.path}: {self.message}"
        if self.fix_hint:
            line += f"\n         Fix: {self.fix_hint}"
        return line


def detect_encoding_issues(filepath):
    """Check for common encoding problems (BOM, backticks, etc.)."""
    errors = []
    try:
        raw = open(filepath, "rb").read(20)
    except Exception:
        return errors

    # UTF-8 BOM
    if raw[:3] == b'\xef\xbb\xbf':
        errors.append(ValidationError(
            "encoding", "File starts with UTF-8 BOM (byte order mark)",
            fix_hint="Re-save as UTF-8 without BOM. In PowerShell:\n"
                     "         $c = Get-Content file.raku -Raw\n"
                     "         [IO.File]::WriteAllText(\"$PWD\\file.raku\", $c, [Text.UTF8Encoding]::new($false))"
        ))

    # UTF-16 BOM
    if raw[:2] in (b'\xff\xfe', b'\xfe\xff'):
        errors.append(ValidationError(
            "encoding", "File is UTF-16 encoded (not UTF-8)",
            fix_hint="Re-save as UTF-8. In Notepad: Save As > Encoding > UTF-8"
        ))

    # Markdown code fence (```json)
    if raw.lstrip()[:3] == b'```' or raw[:3] == b'`\x60\x60':
        errors.append(ValidationError(
            "format", "File starts with markdown code fence (```). This is a common LLM artifact.",
            fix_hint="Remove the ``` lines from the start and end of the file.\n"
                     "         In PowerShell:\n"
                     "         $lines = Get-Content file.raku | Where-Object { $_ -notmatch '^\\s*```' }\n"
                     "         [IO.File]::WriteAllLines(\"$PWD\\file.raku\", $lines)"
        ))

    # Null bytes (wrong encoding entirely)
    if b'\x00' in raw:
        errors.append(ValidationError(
            "encoding", "File contains null bytes — likely wrong encoding or binary file",
            fix_hint="Re-save as plain UTF-8 text. Do not save as Unicode/UTF-16."
        ))

    return errors


def detect_llm_mistakes(data):
    """Detect common mistakes that LLMs make when generating .raku files."""
    errors = []

    # Wrong schema_version
    sv = data.get("schema_version", "")
    if sv in WRONG_VERSIONS:
        errors.append(ValidationError(
            "schema_version",
            f"Unsupported schema version: '{sv}'. Expected '1.0'",
            fix_hint=f'Change "{sv}" to "1.0" — LLMs often add extra digits.'
        ))

    # Missing game section but has title/genre at top level (common LLM pattern)
    if "game" not in data and ("title" in data or "genre" in data or "template" in data):
        errors.append(ValidationError(
            "game",
            "Missing required 'game' object. Found 'title'/'genre' at the top level instead.",
            fix_hint='Wrap title, genre, template, description inside a "game": { ... } object.\n'
                     '         See: https://rakuai.com/schema.json'
        ))

    # Hallucinated top-level fields
    found_hallucinated = [k for k in data if k in LLM_HALLUCINATED_FIELDS]
    if found_hallucinated:
        fields_str = ", ".join(f'"{f}"' for f in found_hallucinated)
        errors.append(ValidationError(
            "structure",
            f"AI-hallucinated fields detected: {fields_str}. These are not in the Raku schema.",
            "warn",
            fix_hint="Remove these fields. Valid top-level fields are:\n"
                     "         schema_version, game, ai, entities, scenes, rendering, audio, xr, ai_disclosure\n"
                     "         Tip: tell the AI to read https://rakuai.com/schema.json first."
        ))

    # Wrong ai_disclosure format (common: uses "compliance", "uses_player_data", etc.)
    if "ai_disclosure" in data:
        disc = data["ai_disclosure"]
        if isinstance(disc, dict):
            wrong_fields = {"compliance", "uses_player_data", "data_tracked", "privacy_notice"}
            found_wrong = [k for k in disc if k in wrong_fields]
            if found_wrong:
                errors.append(ValidationError(
                    "ai_disclosure",
                    f"Wrong ai_disclosure format. Found non-schema fields: {', '.join(found_wrong)}",
                    "warn",
                    fix_hint="ai_disclosure requires: live_generated (bool), pre_generated (bool),\n"
                             "         description (string), systems (array of: dda, npc-dialogue,\n"
                             "         content-generation, adaptive-audio, emotional-tracking,\n"
                             "         player-profiling, slm-inference)"
                ))

    return errors


def validate_raku_file(filepath):
    """Validate a .raku file and return a list of errors/warnings."""
    errors = []
    filepath = Path(filepath)

    if not filepath.exists():
        return [ValidationError("file", f"File not found: {filepath}")]

    if filepath.suffix != ".raku":
        errors.append(ValidationError("file", f"Expected .raku extension, got '{filepath.suffix}'", "warn"))

    # Check encoding before parsing
    encoding_errors = detect_encoding_issues(filepath)
    if encoding_errors:
        errors.extend(encoding_errors)

    # Parse JSON
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        # Strip BOM if present (attempt recovery)
        if content and content[0] == '\ufeff':
            content = content[1:]

        # Strip markdown fences if present (attempt recovery)
        lines = content.split('\n')
        if lines and lines[0].strip().startswith('```'):
            lines = [l for l in lines if not l.strip().startswith('```')]
            content = '\n'.join(lines)

        data = json.loads(content)
    except json.JSONDecodeError as e:
        error_msg = str(e)
        fix = None

        if "Expecting value: line 1 column 1" in error_msg:
            fix = ("File appears empty or has invisible characters at the start.\n"
                   "         Common causes: BOM encoding, markdown ``` fences, or empty file.\n"
                   "         Try: open in Notepad, select all, copy, paste into a new file.")
        elif "Expecting property name" in error_msg:
            fix = "Check for trailing commas before } or ]. JSON doesn't allow trailing commas."
        elif "Expecting ',' delimiter" in error_msg:
            fix = "Missing comma between fields. Check the line above the error for a missing comma."

        return errors + [ValidationError("json", f"Invalid JSON: {e}", fix_hint=fix)]
    except UnicodeDecodeError:
        return errors + [ValidationError(
            "file", "File is not valid UTF-8 text",
            fix_hint="Re-save as UTF-8. In Notepad: Save As > Encoding > UTF-8"
        )]

    if not isinstance(data, dict):
        return errors + [ValidationError("root", "Root must be a JSON object")]

    # Detect common LLM mistakes first
    llm_errors = detect_llm_mistakes(data)
    errors.extend(llm_errors)

    # Required fields
    if "schema_version" not in data:
        errors.append(ValidationError(
            "schema_version", "Missing required field 'schema_version'",
            fix_hint='Add "schema_version": "1.0" at the top of the JSON object.'
        ))
    elif data["schema_version"] != "1.0":
        # Only add if not already caught by LLM detector
        if not any(e.path == "schema_version" for e in errors):
            errors.append(ValidationError(
                "schema_version",
                f"Unsupported schema version: '{data['schema_version']}'. Expected '1.0'",
                fix_hint='Change to "schema_version": "1.0"'
            ))

    if "game" not in data:
        # Only add if not already caught by LLM detector
        if not any(e.path == "game" for e in errors):
            errors.append(ValidationError(
                "game", "Missing required field 'game'",
                fix_hint='Add a "game" object with title, genre, and template fields.\n'
                         '         Example: "game": { "title": "My Game", "genre": "survival", "template": "survival" }'
            ))
        return errors  # Can't validate further without game section

    game = data["game"]
    if not isinstance(game, dict):
        errors.append(ValidationError("game", "Field 'game' must be an object"))
        return errors

    # Game section
    for field in ["title", "genre", "template"]:
        if field not in game:
            fix = None
            if field == "genre":
                fix = f"Add one of: {', '.join(sorted(VALID_GENRES))}"
            elif field == "template":
                fix = f"Add one of: {', '.join(sorted(VALID_TEMPLATES))}"
            elif field == "title":
                fix = 'Add a title string, e.g. "title": "My Awesome Game"'
            errors.append(ValidationError(f"game.{field}", f"Missing required field 'game.{field}'", fix_hint=fix))

    if "title" in game and (not isinstance(game["title"], str) or len(game["title"]) == 0):
        errors.append(ValidationError("game.title", "Title must be a non-empty string"))
    elif "title" in game and len(game["title"]) > 128:
        errors.append(ValidationError("game.title", f"Title too long ({len(game['title'])} chars). Maximum is 128."))

    if "genre" in game and game["genre"] not in VALID_GENRES:
        from difflib import get_close_matches
        suggestion = get_close_matches(game["genre"], VALID_GENRES, n=1, cutoff=0.5)
        fix = f'Did you mean "{suggestion[0]}"?' if suggestion else f"Valid genres: {', '.join(sorted(VALID_GENRES))}"
        errors.append(ValidationError("game.genre", f"Invalid genre '{game['genre']}'.", fix_hint=fix))

    if "template" in game and game["template"] not in VALID_TEMPLATES:
        from difflib import get_close_matches
        suggestion = get_close_matches(game["template"], VALID_TEMPLATES, n=1, cutoff=0.5)
        fix = f'Did you mean "{suggestion[0]}"?' if suggestion else f"Valid templates: {', '.join(sorted(VALID_TEMPLATES))}"
        errors.append(ValidationError("game.template", f"Invalid template '{game['template']}'.", fix_hint=fix))

    if "max_players" in game:
        mp = game["max_players"]
        if not isinstance(mp, int) or mp < 1 or mp > 16:
            errors.append(ValidationError("game.max_players", "max_players must be integer 1-16"))
        elif mp > 1 and game.get("template") in FREE_TEMPLATES:
            errors.append(ValidationError("game.max_players", f"Multiplayer (max_players={mp}) requires Pro tier template", "warn"))

    # AI section
    if "ai" in data:
        ai = data["ai"]
        if isinstance(ai, dict):
            if "target_flow_state" in ai:
                tfs = ai["target_flow_state"]
                if not isinstance(tfs, (int, float)) or tfs < 0 or tfs > 1:
                    errors.append(ValidationError(
                        "ai.target_flow_state", "Must be a number between 0.0 and 1.0",
                        fix_hint="Recommended: 0.6-0.7 for most games. Lower = easier, higher = harder."
                    ))

            if "profiler_mode" in ai:
                if ai["profiler_mode"] not in ("adaptive", "fixed", "learning"):
                    errors.append(ValidationError(
                        "ai.profiler_mode",
                        f"Invalid profiler_mode '{ai['profiler_mode']}'.",
                        fix_hint='Valid modes: "adaptive" (recommended), "fixed", or "learning"'
                    ))

    # Entities section
    if "entities" in data:
        if not isinstance(data["entities"], list):
            errors.append(ValidationError("entities", "Must be an array"))
        else:
            for i, entity in enumerate(data["entities"]):
                if not isinstance(entity, dict):
                    errors.append(ValidationError(f"entities[{i}]", "Each entity must be an object"))
                elif "type" not in entity:
                    errors.append(ValidationError(
                        f"entities[{i}]", "Missing required field 'type'",
                        fix_hint='Every entity needs a "type" string, e.g. "type": "player"'
                    ))

    # Scenes section
    if "scenes" in data:
        if not isinstance(data["scenes"], list):
            errors.append(ValidationError("scenes", "Must be an array"))
        else:
            scene_count = len(data["scenes"])
            template = game.get("template", "")
            if template in FREE_TEMPLATES and scene_count > 3:
                errors.append(ValidationError(
                    "scenes",
                    f"Free tier allows max 3 scenes (found {scene_count}). Use Pro template for up to 10.",
                    "warn"
                ))
            elif scene_count > 10:
                errors.append(ValidationError("scenes", f"Maximum 10 scenes allowed (found {scene_count})"))

            for i, scene in enumerate(data["scenes"]):
                if isinstance(scene, dict) and "name" not in scene:
                    errors.append(ValidationError(
                        f"scenes[{i}]", "Missing required field 'name'",
                        fix_hint='Every scene needs a "name" string, e.g. "name": "Main Menu"'
                    ))

    # Rendering section
    if "rendering" in data:
        r = data["rendering"]
        if isinstance(r, dict) and "post_processing" in r:
            if isinstance(r["post_processing"], list):
                for pp in r["post_processing"]:
                    if pp not in VALID_POST_PROCESSING:
                        from difflib import get_close_matches
                        suggestion = get_close_matches(pp, VALID_POST_PROCESSING, n=1, cutoff=0.5)
                        fix = f'Did you mean "{suggestion[0]}"?' if suggestion else f"Valid effects: {', '.join(sorted(VALID_POST_PROCESSING))}"
                        errors.append(ValidationError("rendering.post_processing", f"Unknown effect '{pp}'.", fix_hint=fix))

    # AI Disclosure section
    if "ai_disclosure" not in data:
        errors.append(ValidationError(
            "ai_disclosure",
            "Missing 'ai_disclosure' section. Required for Steam/platform compliance.",
            "warn",
            fix_hint='Add an ai_disclosure object. Minimal example:\n'
                     '         "ai_disclosure": {\n'
                     '           "live_generated": true, "pre_generated": false,\n'
                     '           "description": "AI adjusts difficulty based on performance.",\n'
                     '           "systems": ["dda"]\n'
                     '         }'
        ))
    else:
        disc = data["ai_disclosure"]
        if isinstance(disc, dict):
            for field in ["live_generated", "pre_generated", "description", "systems"]:
                if field not in disc:
                    errors.append(ValidationError(
                        f"ai_disclosure.{field}",
                        f"Missing required field '{field}'",
                        fix_hint=f"See https://rakuai.com/schema.json for ai_disclosure format"
                    ))

            if "systems" in disc and isinstance(disc["systems"], list):
                for sys_name in disc["systems"]:
                    if sys_name not in VALID_AI_SYSTEMS:
                        from difflib import get_close_matches
                        suggestion = get_close_matches(sys_name, VALID_AI_SYSTEMS, n=1, cutoff=0.4)
                        fix = f'Did you mean "{suggestion[0]}"?' if suggestion else f"Valid systems: {', '.join(sorted(VALID_AI_SYSTEMS))}"
                        errors.append(ValidationError("ai_disclosure.systems", f"Unknown AI system '{sys_name}'.", fix_hint=fix))

    # Unknown top-level keys
    valid_keys = {"schema_version", "game", "ai", "entities", "scenes", "rendering", "audio", "xr", "ai_disclosure"}
    for key in data:
        if key not in valid_keys:
            if key in LLM_HALLUCINATED_FIELDS:
                continue  # Already reported by LLM detector
            errors.append(ValidationError(
                key, f"Unknown top-level field '{key}'", "warn",
                fix_hint=f"Valid top-level fields: {', '.join(sorted(valid_keys))}"
            ))

    return errors


def auto_fix_file(filepath):
    """Attempt to auto-fix common issues in a .raku file."""
    filepath = Path(filepath)
    if not filepath.exists():
        print(f"  File not found: {filepath}")
        return False

    try:
        raw = open(filepath, "rb").read()
    except Exception as e:
        print(f"  Cannot read file: {e}")
        return False

    fixed = False
    content = raw

    # Strip BOM
    if content[:3] == b'\xef\xbb\xbf':
        content = content[3:]
        print("  Fixed: Removed UTF-8 BOM")
        fixed = True

    text = content.decode("utf-8", errors="replace")

    # Strip markdown fences
    lines = text.split('\n')
    new_lines = [l for l in lines if not l.strip().startswith('```')]
    if len(new_lines) < len(lines):
        text = '\n'.join(new_lines)
        print(f"  Fixed: Removed {len(lines) - len(new_lines)} markdown fence line(s)")
        fixed = True

    # Try parsing
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        print(f"  Cannot parse JSON after cleanup: {e}")
        if fixed:
            # Write what we've cleaned so far
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(text)
            print(f"  Wrote partial fixes to {filepath}")
        return fixed

    # Fix schema_version
    if data.get("schema_version") in WRONG_VERSIONS:
        old = data["schema_version"]
        data["schema_version"] = "1.0"
        print(f'  Fixed: schema_version "{old}" -> "1.0"')
        fixed = True

    # Wrap bare title/genre/template into game object
    if "game" not in data and any(k in data for k in ("title", "genre", "template")):
        game_obj = {}
        for k in ("title", "genre", "template", "description", "max_players"):
            if k in data:
                game_obj[k] = data.pop(k)
        data["game"] = game_obj
        print(f"  Fixed: Wrapped title/genre/template into 'game' object")
        fixed = True

    # Remove hallucinated fields
    removed = []
    for k in list(data.keys()):
        if k in LLM_HALLUCINATED_FIELDS:
            del data[k]
            removed.append(k)
    if removed:
        print(f"  Fixed: Removed hallucinated fields: {', '.join(removed)}")
        fixed = True

    if fixed:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"  Wrote fixed file to {filepath}")

    return fixed


def main():
    parser = argparse.ArgumentParser(
        description="Validate .raku game files against the RakuAI schema",
        epilog="Full schema: https://rakuai.com/schema.json"
    )
    parser.add_argument("files", nargs="+", help=".raku files to validate")
    parser.add_argument("--strict", action="store_true", help="Treat warnings as errors")
    parser.add_argument("--quiet", action="store_true", help="Only show errors, not file summaries")
    parser.add_argument("--fix", action="store_true", help="Attempt to auto-fix common issues (BOM, fences, wrong version)")

    args = parser.parse_args()

    total_errors = 0
    total_warnings = 0
    total_files = 0
    total_fixed = 0

    for filepath in args.files:
        total_files += 1

        if args.fix:
            print(f"\n{'=' * 60}")
            print(f"  {filepath} (auto-fix)")
            print(f"{'=' * 60}")
            if auto_fix_file(filepath):
                total_fixed += 1
                print(f"\n  Re-validating...")

        results = validate_raku_file(filepath)

        file_errors = [r for r in results if r.severity == "error"]
        file_warnings = [r for r in results if r.severity == "warn"]

        if not args.quiet or file_errors or file_warnings:
            print(f"\n{'=' * 60}")
            print(f"  {filepath}")
            print(f"{'=' * 60}")

        if not file_errors and not file_warnings:
            if not args.quiet:
                print(f"  PASS - Valid .raku file")
        else:
            for r in results:
                print(str(r))

        total_errors += len(file_errors)
        total_warnings += len(file_warnings)

    # Summary
    print(f"\n{'=' * 60}")
    summary = f"  Summary: {total_files} file(s) checked"
    if args.fix and total_fixed:
        summary += f"  |  {total_fixed} fixed"
    print(summary)
    print(f"  Errors: {total_errors}  |  Warnings: {total_warnings}")

    if total_errors > 0 and not args.fix:
        print(f"\n  Tip: Run with --fix to auto-repair common issues")
        print(f"  Tip: Tell your AI to read https://rakuai.com/schema.json first")

    print(f"{'=' * 60}")

    if total_errors > 0 or (args.strict and total_warnings > 0):
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
