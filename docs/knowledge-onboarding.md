# Client knowledge onboarding

A client knowledge base is admitted separately from runtime installation.

## Preconditions

- client contour is running from an immutable release;
- provider/model and user channel acceptance have passed;
- document owner and permitted audience are recorded;
- no material from another client, test or production contour is selected.

## Acceptance for a knowledge release

1. Ingest one synthetic document through the approved pipeline.
2. Query a fact contained only in that document.
3. Verify the answer cites the document and fragment.
4. Query a fact not present in the document; verify the agent says that it is unknown.
5. Remove the document; verify the retrieval result disappears.
6. Run a negative cross-contour search test using a neutral marker; verify no foreign result, path or metadata is returned.

Until all six checks pass, the contour has an empty knowledge root, not a production RAG capability.
