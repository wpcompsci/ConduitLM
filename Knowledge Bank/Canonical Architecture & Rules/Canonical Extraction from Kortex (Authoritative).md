# Canonical Extraction from Kortex (Firefox Reference Implementation)

**Status:** Authoritative internal reference
**Purpose:** Preserve verified NotebookLM integration knowledge while enforcing ConduitLM MV3, modularity, and Core Send Flow constraints
**Source:** Legacy Kortex Firefox extension (read only forensic reference)

---

## 1. Scope and Intent

This document captures **what is worth preserving** from the original Kortex plugin and **how it must be re expressed** inside ConduitLM.

This is not a migration guide.
This is not a porting guide.
This is a **knowledge distillation**.

Any implementation that copies Kortex code verbatim is incorrect by definition.

---

## 2. High Level Assessment of Kortex

Kortex proves three critical facts:

1. NotebookLM ingestion is achievable from a Firefox extension using batchexecute endpoints.
2. NotebookLM notebooks and sources can be enumerated, created, and populated reliably.
3. Multi source extraction can be normalized into a single ingestion pipeline.

Kortex also demonstrates several **non acceptable patterns** that must not exist in ConduitLM:

* MV2 style background persistence assumptions
* Mixed UI, extraction, and ingestion logic
* Implicit sender and permission assumptions
* Brittle routing and lifecycle handling

ConduitLM must treat Kortex as evidence, not precedent.

---

## 3. NotebookLM Integration (Preserve Concept, Rewrite Implementation)

### 3.1 Endpoint Knowledge (Preserve)

NotebookLM ingestion occurs via:

```
https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute
```

This endpoint remains the authoritative integration surface.

ConduitLM must assume:

* User is authenticated in the active Firefox profile
* Requests execute under browser session cookies
* Failures must surface explicitly

---

### 3.2 RPC Identifiers (Preserve as Volatile Knowledge)

The following RPC ids are known working references:

| Operation           | RPC ID |
| ------------------- | ------ |
| List notebooks      | wXbhsf |
| Create notebook     | CCqFvf |
| Add text source     | izAoDd |
| Check source status | rLM1Ne |
| Delete notebook     | WWINqb |
| Get source content  | hizoJc |

These identifiers are **not stable contracts**.
They must be isolated in a single NotebookLM adapter module so they can be updated without architectural fallout.

---

### 3.3 Auth Token Discovery (Preserve Concept, Harden)

Kortex retrieves two required tokens by fetching the NotebookLM homepage HTML:

* `at` token (derived from `SNlM0e`)
* `bl` token (derived from `cfb2h`)

This approach is valid but fragile.

**ConduitLM rules:**

* Token discovery must be isolated to the NotebookLM ingestion layer.
* Token discovery failures must produce explicit user visible errors.
* Token parsing must be defensive and version tolerant.
* No token state may be stored in memory only. Tokens are ephemeral and must be re derived per ingestion job if required.

---

### 3.4 Batch Execute Request Construction (Preserve Structure)

NotebookLM ingestion requires:

* URL parameters:

  * `rpcids`
  * `source-path`
  * `bl`
  * `_reqid`
  * `rt=c`
* Body:

  * `f.req` containing JSON encoded payload
  * `at` token

This structure is canonical and must be preserved conceptually.

Implementation must be rewritten for:

* Idempotency
* Retry safety
* Explicit failure classification

---

## 4. Payload Shapes (Preserve Semantics, Normalize)

### 4.1 List Notebooks

```
[null, 1, null, [2]]
```

### 4.2 Create Notebook

```
[title]
```

### 4.3 Add Text Source

Text source payload structure:

```
textSource = [
  null,
  [title, content],
  null,
  2,
  null,
  null,
  null,
  null,
  null,
  null,
  1
]

payload = [
  [textSource],
  notebookId,
  [2]
]
```

### 4.4 Add Google Doc Source

Google Doc payload structure:

```
docSourceData = [
  docId,
  "application/vnd.google-apps.document",
  1,
  title
]

docSource = [
  docSourceData,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  1
]

payload = [
  [docSource],
  notebookId,
  [2],
  additionalParam
]
```

### 4.5 Polling and Retrieval

* Source status polling uses notebookId scoped payloads
* Source content retrieval uses sourceId lists

**ConduitLM requirement:**
All of these payloads must be generated from a **normalized internal representation**, never constructed ad hoc in UI or source modules.

---

## 5. Parsing batchexecute Responses (Rewrite Required)

Kortex parses responses using:

* Fixed line offsets
* Nested JSON parsing assumptions

This is acceptable as a prototype, not as production logic.

**ConduitLM rules:**

* Response parsing must validate structure before dereferencing
* Parsing errors must be surfaced explicitly
* Partial responses must never be silently ignored
* The ingestion pipeline must classify failures as:

  * auth
  * permission
  * notebook creation
  * source ingestion
  * unknown

---

## 6. Source Extraction Architecture (Preserve Pattern, Enforce Modularity)

### 6.1 What Kortex Gets Right

* Per site extraction logic
* DOM selector isolation
* MutationObserver resilience
* Normalization into a common conversation or content structure

### 6.2 What Must Change

Kortex implements all adapters inside a single content script.

**ConduitLM rules:**

* Each source lives in its own module
* Each source module exposes:

  * canHandle(context)
  * extract(context)
* No source module may know about NotebookLM
* No source module may perform ingestion

---

## 7. UI and Flow (Preserve UX Intent, Enforce Core Send Flow)

### 7.1 Destination Selection

Kortex correctly enforces explicit notebook selection with a create new option.

This aligns with the ConduitLM Core Send Flow and must be preserved.

### 7.2 Atomic Send

Kortex treats “create notebook + ingest” as one user action.

This must remain atomic from the user’s perspective.

### 7.3 What Must Be Removed

* UI triggered ingestion bypassing a central pipeline
* Popup logic that assumes sender.tab exists
* Any UI path that allows silent failure or ambiguous success

---

## 8. Background and Messaging (Discard Entirely, Rebuild)

Kortex background logic must **not** be reused.

Reasons:

* MV2 style background loading
* Mixed routing concerns
* Sender tab assumptions
* Non durable state

**ConduitLM enforcement:**

* Single message router
* MV3 event page safe patterns only
* Popup, content, and background messages treated equally
* Durable ingestion job records persisted before execution

---

## 9. Permissions and Host Access (Explicit Enforcement)

Kortex demonstrates a real failure mode:

* `notebooklm.google.com` vs `notebooklm.google` mismatch
* Missing host permissions produce silent breakage

**ConduitLM rules:**

* All target origins must be enumerated explicitly
* Permission checks must be performed at runtime
* Missing permissions must trigger user mediated request flows
* No injection or ingestion attempt may occur without verified access

---

## 10. Explicit Do Not Reintroduce List

The following behaviors are forbidden in ConduitLM:

* Background state stored only in memory
* Implicit host permission assumptions
* Mixed platform logic in shared files
* UI driven ingestion logic
* Silent partial success
* Fire and forget messaging
* Fixed index parsing of batchexecute responses without validation

---

## 11. Canonical Takeaway

Kortex proves NotebookLM integration is possible.
It does not define how ConduitLM should be built.

ConduitLM must:

* Reimplement NotebookLM ingestion cleanly
* Isolate volatility
* Enforce explicit user intent
* Treat Firefox MV3 constraints as first order design inputs

This document is the **only allowed reference** to Kortex going forward.