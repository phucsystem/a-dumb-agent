# AI Agent Frameworks: Quick Reference Card

**Date:** March 2026 | **Updated:** Based on 2025-2026 production benchmarks

---

## Framework Scorecard (At a Glance)

| Framework | Production Ready | Token Efficiency | Multi-Agent | Vendor Lock-In | Best For |
|-----------|------------------|------------------|-------------|----------------|----------|
| **LangGraph** | ✅✅ | ✅✅ (best) | ✅ | Low-Moderate | Complex workflows, scaling |
| **Claude SDK** | ✅✅ | ✅ | ⚠️ (manual) | Low | Single agent, MCP ecosystem |
| **OpenAI SDK** | ✅✅ | ✅ | ✅ (handoffs) | High | Fast MVP, multi-agent coordination |
| **CrewAI** | ✅ | ⚠️ (3× overhead) | ✅ | Low | Demos, role-based teams |
| **AutoGen** | ✅ | ⚠️ | ✅✅ | Low | Scientific workflows, conversation |
| **Mastra** | ✅ | ✅ | ⚠️ | Low | Full-stack TypeScript apps |
| **Pydantic AI** | ✅ | ✅ | ✅ (graphs) | Low | Type-safe, durable, long-running |
| **smolagents** | ⚠️ | ✅ | ✅ | Low | Research, open models |

---

## Tier System (Quick Ranking)

### Tier 1: Production-Proven (400+ Deployments)
- **LangGraph** — Uber, LinkedIn, Cisco, BlackRock, JPMorgan, Klarna (85M users), Elastic
- **CrewAI** — PwC, IBM, Capgemini, NVIDIA (1.4B automations)
- **AutoGen** — Microsoft research, enterprise deployments

### Tier 2: Production-Ready (Vendor-Backed, First-Gen Adoption)
- **Claude SDK** — Anthropic official (Sept 2025)
- **OpenAI SDK** — OpenAI official (March 2025, replaced Swarm)
- **Mastra** — SoftBank, Marsh McLennan, Adobe; $13M seed

### Tier 3: Production-Capable (Growing Adoption)
- **Pydantic AI** — Type-safe agents, durability focus
- **smolagents** — Hugging Face research framework

---

## Token Efficiency (Cost Impact)

| Framework | Tokens/Task | Latency | Notes |
|-----------|------------|---------|-------|
| LangGraph | ~900 | <5 sec | Best-in-class |
| LangChain | ~900 | <5 sec | Similar to LangGraph |
| Pydantic AI | ~1000 | <6 sec | Graph minimizes redundancy |
| smolagents | ~1100 | ~6 sec | Code-first overhead |
| OpenAI SDK | ~1200 | ~2-3 sec | Handoff overhead per transfer |
| AutoGen | ~1500 | ~8 sec | Conversation overhead |
| CrewAI | ~2700 | ~15 sec | **3× LangGraph** (avoid if cost-critical) |

**Bottom Line:** For 50K monthly agent calls, framework choice = $4,700/month difference (LangGraph vs CrewAI)

---

## Decision Tree (Choose Your Framework)

```
START: Which describes your project?

├─ "Single agent, sophisticated reasoning, need control"
│  └─ → Claude SDK
│
├─ "Rapid prototype, need multi-agent handoffs fast"
│  └─ → OpenAI SDK
│
├─ "Complex workflows, scaling to 100+ users, cost matters"
│  └─ → LangGraph
│
├─ "Role-based agent team, sequential workflows, demo phase"
│  └─ → CrewAI
│
├─ "Scientific pipeline, debate/discussion patterns"
│  └─ → AutoGen
│
├─ "Full-stack TypeScript/JavaScript app with agents"
│  └─ → Mastra
│
├─ "Type-safe Python, long-running durability critical"
│  └─ → Pydantic AI
│
└─ "Learning/research, open models preferred"
   └─ → smolagents
```

---

## Architecture Patterns (Quick Reference)

| Pattern | Best Framework | Use Case |
|---------|---|---|
| **Subagents** (supervisor + specialists) | LangGraph, Pydantic AI | Coordinated domain-specific agents |
| **Handoffs** (sequential transfers) | OpenAI SDK, AutoGen | Customer support flows, triage routing |
| **Skills** (dynamic specialization) | Claude SDK, LangGraph | Single agent with many specializations |
| **Router** (parallel dispatch) | LangGraph | Queries across multiple knowledge sources |
| **Hierarchical** (multi-level delegation) | Pydantic AI, Google ADK | Open-ended problem decomposition |

---

## MCP (Model Context Protocol) Support 2025

MCP = Universal standard for agent tooling. Adopted by nearly all frameworks by end of 2025.

| Framework | MCP Support | Status |
|-----------|---|---|
| **Claude SDK** | ✅✅ Native | 10K+ servers available |
| **Pydantic AI** | ✅✅ Native | Durable execution + MCP |
| **smolagents** | ✅✅ Native | Hub integration |
| **LangChain** | ✅ Via adapters | Compatible |
| **Mastra** | ✅ Compatible | Via providers |
| **AutoGen** | ✅ Possible | Requires plugin |
| **CrewAI** | ⚠️ Limited | Would need plugin system |
| **OpenAI SDK** | ⚠️ Proprietary tools | Prefers managed tools |

**Recommendation:** Prioritize MCP-native frameworks for long-term vendor freedom.

---

## Vendor Lock-In Risk

| Framework | Risk | Mitigation |
|-----------|------|-----------|
| **OpenAI SDK** | 🔴 High | Tied to OpenAI models + infrastructure |
| **LangGraph** | 🟡 Moderate | LangChain ecosystem, but open-source |
| **Claude SDK** | 🟢 Low | MCP standard, local execution, multi-provider possible |
| **CrewAI** | 🟢 Low | Independent, model-agnostic |
| **AutoGen** | 🟢 Low | Flexible orchestration, any model |
| **Mastra** | 🟢 Low | **Best multi-provider** (40+) |
| **Pydantic AI** | 🟢 Low | Type standard, open-source |
| **smolagents** | 🟢 Low | Full code access, open-source |

---

## Common Mistakes to Avoid

1. ❌ **Choosing CrewAI for production at scale** — Token inefficiency (3× overhead) makes it uneconomical
2. ❌ **Selecting OpenAI SDK for long-term vendor freedom** — Highest lock-in risk
3. ❌ **Building multi-agent with Claude SDK without orchestration layer** — SDK is single-agent focused; need external coordination
4. ❌ **Ignoring MCP ecosystem** — By 2025, MCP became universal; frameworks without MCP face adoption friction
5. ❌ **Using CrewAI/AutoGen for latency-critical paths** — Token overhead = higher latency (15+ sec vs 2-5 sec)
6. ❌ **Not profiling single-user performance first** — Essential before scaling (per NVIDIA guidance)
7. ❌ **Overlooking observability from start** — LangSmith (LangGraph) + built-in (Mastra, Pydantic) reduce debugging 40%+ later

---

## When to Switch Frameworks

| Situation | From | To | Why |
|-----------|------|----|----|
| Cost overruns at 10K+ monthly calls | CrewAI | LangGraph | 3× token efficiency |
| Scaling beyond 100 concurrent users | CrewAI | LangGraph | Proven production scaling |
| Need on-prem for compliance | OpenAI SDK | Claude SDK | Local execution support |
| Multi-model flexibility needed | OpenAI SDK | Mastra | 40+ provider routing |
| Type safety + durability critical | AutoGen | Pydantic AI | Built-in features |
| Moving from research to production | smolagents | LangGraph or Pydantic | Enterprise observability |

---

## Cost Impact Examples (50K Monthly Agent Calls)

### LangGraph: $4,000/month
```
- Calls: 50K
- Tokens/call: 1,500
- Model cost: $2,500
- Infrastructure (LangSmith): $1,500
- Total: $4,000
```

### CrewAI: $8,700/month
```
- Calls: 50K
- Tokens/call: 4,500 (3× overhead)
- Model cost: $7,500
- Infrastructure: $1,200
- Total: $8,700
```

**Difference:** $4,700/month ($56K/year)

---

## Production Checklist (Any Framework)

- [ ] Profile single-user performance (latency, tokens)
- [ ] Load test at 10, 20, 50+ concurrent users
- [ ] Set up observability (LangSmith, built-in tools, or APM)
- [ ] Implement retry logic with exponential backoff
- [ ] Monitor custom metrics relevant to your use case
- [ ] Plan graceful degradation for LLM failures
- [ ] Test error scenarios (timeout, invalid responses)
- [ ] Measure actual token usage in staging
- [ ] Document failure modes and recovery paths
- [ ] Run cost analysis before scaling to production

---

## Refresh Timeline

- **Q2 2026:** Check for Pydantic AI adoption updates
- **Q3 2026:** Verify MCP ecosystem stability, new framework announcements
- **Q4 2026:** Full rescan (agent ecosystem evolves quickly)

This landscape changes rapidly; revisit decisions annually or when requirements shift.
