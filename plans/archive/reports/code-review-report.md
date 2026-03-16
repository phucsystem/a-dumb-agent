# Code Review Report — a-dumb-agent

**Date:** 2026-03-16
**Reviewer:** code-reviewer
**Scope:** src/index.js, src/llm.js, src/memory.js, src/identity.js
**LOC:** ~110 across 4 files
**Focus:** Security, error handling, correctness, code quality

---

## Overall Assessment

Clean, minimal codebase that faithfully follows YAGNI/KISS. Structure is logical, files are short and focused. A handful of security and correctness issues need attention — most are quick fixes.

---

## Critical Issues

### C1. Auth bypass when AUTH_TOKEN is unset

**File:** `src/index.js:18`

If `.env` is missing `AUTH_TOKEN`, the variable is `undefined`. The comparison becomes:

```js
authHeader !== `Bearer undefined`
```

Anyone sending `Authorization: Bearer undefined` bypasses auth. Worse, if someone omits the header entirely, `undefined !== "Bearer undefined"` is true so they get rejected — but the intended "no token configured" case is never caught.

**Fix:** Fail fast at startup if `AUTH_TOKEN` is not set:

```js
const AUTH_TOKEN = process.env.AUTH_TOKEN;
if (!AUTH_TOKEN) {
  console.error('FATAL: AUTH_TOKEN environment variable is required');
  process.exit(1);
}
```

### C2. LLM_API_KEY not validated at startup

**File:** `src/llm.js:4`

If `LLM_API_KEY` is unset, the OpenAI client initializes with `undefined`. Every `/chat` request will fail with a cryptic API error instead of a clear startup failure.

**Fix:** Same pattern — validate at startup or at module load:

```js
if (!process.env.LLM_API_KEY) {
  console.error('FATAL: LLM_API_KEY environment variable is required');
  process.exit(1);
}
```

---

## High Priority

### H1. Error detail leaks internal info to clients

**File:** `src/index.js:48-49`

```js
return res.status(500).json({
  error: 'LLM request failed',
  detail: error.message,  // may contain API keys, internal URLs, stack info
});
```

`error.message` from the OpenAI SDK can include the base URL, partial request bodies, or rate-limit details. Exposing this to clients is an information disclosure risk.

**Fix:** Log the full error server-side, return a generic message to clients:

```js
console.error('Chat error:', error);
return res.status(500).json({ error: 'LLM request failed' });
```

### H2. No request body size limit

**File:** `src/index.js:9`

`express.json()` defaults to 100KB in Express 5, which is reasonable. However, a malicious caller could send a very large `message` string (just under 100KB) that gets written to `memory.md` and also sent to the LLM, potentially causing high token costs.

**Fix:** Set an explicit limit and consider truncating message length:

```js
app.use(express.json({ limit: '16kb' }));
```

### H3. Timing-safe comparison not used for auth token

**File:** `src/index.js:18`

String `!==` comparison is vulnerable to timing attacks. For a bearer token used over the network, practical exploitability is low but it is still a best-practice gap.

**Fix:** Use `crypto.timingSafeEqual`:

```js
const crypto = require('crypto');

function constantTimeEqual(provided, expected) {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}
```

### H4. Null dereference if LLM returns empty choices

**File:** `src/llm.js:22`

```js
return response.choices[0].message.content;
```

If the API returns an empty `choices` array (rate limit edge case, content filter, etc.), this throws an unhandled `TypeError`.

**Fix:**

```js
const choice = response.choices?.[0];
if (!choice?.message?.content) {
  throw new Error('LLM returned no response content');
}
return choice.message.content;
```

---

## Medium Priority

### M1. Memory file grows unbounded

**File:** `src/memory.js:40`

`appendMemory` writes forever with no rotation or size cap. On a busy agent, `memory.md` will grow until disk fills or `readFileSync` becomes slow.

**Recommendation:** Not suggesting a DB (YAGNI), but consider a simple size check before append — e.g., if file exceeds 1MB, truncate the oldest half. Or document that operators should periodically delete `memory.md`.

### M2. Memory parsing fragile with `---` in message content

**File:** `src/memory.js:12`

Splitting on `---` breaks if a user message or LLM reply contains `---` (common in markdown). This produces corrupted history entries that silently get dropped by the regex filter.

**Example that breaks parsing:**

```
User sends: "Here is a separator: ---"
```

The entry gets split into two fragments, neither matching the regex, so both are silently lost.

**Recommendation:** Use a more unique delimiter like `<!-- ENTRY -->` or `---dumb-agent-entry---`. Low urgency since corrupted entries are safely skipped, but context loss could confuse the LLM.

### M3. Synchronous file I/O on every request

**Files:** `src/memory.js`, `src/identity.js`

`readFileSync` and `appendFileSync` block the event loop. For a single-user dumb agent this is fine, but under concurrent load, requests queue behind each file read.

**Recommendation:** Acceptable for stated use case. Note in README that this is single-user by design. No change needed unless concurrency requirements change.

### M4. Memory regex does not capture multiline replies correctly in all cases

**File:** `src/memory.js:21`

```js
const replyMatch = entry.match(/\*\*reply:\*\*\s*([\s\S]*?)$/);
```

The lazy `[\s\S]*?` with `$` anchor works but could match an empty string if there is trailing whitespace. The `[\s\S]*?` is lazy and `$` is end-of-string, so in practice it captures correctly, but `[\s\S]+` (greedy, at least one char) would be more intentional.

---

## Low Priority

### L1. Health endpoint behind auth

**File:** `src/index.js:24, 53`

`app.use(authMiddleware)` applies to all routes including `/health`. Load balancers and uptime monitors typically expect unauthenticated health checks.

**Recommendation:** Move health route before the auth middleware, or register it separately:

```js
app.get('/health', (req, res) => { ... });
app.use(authMiddleware);
// ... authenticated routes below
```

### L2. `sender` field not validated or sanitized

**File:** `src/index.js:39`

`sender` is written directly to `memory.md`. While this is not an injection risk (markdown file, not HTML/SQL), a sender value containing `**reply:**` could confuse the memory parser.

### L3. Console log truncates message at 80 chars

**File:** `src/index.js:41`

Truncation is fine for logging, but `substring(0, 80)` could split a multi-byte UTF-8 character. Use a proper truncation or just accept the cosmetic risk.

---

## Positive Observations

- **Correct ENOENT handling** in `loadMemory` — file-not-found returns empty array gracefully
- **Fallback system prompt** in `loadIdentity` when both files missing
- **Clean separation** of concerns across 4 focused files
- **Identity reloads per request** — changes to soul.md/identity.md apply without restart, as documented
- **.gitignore** properly excludes `.env` and `memory.md`
- **Express 5** is used (modern, actively maintained)
- Memory windowing via `MAX_MEMORY_ENTRIES` prevents unbounded context growth to the LLM

---

## Recommended Actions (Priority Order)

1. **[Critical]** Validate `AUTH_TOKEN` at startup — fail fast if unset
2. **[Critical]** Validate `LLM_API_KEY` at startup — fail fast if unset
3. **[High]** Remove `detail: error.message` from 500 response
4. **[High]** Add null check on `response.choices[0]` in llm.js
5. **[Medium]** Consider a more unique memory entry delimiter
6. **[Low]** Move `/health` before auth middleware

---

## Metrics

| Metric | Value |
|--------|-------|
| Type Coverage | N/A (vanilla JS, no TypeScript) |
| Test Coverage | 0% (no tests — acceptable per project scope) |
| Linting Issues | N/A (no linter configured) |
| Dependencies | 3 (dotenv, express, openai) — minimal |
| Security Issues | 2 critical, 3 high |

---

## Unresolved Questions

- Is concurrent access to `memory.md` expected? If multiple instances run against the same file, append races could corrupt entries.
- Should `/health` be public? Current design requires auth for monitoring.
