#!/bin/bash
# sync-workflows.sh - Portable AI workflow sync utility
#
# Syncs Claude Code commands and Antigravity workflows between projects.
# Use this to bring your workflows to another computer or project.
#
# Usage:
#   ./scripts/sync-workflows.sh <target-directory>
#   ./scripts/sync-workflows.sh --export <output-directory>
#   ./scripts/sync-workflows.sh --import <source-directory>
#
# Examples:
#   ./scripts/sync-workflows.sh ~/projects/OtherProject
#   ./scripts/sync-workflows.sh --export ~/workflow-backup
#   ./scripts/sync-workflows.sh --import ~/workflow-backup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

CLAUDE_COMMANDS="$PROJECT_ROOT/.claude/commands"
AGENT_WORKFLOWS="$PROJECT_ROOT/.agent/workflows"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}!${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

show_help() {
    echo "AI Workflow Sync Utility"
    echo ""
    echo "Usage:"
    echo "  $0 <target-directory>        Sync workflows to target project"
    echo "  $0 --export <output-dir>     Export workflows to a portable directory"
    echo "  $0 --import <source-dir>     Import workflows from a portable directory"
    echo "  $0 --list                    List available workflows"
    echo "  $0 --help                    Show this help message"
    echo ""
    echo "Workflows synced:"
    echo "  - Claude Code commands (.claude/commands/)"
    echo "  - Antigravity workflows (.agent/workflows/)"
}

list_workflows() {
    echo "Available Workflows:"
    echo ""
    echo "Claude Code Commands (.claude/commands/):"
    if [ -d "$CLAUDE_COMMANDS" ]; then
        for f in "$CLAUDE_COMMANDS"/*.md; do
            [ -e "$f" ] && echo "  - $(basename "$f" .md)"
        done
    else
        echo "  (none found)"
    fi
    echo ""
    echo "Antigravity Workflows (.agent/workflows/):"
    if [ -d "$AGENT_WORKFLOWS" ]; then
        for f in "$AGENT_WORKFLOWS"/*.md; do
            [ -e "$f" ] && echo "  - $(basename "$f" .md)"
        done
    else
        echo "  (none found)"
    fi
}

sync_to_target() {
    local TARGET="$1"

    if [ ! -d "$TARGET" ]; then
        print_error "Target directory does not exist: $TARGET"
        exit 1
    fi

    echo "Syncing workflows to: $TARGET"
    echo ""

    # Create directories if needed
    mkdir -p "$TARGET/.claude/commands"
    mkdir -p "$TARGET/.agent/workflows"

    # Sync Claude commands
    if [ -d "$CLAUDE_COMMANDS" ]; then
        for f in "$CLAUDE_COMMANDS"/*.md; do
            if [ -e "$f" ]; then
                cp "$f" "$TARGET/.claude/commands/"
                print_success "Claude: $(basename "$f")"
            fi
        done
    fi

    # Sync Antigravity workflows
    if [ -d "$AGENT_WORKFLOWS" ]; then
        for f in "$AGENT_WORKFLOWS"/*.md; do
            if [ -e "$f" ]; then
                cp "$f" "$TARGET/.agent/workflows/"
                print_success "Antigravity: $(basename "$f")"
            fi
        done
    fi

    echo ""
    print_success "Sync complete!"
}

export_workflows() {
    local OUTPUT="$1"

    mkdir -p "$OUTPUT/claude-commands"
    mkdir -p "$OUTPUT/agent-workflows"

    echo "Exporting workflows to: $OUTPUT"
    echo ""

    # Export Claude commands
    if [ -d "$CLAUDE_COMMANDS" ]; then
        for f in "$CLAUDE_COMMANDS"/*.md; do
            if [ -e "$f" ]; then
                cp "$f" "$OUTPUT/claude-commands/"
                print_success "Exported: $(basename "$f")"
            fi
        done
    fi

    # Export Antigravity workflows
    if [ -d "$AGENT_WORKFLOWS" ]; then
        for f in "$AGENT_WORKFLOWS"/*.md; do
            if [ -e "$f" ]; then
                cp "$f" "$OUTPUT/agent-workflows/"
                print_success "Exported: $(basename "$f")"
            fi
        done
    fi

    # Create a README
    cat > "$OUTPUT/README.md" << 'EOF'
# AI Workflows Export

This directory contains portable AI workflow definitions.

## Contents
- `claude-commands/` - Claude Code slash commands
- `agent-workflows/` - Antigravity workflows

## Installation

### To a project with sync-workflows.sh:
```bash
./scripts/sync-workflows.sh --import /path/to/this/export
```

### Manual installation:
```bash
# Claude Code
mkdir -p .claude/commands
cp claude-commands/*.md .claude/commands/

# Antigravity
mkdir -p .agent/workflows
cp agent-workflows/*.md .agent/workflows/
```

## Available Workflows

### /ship
Sprint close-out and release notes automation.

### /completion-drive
Meta-cognitive assumption control strategy for complex multi-step tasks.
EOF

    echo ""
    print_success "Export complete! See $OUTPUT/README.md for installation instructions."
}

import_workflows() {
    local SOURCE="$1"

    if [ ! -d "$SOURCE" ]; then
        print_error "Source directory does not exist: $SOURCE"
        exit 1
    fi

    echo "Importing workflows from: $SOURCE"
    echo ""

    # Import Claude commands
    if [ -d "$SOURCE/claude-commands" ]; then
        mkdir -p "$CLAUDE_COMMANDS"
        for f in "$SOURCE/claude-commands"/*.md; do
            if [ -e "$f" ]; then
                cp "$f" "$CLAUDE_COMMANDS/"
                print_success "Claude: $(basename "$f")"
            fi
        done
    fi

    # Import Antigravity workflows
    if [ -d "$SOURCE/agent-workflows" ]; then
        mkdir -p "$AGENT_WORKFLOWS"
        for f in "$SOURCE/agent-workflows"/*.md; do
            if [ -e "$f" ]; then
                cp "$f" "$AGENT_WORKFLOWS/"
                print_success "Antigravity: $(basename "$f")"
            fi
        done
    fi

    echo ""
    print_success "Import complete!"
}

# Main
case "${1:-}" in
    --help|-h)
        show_help
        ;;
    --list|-l)
        list_workflows
        ;;
    --export|-e)
        if [ -z "${2:-}" ]; then
            print_error "Please specify an output directory"
            exit 1
        fi
        export_workflows "$2"
        ;;
    --import|-i)
        if [ -z "${2:-}" ]; then
            print_error "Please specify a source directory"
            exit 1
        fi
        import_workflows "$2"
        ;;
    "")
        show_help
        ;;
    *)
        sync_to_target "$1"
        ;;
esac
