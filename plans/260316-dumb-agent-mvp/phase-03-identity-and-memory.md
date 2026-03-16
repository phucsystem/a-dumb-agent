# Phase 03: Identity & Memory Files

## Context
- [SRD](../../docs/SRD.md) — E-02 Soul, E-03 Identity
- [plan.md](./plan.md)

## Overview
- **Priority:** P1
- **Status:** Complete
- **Description:** Create starter identity files (soul.md, identity.md) and README with usage instructions

## Requirements
- FR-05: Identity/soul files define agent personality
- E-02: Soul — personality traits, values, behavioral guidelines
- E-03: Identity — name, role, communication style

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| `soul.md` | Create | Core personality and behavioral rules |
| `identity.md` | Create | Agent name, role, communication style |
| `README.md` | Create | Project overview, setup, usage examples |

## Implementation Steps

### 1. `soul.md`
Create a simple, intentionally "dumb" personality:
- Helpful but not overly smart
- Direct, concise responses
- Honest about limitations
- Slightly playful tone
- No tool use, no planning — just conversation

### 2. `identity.md`
- Name: "Dumb Agent" (or user can customize)
- Role: Test assistant for agentic app development
- Style: Concise, direct, slightly playful

### 3. `README.md`
- Project description (what + why)
- Quick start (install, configure .env, run)
- API reference (POST /chat, GET /health)
- cURL examples
- How to customize identity (edit soul.md, identity.md)
- How memory works (memory.md auto-appended)

## Todo
- [x] Create soul.md
- [x] Create identity.md
- [x] Create README.md with usage docs

## Success Criteria
- soul.md and identity.md provide reasonable default personality
- README covers setup and usage for new developers
- Agent responds with personality consistent with identity files
