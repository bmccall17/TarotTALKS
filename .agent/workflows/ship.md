# /ship - Close Sprint & Update SHIP_LOG

## Purpose
Standardize sprint close-out by creating release notes and updating SHIP_LOG.md.

## Usage
```
/ship [optional: version title]
```

If a title is provided, use it. Otherwise, derive a descriptive title from the sprint work.

## Workflow

### Step 1: Determine Version
- Read `devnotes/releases/` directory
- Find highest existing version (e.g., v1.4.1)
- Increment patch version (e.g., → v1.4.2)
- Note: If major features warrant, consider minor version bump

### Step 2: Gather Sprint Context
- Review conversation history for implemented features
- Identify:
  - Files created
  - Files modified
  - Features added
  - Bugs fixed
  - UI/UX improvements

### Step 3: Create Release Notes
Create `devnotes/releases/vX.Y.Z.md` with this structure:

```markdown
# vX.Y.Z - [Title]

**Released:** [Month Day, Year]

## Summary
[1-2 sentence overview of what this release accomplishes]

---

## Features
- [Bulleted list of what was added/changed]
- [Include both user-facing and technical changes]

---

## Files Changed

### New Files
- `path/to/file.ext` - Brief description

### Modified Files
- `path/to/file.ext` - What changed

---

## Testing Checklist
- [ ] [Specific verification items based on changes]
- [ ] Test on https://tarottalks.app
```

### Step 4: Update SHIP_LOG.md
Add entry to BOTH tables in SHIP_LOG.md:

1. **Recent Releases** table (insert after header row, at top of data rows):
```
| [vX.Y.Z](devnotes/releases/vX.Y.Z.md) | Title with Emoji | Mon D, YYYY |
```

2. **All Releases → 1.x Series** table (insert after header row, at top of data rows):
```
| [vX.Y.Z](devnotes/releases/vX.Y.Z.md) | Title with Emoji | Mon D, YYYY |
```

**Date format:** Use abbreviated month (Jan, Feb, Mar, etc.), day without leading zero, full year.

### Step 5: Update package.json
Update the `version` field in `package.json` to match the new release:
- Change `"version": "X.Y.Z-old"` → `"version": "X.Y.Z-new"`
- Note: package.json uses version without the "v" prefix (e.g., `1.4.2` not `v1.4.2`)

### Step 6: Confirm Completion
Report to user:
- **Version:** vX.Y.Z
- **Release notes created:** `devnotes/releases/vX.Y.Z.md`
- **SHIP_LOG.md:** Updated (both tables)
- **package.json:** Version updated
- **Next step:** User handles git commit and tagging

## Key Files
- `SHIP_LOG.md` - Project root, main changelog
- `devnotes/releases/vX.Y.Z.md` - Detailed release notes
- `package.json` - Project manifest (version field)

## Important Notes
- Do NOT run any git commands (per CLAUDE.md restrictions)
- All testing references should point to https://tarottalks.app
- Choose an emoji that reflects the release theme (🚀 launch, 🐛 bugfix, ✨ feature, 🎨 UI, etc.)
