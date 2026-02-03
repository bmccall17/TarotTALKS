# Workflow Commands

This document describes custom slash commands available in this project for Claude Code and Antigravity.

---

## `/ship` - Sprint Close-Out

**Purpose:** Standardizes the release process by creating release notes and updating SHIP_LOG.md.

### Usage
```
/ship [optional: version title]
```

### What It Does
1. **Determines next version** - Scans `devnotes/releases/` to find the highest version and increments
2. **Gathers sprint context** - Reviews conversation for features, fixes, and changes
3. **Creates release notes** - Writes `devnotes/releases/vX.Y.Z.md` with summary, features, files changed
4. **Updates SHIP_LOG.md** - Adds entry to both "Recent Releases" and "All Releases" tables
5. **Updates package.json** - Bumps the version field to match
6. **Reports completion** - Summarizes what was created/updated

### Files Modified
- `SHIP_LOG.md` - Main changelog at repo root
- `devnotes/releases/vX.Y.Z.md` - New release notes file
- `package.json` - Version field updated

### Important
- Does NOT run any git commands (human handles commits/tags)
- All testing references point to https://tarottalks.app

---

## Cross-Platform Setup

### Claude Code
- Location: `.claude/commands/ship.md`
- Invoked via: `/ship` in Claude Code CLI

### Antigravity
- Location: `.agent/workflows/ship.md`
- Same content, **copied** (not symlinked)

### Why Copied, Not Symlinked

Symlinks cause issues across Windows/WSL/Git boundaries:
- GitHub Desktop cannot resolve WSL symlinks
- Cross-filesystem symlinks break portability
- Repos should be self-contained

**Maintenance approach:** When updating a workflow, update both files:
1. `.claude/commands/ship.md` (Claude Code)
2. `.agent/workflows/ship.md` (Antigravity)

Or use a sync script if this becomes tedious.

---

## Adding New Workflow Commands

### For Claude Code
1. Create `.claude/commands/<command-name>.md`
2. Define the workflow steps in markdown
3. Restart Claude Code session to pick up new command

### For Antigravity
1. Create `.agent/workflows/<command-name>.md`
2. Same content format as Claude commands

### Template
```markdown
# /<command> - Short Description

## Purpose
What this command does and why.

## Usage
```
/<command> [args]
```

## Workflow

### Step 1: First Step
- Details

### Step 2: Second Step
- Details

## Key Files
- List of files this command touches
```

---

## Current Commands

| Command | Description | Claude | Antigravity |
|---------|-------------|--------|-------------|
| `/ship` | Sprint close-out & release | `.claude/commands/ship.md` | `.agent/workflows/ship.md` |

---

*Last updated: Feb 3, 2026*
