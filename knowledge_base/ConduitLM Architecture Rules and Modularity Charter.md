# ConduitLM Architecture Rules and Modularity Charter

**Version 1.0 – Binding Structural Constraints**

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

The UI layer does not “know” how content is extracted or ingested.

---

### 3.2 Source Extraction Layer

Responsibilities:

* Detect whether a source can be handled
* Extract content from a specific platform
* Normalize extracted content into a standard payload

Explicitly forbidden:

* Notebook selection or creation
* UI feedback
* Cross-source logic
* Network calls to NotebookLM

Each source is treated as an independent failure domain.

---

### 3.3 Ingestion and Routing Layer

Responsibilities:

* Receive normalized payloads
* Handle notebook selection and creation
* Perform ingestion into NotebookLM
* Report definitive success or failure

Explicitly forbidden:

* Platform-specific DOM logic
* Assumptions about extraction context

This layer is the only component allowed to interact with NotebookLM.

---

## 4. Mandatory Source Modularity

Each supported source must live in its **own module namespace**.

At minimum, ConduitLM must support this structure:

* `sources/youtube/`
* `sources/chatgpt/`
* `sources/gemini/`
* `sources/google_docs/`
* `sources/web/`

Each module exists to support exactly one platform or extraction context.

Combining logic for multiple platforms in a single file is prohibited.

---

## 5. Source Module Contract

Every source module must expose the same conceptual interface.

Each module must provide:

* A clear determination of whether it can handle the current context
* A single extraction entry point
* A normalized payload return value

Conceptually, every module answers:

* Can I handle this source?
* If so, return `{ title, url, sourceType, content, metadata }`

Source modules may not:

* Call NotebookLM
* Trigger UI feedback
* Manage notebooks
* Know about other source modules

If a module cannot confidently extract content, it must fail explicitly.

---

## 6. Normalization Is Mandatory

All extracted content must be normalized before ingestion.

Normalization guarantees:

* Consistent structure across sources
* Predictable ingestion behavior
* Reduced coupling between extraction and ingestion

No ingestion logic may assume raw DOM output.

If normalization is skipped, the module is incomplete.

---

## 7. Centralized Ingestion Pipeline

There must be exactly **one ingestion pipeline** responsible for:

* Notebook selection
* Notebook creation
* Content ingestion
* Success and error reporting

All source modules must route through this pipeline.

Duplicating ingestion logic across sources is explicitly disallowed.

This pipeline is the enforcement point for the UX Contract.

---

## 8. Failure Isolation Rules

Failures must be isolated by source and layer.

This means:

* A broken YouTube extractor cannot break ChatGPT ingestion
* A UI failure cannot corrupt extracted content
* A NotebookLM error cannot silently discard content

No silent failures are allowed at any layer.

Errors must propagate upward with context.

---

## 9. File and Directory Structure (Minimum Acceptable)

The following structure is recommended and enforced unless explicitly revised:

* `src/`

  * `background/`

    * `router.js`
    * `ingest.js`
    * `notebooks.js`
  * `sources/`

    * `youtube/extract.js`
    * `chatgpt/extract.js`
    * `gemini/extract.js`
    * `google_docs/extract.js`
    * `web/extract.js`
  * `ui/`

    * `popup/`
    * `contextMenus.js`
  * `shared/`

    * `normalize.js`
    * `errors.js`
    * `log.js`

This structure may evolve, but **layer boundaries must not**.

---

## 10. Explicit Anti-Patterns

The following are architectural violations:

* One file handling multiple platforms
* Shared files containing platform-specific DOM selectors
* Source modules directly calling NotebookLM
* UI code containing extraction logic
* Silent error handling
* Conditional logic branching across platforms in shared code

If any of these appear, the architecture has regressed.

---

## 11. Change Discipline

Adding a new source requires:

* A new source module
* Adherence to the source module contract
* No changes to existing source modules
* No changes to ingestion logic unless absolutely required

If adding a source requires modifying unrelated modules, the design is flawed.

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