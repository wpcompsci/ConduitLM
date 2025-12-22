# ConduitLM Codebase Map

This document provides a comprehensive overview of the ConduitLM project structure, including descriptions of all files and directories.

## Top-Level Files

| File Name | Location | Description |
| :--- | :--- | :--- |
| `.eslintrc.cjs` | `/` | ESLint configuration for code linting and style enforcement. |
| `.prettierignore` | `/` | Specifies files and folders that Prettier should ignore during formatting. |
| `.prettierrc.json` | `/` | Configuration settings for Prettier code formatter. |
| `AGENTS.md` | `/` | Specialized documentation and instructions for AI agents working on this project. |
| `README.md` | `/` | General project overview, installation instructions, and basic information. |
| `package.json` | `/` | Project manifest defining dependencies, scripts, and metadata. |
| `package-lock.json` | `/` | Automatically generated lockfile for npm dependencies. |

## Source Code (`/src`)

The core logic and assets for the ConduitLM Firefox extension.

| File Name | Location | Description |
| :--- | :--- | :--- |
| `manifest.json` | `src/` | The Manifest V3 configuration file for the Firefox extension. |
| `main.js` | `src/background/` | Entry point for the extension's background script. |
| `router.js` | `src/background/` | Manages messaging and routing between different parts of the extension. |
| `content_scraper.js` | `src/ingestion/` | Responsible for extracting content and data from the active web pages. |
| `pipeline.js` | `src/ingestion/` | Orchestrates the end-to-end ingestion process from scraping to external delivery. |
| `AGENTS.md` | `src/integrations/notebooklm/` | Integration-specific documentation for AI agents focusing on NotebookLM. |
| `client.js` | `src/integrations/notebooklm/` | Client implementation for interacting with the NotebookLM service. |
| `parse.js` | `src/integrations/notebooklm/` | Parsing logic for handling data formats specific to NotebookLM. |
| `rpc.js` | `src/integrations/notebooklm/` | Implements Remote Procedure Call logic for communication with NotebookLM. |
| `tokens.js` | `src/integrations/notebooklm/` | Logic for managing authentication tokens or session-related tokens for NotebookLM. |
| `jspdf.umd.min.js` | `src/lib/` | Minified library used for generating PDF documents within the extension. |
| `jszip.min.js` | `src/lib/` | Minified library for creating and manipulating ZIP archive files. |
| `popup.css` | `src/ui/popup/` | Styling for the main extension popup interface. |
| `popup.html` | `src/ui/popup/` | HTML structure for the extension's popup UI. |
| `popup.js` | `src/ui/popup/` | Logic and event handling for the extension's popup UI. |
| `formatters.js` | `src/utils/` | General utility functions for data formatting and sanitization. |
| `pdf-generator.js` | `src/utils/` | Internal wrapper logic for PDF generation using `jspdf`. |

## Knowledge Bank (`/Knowledge Bank`)

Documentation, specifications, and reference materials that guide the development of ConduitLM.

### Canonical Architecture & Rules
| File Name | Location | Description |
| :--- | :--- | :--- |
| `Canonical Extraction from Kortex (Authoritative).md` | `Knowledge Bank/Canonical Architecture & Rules/` | Authoritative guide for extracting data from the Kortex platform. |
| `ConduitLM Architecture Rules and Modularity Charter.md` | `Knowledge Bank/Canonical Architecture & Rules/` | Defines the core architectural principles and modularity standards for the project. |
| `ConduitLM Core Send Flow Specification.md` | `Knowledge Bank/Canonical Architecture & Rules/` | Detailed technical specification for the primary data transmission flow. |
| `ConduitLM Firefox MV3 Canonical Architecture & Enforcement Rules.md` | `Knowledge Bank/Canonical Architecture & Rules/` | Enforces standards for development within the Firefox Manifest V3 environment. |
| `ConduitLM UX Contract.md` | `Knowledge Bank/Canonical Architecture & Rules/` | Document outlining the user experience design principles and interaction "contracts". |
| `Firefox MV3 Event Page Architecture & Lifecycle Deep Reference.md` | `Knowledge Bank/Canonical Architecture & Rules/` | Deep-dive reference on background script lifecycles in Manifest V3. |
| `Firefox MV3 Permissions, Content Scripts, and Messaging Behavior Reference.md` | `Knowledge Bank/Canonical Architecture & Rules/` | Detailed reference for permissions and messaging patterns in Firefox MV3. |

### External & Legacy References
| File Name | Location | Description |
| :--- | :--- | :--- |
| `Kortex Forensic Reference (Read Only).md` | `Knowledge Bank/External & Legacy References/` | Historical reference material related to Kortex for forensic lookups. |
| `Kortex Plugin (Reference Only)/` | `Knowledge Bank/External & Legacy References/` | *[Directory]* Contains the complete source of a legacy Kortex plugin for architectural reference. |

## Miscellaneous

- `node_modules/`: (Directory) Contains all third-party dependencies and libraries installed via npm. This folder is managed by the package manager and should not be modified manually.
- `.git/`: (Directory) Contains the version history and configuration for the Git repository.
