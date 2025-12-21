# NotebookLM adapter guidance

## Integration surface (authoritative)
- Endpoint: https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute
- RPC IDs are volatile. Isolate them in one module.

## Token rules
- Extract `at` and `bl` defensively from HTML.
- Never store tokens in memory-only state beyond a single job.
- On parse failure: return explicit classified error (auth/token).

## Response parsing
- No fixed line offsets.
- Validate structure before dereferencing nested arrays.
- Never ignore partial responses.

## Failure classification (required)
auth | permission | notebook_create | source_ingest | parse | unknown
