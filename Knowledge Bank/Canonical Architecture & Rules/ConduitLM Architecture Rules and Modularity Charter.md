# ConduitLM Architecture Rules and Modularity Charter

**Version 1.1 – Antigravity-Hardened Binding Structural Constraints**

## 1. Purpose of This Document

This document defines the **structural laws** governing ConduitLM’s architecture.

Its purpose is to:

* Enforce modularity
* Prevent monolithic implementations
* Isolate failure domains
* Preserve long-term maintainability
* Ensure alignment with the ConduitLM UX Contract

Any implementation that violates these rules is considered architecturally invalid, even if it appears to function.

---

## 2. Core Architectural Principle

ConduitLM must be built as a **modular ingestion pipeline**, not a feature bundle.

This means:

* Source-specific logic is isolated
* Shared logic is centralized
* UI logic is thin and declarative
* NotebookLM integration is singular and authoritative

No single file or module may contain logic for multiple unrelated platforms.

---

## 3. Required High-Level Separation of Concerns

ConduitLM must be structured into the following layers. These layers are **non-negotiable**.

### 3.1 UI Trigger Layer

Responsibilities:

* Initiate user actions
* Collect user intent
* Display success or failure feedback

Explicitly forbidden:

* DOM scraping
* Source detection
* NotebookLM ingestion logic
* Source normalization logic
* Platform-specific extraction assumptions

The UI layer does not “know” how content is extracted or ingested.

### 3.2 Source Extraction Layer

Responsibilities:

* Detect whether a source can be extracted
* Capture raw content from a single source
* Return raw payloads in a source-local format

Explicitly forbidden:

* NotebookLM ingestion logic
* Cross-source normalization rules
* Multi-source routing logic
* Shared utility dumping ground behavior

Each source must have a single extraction module that can fail independently.

### 3.3 Ingestion Layer (Central)

Responsibilities:

* Receive raw payloads from any source module
* Apply normalization and validation
* Route into NotebookLM integration
* Return definitive success or failure

Explicitly forbidden:

* Platform-specific DOM logic
* Assumptions about extraction context
* Source-specific branching logic beyond routing by declared source type

This layer is the system’s **authoritative pipeline**.

### 3.4 NotebookLM Integration Layer (Singular)

Responsibilities:

* Receive normalized payloads
* Handle notebook selection and creation
* Perform ingestion into NotebookLM
* Report definitive success or failure

Explicitly forbidden:

* Platform-specific DOM logic
* Source extraction logic
* Cross-layer state hacks

This layer is the only component allowed to interact with NotebookLM.

---

## 4. Mandatory Source Modularity

Each supported source must be implemented as an isolated module.

Rules:

1. One source module per platform or content source.
2. No source module may directly call NotebookLM integration.
3. No source module may embed shared logic that belongs in normalization or ingestion.
4. Source modules may not import each other.

If a feature requires touching multiple sources, it is a pipeline concern and must be implemented in the centralized ingestion layer, not duplicated in source modules.

---

## 5. Source Module Contract

Every source module must expose a single, explicit contract with:

* `canExtract(context)`
* `extract(context)`

The extraction output must be a raw payload that is:

* self-contained
* source-identified
* free of normalized assumptions

Source modules must not return data that is already “NotebookLM-ready.”

---

## 6. Normalization Is Mandatory

All payloads entering the ingestion layer must be normalized through a centralized normalization step.

Rules:

* Normalization logic must live in a shared module.
* Normalization must produce a single canonical format suitable for NotebookLM ingestion.
* Source modules must not perform normalization beyond minimal extraction parsing.

Normalization is the boundary that prevents platform-specific drift.

---

## 7. Centralized Ingestion Pipeline

All ingestion must flow through a single pipeline entrypoint.

Rules:

* There must be exactly one authoritative ingestion function that accepts normalized payloads.
* All UI triggers and all source modules must route into the ingestion layer, never around it.
* NotebookLM integration is called only from ingestion.

If a path exists that bypasses ingestion, the architecture is broken.

---

## 8. Failure Isolation Rules

Failures must be isolated by layer and by source.

Rules:

* A failing source extractor must not break other source extractors.
* A NotebookLM ingestion failure must return a clear error result without corrupting state.
* No “global try catch that swallows errors” in the shared pipeline.
* Errors must be typed or categorized in a shared error module so UI can report consistently.

If a failure forces a code change outside the failing module, modularity is being violated.

---

## 9. File and Directory Structure (Minimum Acceptable)

Minimum acceptable structure:

* `src/`

  * `background/`
  * `content/`
  * `ui/`

    * `popup/`
    * `contextMenus.js`
  * `sources/`

    * `<sourceName>/`

      * `canExtract.js`
      * `extract.js`
      * `index.js`
  * `ingestion/`

    * `pipeline.js`
    * `router.js`
  * `integrations/`

    * `notebooklm/`

      * `client.js`
      * `index.js`
  * `shared/`

    * `normalize.js`
    * `errors.js`
    * `log.js`
    * `types.js` (if needed for contracts)

This structure may evolve, but **layer boundaries must not**.

---

## 10. Explicit Anti-Patterns

The following are architectural violations:

1. A “god file” containing logic for multiple sources.
2. Source modules importing other source modules.
3. UI code parsing DOM content for extraction.
4. NotebookLM calls inside source modules or UI.
5. Normalization logic duplicated inside extractors.
6. Adding cross-source conditionals like `if (source === "x")` scattered across unrelated files.
7. A shared folder that becomes a dumping ground for unrelated functions.
8. Silent fallbacks that hide extraction or ingestion failures.
9. Any refactor that moves business logic into UI to “simplify” messaging.

If any of these appear, the change is rejected.

---

## 11. Change Discipline

Any change must comply with this discipline:

* Changes must be scoped to a single layer unless the work is explicitly a boundary change.
* Boundary changes require updating this charter first.
* Do not “opportunistically refactor” outside scope.
* A change that increases coupling is rejected.

Minimum required change artifacts:

* A short “scope statement” of what is being changed.
* A list of files modified and why.
* A verification checklist (manual steps minimum).

---

## 12. Governing Question

Before writing or modifying code, this question must be answered:

> Does this change preserve isolation, clarity, and failure containment, or does it increase coupling?

If coupling increases, the change is rejected.

---

## 13. Charter Status

This Architecture Rules and Modularity Charter is binding.

Violations are not technical debt.
They are architectural defects.

Any deviation requires a documented revision of this charter.

---

## 14. Added Hardening: Dependency and Import Law

This section is added to remove ambiguity during agentic execution.

### 14.1 One-Way Dependency Rule

Dependencies must flow in this direction only:

* UI → Ingestion → NotebookLM Integration
* Sources → Ingestion → NotebookLM Integration
* Shared may be imported by any layer

Explicitly forbidden:

* Ingestion importing UI
* Ingestion importing Sources as implementations (routing by registration is allowed, direct hard-coded coupling is not)
* NotebookLM Integration importing Sources or UI
* Sources importing NotebookLM Integration or UI

### 14.2 Import Enforcement Practical Rule

If code in a folder needs to import “up” a layer boundary to function, the design is wrong. Fix the design, do not patch the import graph.

---

## 15. Architectural Maturity and Freeze Status

This architecture is considered **stable and execution-ready**.

The following are frozen:
- Layer boundaries
- Dependency direction
- Source / ingestion / integration separation
- NotebookLM singular integration rule

Allowed during implementation:
- Adding new source modules
- Extending message schemas
- Adding internal helpers within a layer

Explicitly disallowed without a charter revision:
- Moving logic across layers
- Collapsing modules for convenience
- Introducing cross-layer imports
- Reinterpreting responsibilities

This charter is not a living design document during active development.
It is an execution constraint.