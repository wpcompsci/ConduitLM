# ConduitLM UX Contract

**Version 1.0 – Binding User Experience Definition**

## 1. Purpose of This Document

This document defines the **non-negotiable user experience contract** for ConduitLM.

It describes:

* What ConduitLM is
* What the user expects it to do
* What success and failure look like from the user’s perspective

Any implementation, feature, or architectural decision that violates this contract is considered incorrect, regardless of technical merit.

---

## 2. Core Identity

ConduitLM is a **knowledge ingestion pipeline for Google NotebookLM**.

It is not:

* A browser clipper
* A note-taking tool
* An AI assistant
* A research organizer
* A productivity dashboard

From the user’s perspective, ConduitLM exists for one reason only:

> To move high-quality sources into NotebookLM cleanly, reliably, and with intent.

If ConduitLM introduces friction, ambiguity, or post-ingestion cleanup, it has failed its core purpose.

---

## 3. User Mental Model

The user understands ConduitLM as:

> “The fastest, safest way to send meaningful sources into NotebookLM.”

Key assumptions embedded in this mental model:

* NotebookLM is the system of record
* Sources matter more than notes
* Ingestion should be deliberate, not automatic
* The tool should be invisible until needed, then decisive

ConduitLM must reinforce this mental model at all times.

---

## 4. Primary User Actions

### 4.1 Intentional Sending

When the user activates ConduitLM, they expect to perform a **clear, intentional action**, such as:

* Send a full YouTube transcript
* Send selected text from a webpage
* Send a cleaned AI conversation
* Send a document source

Vague actions such as “save,” “clip,” or “archive” are explicitly disallowed.

The user must always know:

* What content is being sent
* When it is being sent
* Where it is going

---

### 4.2 Explicit Destination Control

Before sending content, the user must explicitly choose the destination NotebookLM notebook.

This includes two supported paths:

1. Selecting an existing notebook
2. Creating a new notebook at the moment of sending

Creating a new notebook must:

* Require only a notebook name
* Be part of the same send action
* Result in immediate ingestion into that notebook

Notebook creation and ingestion are perceived by the user as **one atomic operation**.

ConduitLM does not manage notebooks beyond this moment.

---

## 5. Trust and Output Quality

Once the user confirms a send action, they assume:

* The content is clean
* Irrelevant UI elements are removed
* The structure is logical and usable inside NotebookLM
* No manual cleanup will be required afterward

If the user feels the need to review or correct the output after ingestion, the experience has failed.

Trust is a core requirement.

---

## 6. Source-Specific Expectations

### 6.1 YouTube

The user expects:

* Accurate transcript extraction
* Logical ordering and completeness
* Video title, channel name, and URL preserved
* No UI artifacts

If YouTube ingestion is unreliable, ConduitLM loses credibility as a whole.

---

### 6.2 AI Chat Platforms (ChatGPT, Gemini, Claude)

The user expects:

* Clear separation between prompts and responses
* Chronological integrity
* No UI noise or duplicated text
* Clean formatting suitable for reference inside NotebookLM

Optional behavior may include:

* Excluding system messages
* Sending selected turns only

---

### 6.3 Web Pages

The user expects:

* Main content only
* Meaningful headings preserved
* No navigation bars, ads, cookie notices, or footers
* A result that feels intentional, not scraped

A raw “reader mode dump” is insufficient.

---

## 7. Feedback and Error Handling

ConduitLM must provide **explicit, unambiguous feedback**.

### On success:

* The user is told the content was sent
* The destination notebook is named
* There is no ambiguity

### On failure:

* The user is told what failed
* Partial success is never silent
* Content is never lost without notice

Generic errors such as “something went wrong” are unacceptable.

---

## 8. Speed and Friction Tolerance

ConduitLM prioritizes **reliability over speed**.

The tool may be:

* Slightly slower
* More deliberate
* More explicit

The tool may not be:

* Implicit
* Magical
* Unpredictable

One extra confirmation click is preferable to a bad ingestion.

---

## 9. Explicit Anti-Requirements

ConduitLM must not include:

* Recommendation systems
* Tagging systems that duplicate NotebookLM
* Local content libraries
* Analytics dashboards
* AI-based content rewriting or enhancement
* Forced workflows or automation

ConduitLM is a **pipe**, not a workspace.

---

## 10. Success Criteria

From the user’s perspective, ConduitLM is successful if:

* It becomes muscle memory
* The user stops thinking about ingestion mechanics
* NotebookLM becomes richer without extra effort
* The user trusts it during real research, not just experiments

Failure looks like:

* Rechecking ingested content
* Retrying sends
* Avoiding certain sources
* Falling back to manual copy-paste

---

## 11. Governing Question

Before adding or modifying any feature, the following question must be answered:

> Does this reduce friction between insight and NotebookLM, or does it add ceremony?

If it adds ceremony, it does not belong in ConduitLM.

---

## 12. Contract Status

This UX Contract is binding.

All implementation, architecture, and feature decisions must align with this document. Any deviation requires a conscious revision of the contract, not an ad hoc exception.
