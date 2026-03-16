---
title: "Dumb Agent MVP"
description: "API-only agent with LLM responses, file-based memory, and static identity"
status: completed
priority: P1
effort: 3h
branch: main
tags: [backend, api, llm]
created: 2026-03-16
completed: 2026-03-16
---

# Dumb Agent MVP

## Overview

Build a minimal Node.js + Express API agent that responds to messages using DeepSeek/OpenRouter LLM, authenticates via static bearer token, persists memory to `memory.md`, and loads personality from static `.md` files.

## Context

- [SRD](../../docs/SRD.md) — Requirements (FR-01 to FR-07)
- [UI Spec](../../docs/UI_SPEC.md) — API interface specification
- [Lean Analysis](../reports/lean-20260316-dumb-agent-mvp.md)

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Project Setup | Complete | 30m | [phase-01](./phase-01-project-setup.md) |
| 2 | Core Implementation | Complete | 2h | [phase-02-core-implementation](./phase-02-core-implementation.md) |
| 3 | Identity & Memory Files | Complete | 30m | [phase-03-identity-and-memory.md](./phase-03-identity-and-memory.md) |

## Dependencies

- Node.js 18+ runtime
- npm packages: `express`, `openai` (OpenAI-compatible SDK), `dotenv`
- DeepSeek or OpenRouter API key

## Architecture

```
project root/
├── src/
│   ├── index.js          # Express server + routes
│   ├── llm.js            # LLM client (OpenAI-compatible)
│   ├── memory.js         # Read/write memory.md
│   └── identity.js       # Load soul.md + identity.md
├── soul.md               # Agent personality
├── identity.md           # Agent name/role/style
├── memory.md             # Auto-generated conversation log
├── .env                  # Config (token, API key, provider)
├── .env.example          # Template
├── package.json
└── README.md
```
