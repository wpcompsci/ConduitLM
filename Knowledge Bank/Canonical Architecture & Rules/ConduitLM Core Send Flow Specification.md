# ConduitLM Core Send Flow Specification

**Version 1.0 – Canonical “Send to NotebookLM” Behavior**

## 1. Purpose

This document defines the single canonical ConduitLM operation:

> Extract content → Choose destination → Ingest into NotebookLM → Confirm outcome

All UI triggers, source modules, and background routing must converge on this flow. Any alternative path is a defect unless explicitly added as a new, documented flow.

---

## 2. Scope

This specification covers:

* The end-to-end user flow for sending content to NotebookLM
* Destination selection, including new notebook creation
* Success and failure states and required messaging

This specification does not cover:

* Per-source extraction implementation details
* Firefox MV3 lifecycle or injection mechanics
* Advanced features such as batching, queues, or retries beyond user-visible outcomes

---

## 3. Trigger Inputs (How the Flow Starts)

The send flow can be initiated by any UI trigger (toolbar, context menu, in-page button). Regardless of trigger, the system must produce the same minimal input:

### Required Input Context

* Active tab identifier
* Active tab URL
* User intent type (one of the supported send actions)

### Supported User Intent Types

At minimum, ConduitLM must support:

* **Send Selection** (selected text snippet)
* **Send Source Extract** (platform-specific extraction, such as YouTube transcript or AI conversation)
* **Send Page Main Content** (generic web extraction)

If intent cannot be determined, the flow must stop and present a user-visible error.

---

## 4. Preflight: Determine Handling Strategy

### 4.1 Source Resolution

The system must resolve a single source handler strategy:

1. If the user intent is **Send Selection**:
   Use the selection payload path. No platform module required.
2. If the user intent is **Send Source Extract**:
   Route to a single matching source module based on URL and context.
3. If the user intent is **Send Page Main Content**:
   Route to the generic web extraction module.

### 4.2 Unhandled Source

If no source module can confidently handle the context:

* The flow must stop
* The user must see an explicit message: the source is not supported or not detectable

No partial sends. No guessing.

---

## 5. Extraction Step (Source Layer Responsibilities)

### 5.1 Extraction Output Contract

Extraction must return a normalized payload with:

* `title` (string, required)
* `url` (string, required)
* `sourceType` (enum string, required)
* `content` (string, required)
* `metadata` (object, optional but recommended)

### 5.2 Content Quality Rules

Before proceeding:

* Content must not be empty
* Content must not be dominated by UI boilerplate
* Content must be logically ordered

If extraction fails or yields invalid content:

* The flow must stop
* The user must receive an explicit failure message referencing the source type

---

## 6. Destination Step: Notebook Selection or Creation

### 6.1 Destination UI Requirement

Before ingestion, ConduitLM must present the destination choice clearly and explicitly.

The user must be able to:

1. Select an existing notebook
2. Select “Create new notebook…”

The destination must always be visible at the moment of confirmation.

### 6.2 Create New Notebook Path

If the user chooses “Create new notebook…”:

* Prompt for notebook name only
* Validate name is non-empty
* Create the notebook and immediately ingest into it

From the user’s perspective, this is one operation.

### 6.3 Destination Defaults (Allowed, With Constraints)

ConduitLM may offer a default selection (such as last-used notebook) only if:

* The chosen destination is shown explicitly
* The user can change it before confirming
* No send happens without an explicit confirm action

---

## 7. Confirm Step (The Commitment Point)

### 7.1 Confirmation Requirement

The user must explicitly confirm before ingestion occurs.

At confirmation, the UI must show:

* What is being sent (intent and sourceType)
* Where it is being sent (notebook name)

### 7.2 Atomicity Requirement (User-Visible)

From the user’s perspective, “Send” is atomic:

* If the send succeeds, the user receives definitive success feedback
* If any part fails, the user receives definitive failure feedback
* The system must not silently succeed partially

---

## 8. Ingestion Step (Background Pipeline Responsibilities)

### 8.1 Single Pipeline

All ingestion must run through the centralized ingestion pipeline.

The pipeline must:

* Accept the normalized payload
* Resolve notebook destination (existing or newly created)
* Perform the NotebookLM ingestion action
* Return a single definitive result: success or failure with reason

### 8.2 Mandatory Result Semantics

The pipeline must return one of:

* `SUCCESS` with destination notebook name and ingested item reference where possible
* `FAILURE` with specific failure classification

---

## 9. Success and Failure Outcomes (User Feedback)

### 9.1 Success Feedback (Required)

On success, the user must see a message containing:

* Destination notebook name
* The type of content sent (YouTube transcript, AI chat, selection, webpage)
* A clear “sent” confirmation

Example success statement form:

* “Sent to NotebookLM: [Notebook Name]”

### 9.2 Failure Feedback (Required)

On failure, the user must see:

* What failed (extraction vs notebook selection vs notebook creation vs ingestion)
* Which source type was involved
* A next-action hint when possible (for example, “try reloading the page,” “not logged in,” “source not supported”)

Generic failures are prohibited.

### 9.3 No Silent Drops

If a failure occurs after extraction, the user must not lose the extracted content without notice.

Minimum acceptable behavior:

* Present an explicit failure message
* Provide an option to copy the extracted content, or otherwise ensure it is not silently discarded

---

## 10. Acceptance Criteria (Done Means Done)

A send flow is considered correct only if all conditions below are met:

1. The user can initiate a send from a supported context.
2. The correct extraction path is selected (selection vs source module vs web main content).
3. Extraction produces a valid normalized payload or fails explicitly.
4. The user must choose a destination, including the option to create a new notebook.
5. The user must confirm before ingestion happens.
6. Ingestion returns a definitive success or failure result.
7. The user receives explicit success or failure feedback.
8. No silent partial success or silent data loss occurs.

---

## 11. Non-Goals (Explicit)

This flow does not define:

* Batch sending multiple sources in one action
* Background queueing and later delivery
* Automatic sending without user confirmation
* Notebook templates or notebook management beyond creation

If these are added later, they require new specs and must not compromise this flow.

---

## 12. Status

This Core Send Flow Specification is binding.

All triggers must route into this flow.
All sources must conform to its extraction contract.
All ingestion must be performed by the centralized pipeline.

---

Good. We do **not** need a reflow. The documents are structurally sound. What is missing are **binding sections** that close ambiguity loops. You can paste these in cleanly without destabilizing anything.

Below are **exact, drop-in sections**, written to be short, explicit, and agent-proof. I will tell you where each goes.

---

# 1. UX Contract

### Add ONE new subsection

**No reflow required**

### Where to place it

Under the section that defines **user-visible send flow / confirmation behavior**, or immediately before error handling.

---

## Host Access and Permission UX (Binding)

### Purpose

Define the required user experience when ConduitLM lacks permission to access the current page.

### Rules

* ConduitLM MUST NOT attempt silent content extraction on pages without access.
* If required page access is missing at send time, the user MUST be informed before confirmation.
* Permission acquisition MUST be user-initiated and explicit.

### Required UX Behavior

When a user initiates a send action and page access is missing:

1. The UI MUST display a blocking state indicating:

   * Content access is required to proceed
   * The current page domain
2. The UI MUST offer exactly one of the following actions:

   * “Grant access to this site and continue”
   * “Cancel send”
3. If the user grants access:

   * The send flow resumes without restarting the extension UI
4. If the user declines:

   * The send is aborted with a visible cancellation state
   * No retry is attempted automatically

### Prohibited Behavior

* Silent failure or fallback
* Implicit permission escalation
* Proceeding with incomplete or empty content
* Hiding permission state from the user

Permission state MUST be resolved before confirmation.
Confirmation MUST reflect the final resolved state.

---

# 2. Core Send Flow Specification

### Add TWO subsections

**No reflow required**

---

## Lifecycle Resilience and Message Safety (Binding)

### Purpose

Ensure the Core Send Flow remains reliable under Firefox MV3 lifecycle constraints.

### Rules

* No step in the Core Send Flow may assume persistent background state.
* Each send attempt MUST be treated as an isolated transaction.
* All send attempts MUST be uniquely identifiable.

### Required Behavior

* Every send request MUST include a `requestId`.
* Message handlers MUST:

  * return exactly one response
  * handle background suspension safely
* Any step awaiting a response MUST implement:

  * a bounded timeout
  * a user-visible failure state on timeout
* Retries MUST be safe and idempotent.

### Prohibited Behavior

* Long-lived background state assumptions
* Unbounded waits for responses
* Silent hangs or unresolved promises
* Reliance on in-memory state for correctness

If lifecycle interruption occurs, the flow MUST fail explicitly and inform the user.

---

## v1 Content Extraction Heuristic (Binding)

### Purpose

Define a minimal, shippable extraction strategy for version one.

### Rules

* Selection content ALWAYS takes precedence if present.
* Extraction MUST favor correctness and predictability over completeness.

### Required v1 Heuristic

When no user selection exists:

1. **Title**

   * Use `document.title`
2. **URL**

   * Prefer canonical URL if present
   * Else use `location.href`
3. **Main Content**
   Apply the first valid match:

   1. `<article>` element with non-trivial text
   2. `<main>` element with non-trivial text
   3. Largest text container among common candidates (`article`, `main`, `section`, `div`) by text length
4. **Cleanup**

   * Strip obvious navigation, footer, and sidebar content
   * Avoid aggressive readability transformations

### Prohibited Behavior

* Full readability pipelines in v1
* Cross-site heuristics
* Source-specific assumptions
* Boilerplate-dominated output

Extraction MUST return non-empty content or fail explicitly.

---

# 3. Architecture Rules and Modularity Charter

### Add ONE short section

**No reflow required**

---

## Document Precedence and Conflict Resolution (Binding)

### Authority Order

In the event of ambiguity or conflict, documents MUST be applied in this order:

1. ConduitLM Architecture Rules and Modularity Charter
2. ConduitLM UX Contract
3. ConduitLM Core Send Flow Specification
4. ConduitLM Firefox MV3 Canonical Architecture and Enforcement Rules
5. Firefox MV3 reference documents (supporting, non-authoritative)

### Conflict Rule

* If a conflict is detected between documents, implementation MUST halt.
* The conflict MUST be reported and resolved through document revision before proceeding.
* No implementation may resolve conflicts by assumption or reinterpretation.

Silence is not permission.
