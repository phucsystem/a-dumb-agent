# Phase 01: Project Setup

## Context
- [SRD](../../docs/SRD.md) — E-04 Config, NFR-07 Portability
- [plan.md](./plan.md)

## Overview
- **Priority:** P1
- **Status:** Complete
- **Description:** Initialize Node.js project, install dependencies, create configuration files

## Requirements
- FR: N/A (infrastructure)
- NFR-07: Minimal dependencies, Node.js 18+

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Create | Project manifest with scripts |
| `.env` | Create | Local config (gitignored) |
| `.env.example` | Create | Template for other developers |
| `.gitignore` | Create | Ignore node_modules, .env, memory.md |

## Implementation Steps

1. `npm init -y` — initialize project
2. Install dependencies: `npm install express openai dotenv`
3. Add `start` script: `node src/index.js`
4. Create `.env` with variables:
   - `AUTH_TOKEN` — static bearer token
   - `LLM_PROVIDER` — `deepseek` or `openrouter`
   - `LLM_API_KEY` — provider API key
   - `LLM_MODEL` — model ID (e.g., `deepseek-chat`)
   - `LLM_BASE_URL` — provider base URL
   - `MAX_MEMORY_ENTRIES` — max conversation entries in context (default 50)
   - `PORT` — server port (default 3000)
5. Create `.env.example` with placeholder values
6. Create `.gitignore`: `node_modules/`, `.env`, `memory.md`

## Todo
- [x] npm init + install deps
- [x] .env + .env.example
- [x] .gitignore
- [x] Verify `npm start` doesn't error (will fail until index.js exists — that's OK)

## Success Criteria
- `package.json` exists with correct deps
- `.env.example` documents all required variables
- `.gitignore` covers sensitive files
