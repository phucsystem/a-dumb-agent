---
phase: 6
title: "Docker & Config"
status: pending
effort: 1h
depends_on: [phase-04]
---

# Phase 6: Docker & Config

## Overview
Update Dockerfile, docker-compose.yml, and .env.example for the TypeScript + LangGraph setup. Remove memory volume mounts (no longer file-based). Add build step for TypeScript compilation.

## Context Links
- [plan.md](./plan.md)
- Current: `Dockerfile` (13 lines, node:20-alpine)
- Current: `docker-compose.yml` (memory volume mounts)
- Current: `.env.example`

## Requirements

### Functional
- Docker build compiles TypeScript and runs dist/index.js
- docker-compose works with updated config
- .env.example documents new/changed env vars
- soul.md and identity.md still mounted into container

### Non-functional
- Multi-stage build for smaller production image
- devDependencies not in production image
- Same port (3000), same basic setup

## Architecture

### Updated Dockerfile (multi-stage)
```
Stage 1: build
  - node:20-alpine
  - Copy package.json, install ALL deps (including devDeps for tsc)
  - Copy src/
  - Run tsc

Stage 2: production
  - node:20-alpine
  - Copy package.json, install prod deps only
  - Copy dist/ from build stage
  - Copy soul.md, identity.md
  - CMD ["node", "dist/index.js"]
```

### Updated docker-compose.yml
- Remove: `./memory.md:/app/memory.md` volume mount
- Remove: `./memory:/app/memory` volume mount
- Keep: `./soul.md:/app/soul.md`
- Keep: `./identity.md:/app/identity.md`
- Add: optional `./tsconfig.json` if needed at runtime (shouldn't be)

### Updated .env.example
```env
AUTH_TOKEN=your-long-lived-token-here
LLM_PROVIDER=deepseek
LLM_API_KEY=sk-xxx
LLM_MODEL=deepseek-chat
LLM_BASE_URL=https://api.deepseek.com/v1
MAX_MEMORY_ENTRIES=50
PORT=3000
# Future: POSTGRES_URL for persistent memory (PostgresSaver + PostgresStore)
```

## Related Code Files

### Files to Modify
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `.gitignore` -- add `dist/`

### Files to Delete
- None (memory/ directory can remain but is unused)

## Implementation Steps

1. **Update Dockerfile**
   - Multi-stage build:
     - Stage "build": install all deps, copy src + tsconfig.json, run `npm run build`
     - Stage "production": install prod deps only, copy dist/ from build, copy personality files
   - Keep node:20-alpine base
   - Expose 3000
   - CMD: `["node", "dist/index.js"]`

2. **Update docker-compose.yml**
   - Remove memory-related volume mounts:
     - `./memory.md:/app/memory.md`
     - `./memory:/app/memory`
   - Keep personality file mounts:
     - `./soul.md:/app/soul.md`
     - `./identity.md:/app/identity.md`
   - Keep env_file, ports, restart policy

3. **Update .env.example**
   - Same env vars (no breaking changes)
   - Add comment about future Postgres upgrade path
   - Document LLM_BASE_URL options for different providers

4. **Update .gitignore**
   - Add `dist/`
   - Keep `node_modules/`, `.env`

5. **Test Docker build**
   - `docker build -t dumb-agent .`
   - `docker-compose up` with .env
   - Verify /health endpoint responds
   - Verify /chat works through Docker

## Todo
- [ ] Update Dockerfile with multi-stage TypeScript build
- [ ] Update docker-compose.yml (remove memory mounts)
- [ ] Update .env.example with comments
- [ ] Add dist/ to .gitignore
- [ ] Test docker build succeeds
- [ ] Test docker-compose up works end-to-end

## Success Criteria
- `docker build .` succeeds
- `docker-compose up` starts agent on port 3000
- Health check returns ok
- Chat endpoint works through Docker
- Docker image does not contain devDependencies or src/ (only dist/)
- No memory-related volume mounts in docker-compose

## Risk Assessment
- **Build step adds complexity**: Multi-stage build is standard practice; tsx not needed in production
- **Missing tsconfig in container**: Ensure tsconfig.json is available during build stage but not needed at runtime
- **Personality files**: soul.md and identity.md must be readable at `/app/` in container. Path resolution in identity.ts must use `process.cwd()` or `import.meta.url` relative paths (not `__dirname` which doesn't exist in ESM)
