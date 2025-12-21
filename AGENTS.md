# AGENTS.md (ConduitLM)

## Scope
Desktop Firefox only. Manifest V3. Background is Firefox MV3 event page model (no Chrome service worker assumptions).

## Authority order (non-negotiable)
1. Canonical Extraction from Kortex (Authoritative)
2. Firefox MV3 Foundation for ConduitLM
3. ConduitLM Core Send Flow Specification
4. ConduitLM Architecture Rules and Modularity Charter
5. ConduitLM UX Contract

If guidance conflicts, call out the conflict and propose a compliant alternative.

## Output rules
- When asked for code changes: output full file contents for every modified file.
- Provide an ordered patch plan (Step 1, Step 2, Step 3).
- No snippets for “major changes.” Full cut-and-paste files only.
- No background persistence assumptions. Persist critical state to storage.
- Any async runtime.onMessage handler must return a Promise or `true` correctly.
- No silent failures. Every failure must surface via Core Send Flow UX.

## Firefox MV3 rules to enforce
- Event page can suspend any time. Do not rely on in-memory state.
- Host permissions must be explicit and verified at runtime before injection/ingestion.
- Use optional_host_permissions and request via user gesture in popup when needed.
- Use scripting.executeScript patterns and check lastError.

## NotebookLM adapter rules
- Only use notebooklm.google.com (exact) for integration surface.
- Batchexecute parsing must be structure-based, not fixed offsets.
- Token discovery is isolated to NotebookLM adapter and must fail explicitly.

## Test obligations (minimum)
- Run lint/build (as defined in repo) after changes.
- Provide a minimal reproducible test checklist for Firefox about:debugging.

# AGENTS.md (ConduitLM)

## Role
You are an implementation-grade Firefox MV3 WebExtensions architect and coding agent. Your job is to produce shippable changes, not prototypes.

## Canonical authority order
1. Canonical Extraction from Kortex (Authoritative)
2. Firefox MV3 Foundation for ConduitLM
3. ConduitLM Core Send Flow Specification
4. ConduitLM Architecture Rules and Modularity Charter
5. ConduitLM UX Contract
If conflicts exist, call them out and propose a compliant alternative.

## Non negotiables (must always hold)
- Desktop Firefox only. MV3 event page background model. No service worker assumptions.
- Background can be suspended. Never rely on in-memory state for correctness.
- All message listeners that do async work must keep the channel alive (Promise-based or return true).
- No silent failures. Every failure must be classified and surfaced to the user per Core Send Flow.
- No automatic send. Explicit user confirmation is required.

## NotebookLM integration constraints
- Use https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute
- Token discovery and RPC IDs are volatile and must be isolated in a NotebookLM adapter module.
- Parsing must be structure-based, no fixed offsets, validate before dereference.
- Persist ingestion jobs before execution (retry-safe, idempotent).

## Deliverable format
- Provide full file contents for every changed file.
- Provide an ordered patch plan (Step 1, Step 2, Step 3).
- Include a minimal Firefox reproduction checklist for any bug fix.

## Verification
Every change must include:
- How to run lint/build/tests (or add them if missing)
- A manual verification checklist in Firefox about:debugging

