# Firefox MV3 Foundation for ConduitLM

ConduitLM is a Firefox first Manifest V3 WebExtension whose purpose is reliable knowledge ingestion into Google NotebookLM. Reliability is the primary engineering constraint, not feature breadth.

This document converts Firefox MV3 constraints into enforceable rules, concrete failure patterns, and architecture implications.

---

## A. Technical Rules (Enforceable)

Each rule is written as a testable constraint with explicit breakage modes.

### Rule 1: Treat the MV3 background as non persistent and disposable

* **Applies to:** background
* **Rule:** Do not rely on in memory background state for correctness (queues, tokens, adapter state, retry counters, partial payloads).
* **Enforcement:** If the background is terminated between events, work in flight is lost, message responses can time out, retries can duplicate or skip ingestion, and adapter state becomes incoherent. MV3 removes persistent background pages. ([MDN Web Docs][1])

### Rule 2: Durable ingestion state must live in extension storage, not RAM

* **Applies to:** background, content, popup
* **Rule:** Any state required to complete an ingestion must be persisted before the step that depends on it.
* **Enforcement:** Background termination or crash drops in flight data; ingestion becomes non deterministic. Firefox MV3 background is event driven non persistent. ([MDN Web Docs][1])

### Rule 3: Every site you touch must be covered by explicit host permissions strategy

* **Applies to:** manifest, background, content
* **Rule:** For each target origin, define whether access is granted via `host_permissions`, `optional_host_permissions` plus runtime request, or `activeTab` for ephemeral access. Do not mix ad hoc patterns.
* **Enforcement:** Content scripts will not run unless host permissions are granted. Registered scripts are gated by host permission grants. Programmatic injection requires `activeTab` or host permissions. ([MDN Web Docs][2])

### Rule 4: Never assume host permissions are present post install

* **Applies to:** background, popup, options
* **Rule:** At runtime, always verify required host access (per origin) before attempting injection, tab reads, or host scoped APIs. If missing, request it in a user gesture flow.
* **Enforcement:** Firefox MV3 allows users to grant or revoke host permissions. From Firefox 127, declared host permissions are granted on install, but they remain revocable and updates may not re prompt for newly added hosts. ([Firefox Extension Workshop][3])

### Rule 5: Use least privilege match patterns and keep them origin tight

* **Applies to:** manifest, injection, adapters
* **Rule:** Each adapter must have an explicit, minimal match pattern set. Avoid wildcard broad grants unless you are prepared to handle any page.
* **Enforcement:** Match patterns control where content scripts run and where host scoped listeners can operate. Overbroad patterns widen failure surface and permission prompts. ([MDN Web Docs][4])

### Rule 6: Static versus dynamic injection must be a deliberate choice per adapter

* **Applies to:** manifest, background, content
* **Rule:** If the adapter requires early DOM access, use manifest declared `content_scripts` with an appropriate `run_at`. If the adapter is user invoked, prefer programmatic injection with `scripting.executeScript` gated by permission checks.
* **Enforcement:** Manifest declared scripts only execute when host permissions are granted. Programmatic injection requires `scripting` permission and host permission or `activeTab`. `scripting.executeScript` exists in Firefox MV3 and defaults to `document_idle` which can be too late for some captures. ([MDN Web Docs][2])

### Rule 7: If you register content scripts at runtime, registration must be permission safe

* **Applies to:** background
* **Rule:** Before calling `contentScripts.register()`, verify the extension has host permissions for the target match patterns.
* **Enforcement:** The API rejects registration if appropriate host permissions are not held. ([MDN Web Docs][5])

### Rule 8: Messaging handlers must be correctness complete under MV3 lifetime limits

* **Applies to:** background, content, popup
* **Rule:** For `runtime.onMessage`, either return a Promise from a non async listener that conditionally returns values, or return `true` and call `sendResponse` later. Do not use `addListener(async () => { ... })`.
* **Enforcement:** MDN explicitly warns that passing an async function causes a Promise to be returned for every message, preventing other listeners from responding. Incorrect patterns yield messages that never resolve or routes that deadlock. ([MDN Web Docs][6])

### Rule 9: Background message processing must be idempotent and retry safe

* **Applies to:** background, ingestion pipeline
* **Rule:** Every ingestion request must carry an idempotency key and be safe to process more than once.
* **Enforcement:** With a non persistent background, retries after termination or UI resends can duplicate work. MV3 background non persistence increases this probability. ([MDN Web Docs][1])

### Rule 10: Permission requests must be initiated from a user action and limited to declared optional sets

* **Applies to:** popup, options, content UI
* **Rule:** Only request permissions that are declared in `optional_permissions` and host origins that are declared in `optional_host_permissions`. Trigger requests from a user gesture handler.
* **Enforcement:** The permissions API requires requested permissions to be defined in `optional_permissions`, and runtime requests are constrained. Requests may only be made in a handler for a user action. ([MDN Web Docs][7])

### Rule 11: All injection attempts must produce auditable evidence

* **Applies to:** background, content
* **Rule:** For every injection attempt, log: target tabId, URL origin, permission state snapshot, injection method, and a content side acknowledgment message.
* **Enforcement:** In MV3, silent non execution is common when permissions are missing or scripts are blocked from running. Content script execution is gated by host permissions. ([MDN Web Docs][2])

### Rule 12: Use official Firefox tooling workflows during development

* **Applies to:** engineering workflow
* **Rule:** All debugging must be reproducible via `about:debugging` inspect flows and or `web-ext run`. Log locations must be explicitly documented.
* **Enforcement:** Firefox provides specific developer tools workflows for temporary install and inspection. ([MDN Web Docs][8])

---

## B. Rationale (Per Rule)

This section explains why each rule exists, focusing on Firefox MV3 behaviors.

1. **Non persistent background** exists because Firefox MV3 supports only non persistent backgrounds and MV3 removes persistent background pages. This means your orchestrator can disappear between events and must be designed as event driven. ([MDN Web Docs][1])
2. **Durable state** is required because the non persistent model implies state loss on termination or crash; correctness must not depend on continuity of a single JS context. ([MDN Web Docs][1])
3. **Host permissions** gate access to page content and host scoped APIs. Content scripts can only access page content when host permissions for the origin are granted. ([MDN Web Docs][2])
4. **Do not assume host grants** because Firefox MV3 allows users to grant or revoke host permissions. The MV3 migration guide specifically highlights ad hoc grant revocation and the need to check and request as needed. ([Firefox Extension Workshop][3])
5. **Least privilege match patterns** because match patterns define where scripts run and where listeners can apply, and they are the formal mechanism used across WebExtensions. ([MDN Web Docs][4])
6. **Static vs dynamic injection** because manifest declared content scripts are executed only when host permissions are granted, while programmatic injection requires `scripting` permission plus `activeTab` or host permission, and `executeScript` timing defaults to `document_idle`. ([MDN Web Docs][2])
7. **Runtime registration safety** because `contentScripts.register()` will be rejected if the extension lacks host permissions for the patterns. ([MDN Web Docs][5])
8. **Messaging correctness** because `runtime.onMessage` supports Promise returns or `return true` with later `sendResponse`, and MDN warns against async listeners that inadvertently return Promises for all messages. ([MDN Web Docs][6])
9. **Idempotency** because non persistent backgrounds increase the chance of duplicate delivery, retries, and replays, so ingestion must be safe under repetition. ([MDN Web Docs][1])
10. **Permission request constraints** because runtime permission requests must be declared in `optional_permissions` and optional host access must be declared in `optional_host_permissions`. Requests must be made from a user action handler. ([MDN Web Docs][7])
11. **Auditable injection** because the platform will simply not run content scripts when host permissions are missing, so you need positive proof rather than assumption. ([MDN Web Docs][2])
12. **Official debugging workflows** because Firefox development and inspection is anchored on temporary installation, `about:debugging` inspection, and `web-ext` automation. ([MDN Web Docs][8])

---

## C. Common Failure Patterns

Each pattern is Firefox MV3 biased and framed for confirmation and prevention.

### Failure Pattern 1: “Content script never runs on target site”

* **Symptom:** No UI injected, no page capture, no content logs.
* **Root cause:** Host permissions not granted. In Firefox MV3, content scripts only execute when host permissions for the origin are granted. ([MDN Web Docs][2])
* **How to confirm:**

  * In extension tooling, inspect background logs and compare against actual granted permissions using the permissions API. `permissions.getAll()` returns current grants. ([MDN Web Docs][9])
  * Check the site origin against match patterns. ([MDN Web Docs][4])
* **ConduitLM prevention:**

  * Implement a “permission gate” per adapter: `permissions.contains()` check and a UI flow to request `optional_host_permissions` when missing. ([MDN Web Docs][10])

### Failure Pattern 2: “Programmatic injection claims success but page side never responds”

* **Symptom:** `executeScript` Promise resolves, but no content acknowledgment arrives.
* **Root cause:** Injection occurred in the wrong context or too late, or the extension lacked URL permission at execution time. Programmatic injection requires `scripting` permission and host permission or `activeTab`. ([MDN Web Docs][11])
* **How to confirm:**

  * Log permission snapshot before injection (contains host origin or activeTab path).
  * Add a mandatory handshake: content script immediately `tabs.sendMessage` or `runtime.sendMessage` to acknowledge readiness. `tabs.sendMessage` is the correct mechanism to message content scripts. ([MDN Web Docs][12])
* **ConduitLM prevention:**

  * Require handshake receipt within a timeout; if missing, downgrade to “permission missing or wrong match” diagnostics, not “site bug”.

### Failure Pattern 3: “Messages intermittently hang, especially after idle”

* **Symptom:** UI spins, ingestion request never completes, background appears unresponsive.
* **Root cause:** Incorrect async `runtime.onMessage` handler pattern or background termination mid flow. MDN warns against async listeners and defines correct Promise or `return true` usage. ([MDN Web Docs][6])
* **How to confirm:**

  * Inspect `runtime.onMessage` registration code for `addListener(async ...)`.
  * Use the extension debugger to observe whether the background context is restarting between steps. ([MDN Web Docs][13])
* **ConduitLM prevention:**

  * A single message router with strict rules:

    * Never async listener functions.
    * Always respond with Promise return or `return true` plus `sendResponse`.
    * Persist job state before long operations.

### Failure Pattern 4: “Runtime registered scripts fail only on some sites”

* **Symptom:** `contentScripts.register()` fails or silently does nothing depending on host.
* **Root cause:** The call is rejected when host permissions for patterns are not held. ([MDN Web Docs][5])
* **How to confirm:** Catch and log the rejection; compare registered patterns against current permission grants.
* **ConduitLM prevention:** Do not register adapter scripts until host permission is present; drive registration from the same permission gate.

### Failure Pattern 5: “Works on desktop, breaks on Firefox for Android”

* **Symptom:** Core ingestion features do not run on Android builds.
* **Root cause:** Firefox for Android does not support background service workers for MV3 and recommends MV2 for Android in many cases. ([Firefox Extension Workshop][14])
* **How to confirm:** Validate platform target and manifest compatibility using Firefox for Android guidance.
* **ConduitLM prevention:** If Android is in scope, explicitly design a separate background model using event pages, or explicitly declare desktop only support in ConduitLM scope documentation. ([Firefox Extension Workshop][14])

### Failure Pattern 6: “Host permissions changed, existing users silently lose coverage”

* **Symptom:** New target site adapters fail for existing installs after an update.
* **Root cause:** Firefox MV3 host permission prompts differ across versions and newly added hosts in updates may not be shown to the user as a prompt, so users can remain without a grant. ([Firefox Extension Workshop][3])
* **How to confirm:** Compare manifest changes to actual `permissions.getAll()` output on an upgraded profile.
* **ConduitLM prevention:** On first run after update, run a host coverage audit and require explicit user re grant flows per site.

---

## D. Design Implications for ConduitLM

This translates the above constraints into concrete architectural decisions.

### 1. Adapter model constraints (site specific adapters)

* **Adapter identity must be match pattern backed.** Each adapter declares:

  * canonical origins (match patterns)
  * required permissions (host and or activeTab)
  * injection strategy (static content script vs programmatic)
  * capture contract (what the adapter extracts and in what format)
    Match patterns are the formal mechanism for URL targeting. ([MDN Web Docs][4])
* **Adapters must be permission aware.** They cannot assume content access; content scripts only run when host permissions are granted. ([MDN Web Docs][2])

### 2. Orchestration layer decisions (message routing, retry design, durable queueing)

* **Background is a job runner, not a session.** Because MV3 background is non persistent, the orchestrator must:

  * persist a durable ingestion job record before doing work
  * resume jobs on the next event trigger
  * use idempotent steps for retry safety ([MDN Web Docs][1])
* **Single message router with deterministic semantics.**

  * Use `runtime.onMessage` with Promise return or `return true` plus `sendResponse`
  * Avoid async listener registration
  * Route by `type` and always produce a response envelope (ok, error, retryable)
    This is required for correctness under MDN rules. ([MDN Web Docs][6])

### 3. Ingestion pipeline decisions (hand off to NotebookLM, idempotency, failure recovery)

* **Two phase ingestion pattern.**

  1. Capture phase: adapter extracts content and metadata and stores a payload locally (durable).
  2. Commit phase: orchestrator performs the NotebookLM hand off.
     The separation exists because background lifetime is not guaranteed. ([MDN Web Docs][1])
* **Idempotency key is mandatory.** Derive from (source origin, document identifier, capture timestamp bucket, hash of normalized content). This prevents duplicates when messages are resent or jobs resume.

### 4. Logging and observability requirements (what must be logged, where, and why)

* **Background logs must show state transitions.** At minimum:

  * permission snapshot (from `permissions.getAll()` or `permissions.contains()`)
  * injection attempt record
  * adapter handshake receipt
  * job state changes (queued, captured, committed, failed, retry scheduled)
    Permissions APIs provide the ground truth of grants. ([MDN Web Docs][9])
* **Debugging workflow must be documented as part of the repo.** Firefox provides the official debugging and temporary install workflows via `about:debugging` and `web-ext`. ([MDN Web Docs][8])

### 5. Site targeting patterns relevant to ConduitLM

Use origin tight patterns. Start with these, refine based on actual capture requirements:

* **ChatGPT:** `*://chat.openai.com/*`
* **Gemini:** `*://gemini.google.com/*`
* **YouTube:** `*://www.youtube.com/*`
* **Google Docs:** `*://docs.google.com/*`
* **NotebookLM:** `*://notebooklm.google.com/*` (if this is the active host you observe in the product)

All must conform to match pattern rules. ([MDN Web Docs][4])
All require host permission grants for content script execution. ([MDN Web Docs][2])

---

## E. Validation Checklist (Pre merge or Pre release Gate)

### Manifest checks

* [ ] `manifest_version: 3` and background is configured as non persistent MV3 compliant (no persistent background page assumptions). ([MDN Web Docs][1])
* [ ] Every target site origin is represented in exactly one of:

  * `host_permissions`
  * `optional_host_permissions`
  * or a documented `activeTab` only strategy
    Host permissions are declared via `host_permissions` in MV3. ([MDN Web Docs][15])
* [ ] `permissions` contains only non host API permissions actually used. ([MDN Web Docs][16])

### Permission checks

* [ ] On startup, run `permissions.getAll()` and log the grants. ([MDN Web Docs][9])
* [ ] Before each adapter run, call `permissions.contains()` for the required origin set. ([MDN Web Docs][10])
* [ ] Permission requests occur only inside a user gesture handler and only for permissions declared in `optional_permissions` and `optional_host_permissions`. ([MDN Web Docs][7])

### Injection checks

* [ ] For manifest declared scripts, confirm the match patterns align with the intended origins and that missing host permission reproduces the expected “no execution” behavior. ([MDN Web Docs][17])
* [ ] For programmatic injection, confirm:

  * `scripting` permission is present
  * host permission or `activeTab` is present
  * content handshake returns within a timeout ([MDN Web Docs][18])
* [ ] If using `contentScripts.register()`, confirm you hold host permissions for the patterns before calling it. ([MDN Web Docs][5])

### Messaging checks

* [ ] `runtime.onMessage` listener is not declared as an async function.
* [ ] Each message route uses either Promise return or `return true` with later `sendResponse`.
* [ ] All routes return a response envelope, including error paths. ([MDN Web Docs][6])

### Background lifetime and durability checks

* [ ] Every ingestion job is persisted before executing capture or commit steps.
* [ ] Replaying the same job does not duplicate NotebookLM commits (idempotent).
* [ ] Restart Firefox and validate jobs can resume after background loss, consistent with non persistent background constraints. ([MDN Web Docs][1])

### Debugging checks (Firefox tools)

* [ ] Extension can be installed temporarily and inspected via `about:debugging`. ([MDN Web Docs][19])
* [ ] Engineers can attach devtools to the extension and locate logs for background, popups, and content scripts using documented workflows. ([MDN Web Docs][13])
* [ ] A `web-ext run` workflow exists for repeatable reproduction. ([MDN Web Docs][20])

---

[1]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts?utm_source=chatgpt.com "Background scripts - Mozilla - MDN Web Docs"
[2]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts?utm_source=chatgpt.com "Content scripts - Mozilla - MDN Web Docs"
[3]: https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/?utm_source=chatgpt.com "Manifest V3 migration guide"
[4]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns?utm_source=chatgpt.com "Match patterns - MDN Web Docs - Mozilla"
[5]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/contentScripts/register?utm_source=chatgpt.com "contentScripts.register() - Mozilla - MDN Web Docs"
[6]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage?utm_source=chatgpt.com "runtime.onMessage - Mozilla - MDN Web Docs"
[7]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions?utm_source=chatgpt.com "permissions - MDN Web Docs - Mozilla"
[8]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Development_Tools?utm_source=chatgpt.com "Browser Extension Development Tools"
[9]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions/getAll?utm_source=chatgpt.com "permissions.getAll() - Mozilla - MDN Web Docs"
[10]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions/contains?utm_source=chatgpt.com "permissions.contains() - Mozilla - MDN Web Docs"
[11]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/insertCSS?utm_source=chatgpt.com "scripting.insertCSS() - Mozilla - MDN Web Docs"
[12]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/sendMessage?utm_source=chatgpt.com "tabs.sendMessage() - Mozilla - MDN Web Docs"
[13]: https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Debugging?utm_source=chatgpt.com "Debugging"
[14]: https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/?utm_source=chatgpt.com "Developing extensions for Firefox for Android"
[15]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/host_permissions?utm_source=chatgpt.com "host_permissions - Mozilla - MDN Web Docs"
[16]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions?utm_source=chatgpt.com "permissions - Mozilla - MDN Web Docs"
[17]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts?utm_source=chatgpt.com "content_scripts - Mozilla - MDN Web Docs"
[18]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/executeScript?utm_source=chatgpt.com "scripting.executeScript() - Mozilla - MDN Web Docs"
[19]: https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Temporary_Installation_in_Firefox?utm_source=chatgpt.com "Temporary installation in Firefox"
[20]: https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Getting_started_with_web-ext?utm_source=chatgpt.com "Getting started with web-ext"
