# Todo

Content gaps that need real content or a decision, not a mechanical link fix.

## Fixed since last pass (kept here for reference, remove once confirmed)

- **Stub pages** (`02-guide/01-authentication.mdx`, `02-elements.mdx`,
  `02-guide/03-search/01-choosing-a-search-step.mdx`, `02-writing-an-elasticsearch-query.mdx`) all
  now have real content, no `blub` placeholder left.
- `03-parameters-and-expressions.mdx` was renamed to `04-parameters-and-expressions.mdx` and has
  real content.
- **`./todo-link` placeholders** in `01-getting-started/02-first-api-requests.mdx` are gone; the
  page's "Next Steps" section (was a literal `Links, todo:` stub) now links to
  `/guide/organizing-and-sharing-data` and `/guide/search`.
- **Cypher Path Subset dead "grammars" link** now points to the real
  `/reference/search/cypher-path-subset/grammar` page.
- **Element Hydration docsify leftovers** are gone; the page now uses real fixture-backed
  `<SearchResponseCard>` examples and its "Examples" section links to two pages that actually
  exist (`explicit-element-ids`, `parameterized-element-ids`) instead of the four broken links.
- Added `tests/quality/content/todo.test.ts`, which scans built `dist/**/*.md` for the word
  "todo" and fails with `file:line` — catches this class of leftover placeholder automatically
  going forward.
- Fixed a grammar error in `02-guide/07-caching-and-conditional-requests.mdx` ("Should the
  element did change" → "Should the element have changed").
- Moved the "Elasticsearch is not real-time" note from `03-reference/02-element-schema.mdx` to
  small notes on `endpoints/01-element/07-post-element.mdx`, `08-put-element.mdx`, and
  `09-patch-element.mdx`, where it's actually actionable.

## Still open

### Caching guide — hand-captured conditional-request examples

`core/src/data/pages/02-guide/07-caching-and-conditional-requests.mdx` ("Sending a conditional
successful request" / "Sending a conditional invalid request", currently around lines 213-279)
still shows real `204`/`412` responses for a conditional `PATCH` as hand-typed code blocks, not
imported from a fixture file (unlike every other request/response example on this site, e.g. the
`command-output/*.html` pattern for CLI commands, `query.sh`/`header.txt`/`result.json` for search
examples, `swagger/paths/**/*.json` for endpoint examples). Will go stale silently if the API's
`ETag` computation, problem-response shape, or header set ever changes. Worth wiring into the API
repo's `tests/ExampleGenerationController` pipeline (or equivalent) the same way.

### `backup-create` command example is an unhandled PHP crash trace

`core/dist/command/backup-create.md` (source: presumably a `command-output/*.html` fixture for
`backup-create` in the API repo) — the "Example" block is not a successful run, it's a raw
`TypeError` stack trace (`BackupCreateCommand::__construct(): Argument #5 ($elementService) must
be of type App\Service\ElementService, ... ContainerBag given`). Reads as if the documented
command is broken. Needs a real successful-run fixture regenerated from the API repo.

### Mismatched/copy-pasted example payloads (swagger fixture reuse bug)

Likely more instances than these three — worth a full sweep of `core/src/data/swagger/*.json`,
not just fixing these by hand:

- `core/dist/api/get-token.md` — 200 response body has `"type": "Token"` but the `data` fields
  (`name: "Blue"`, `content: "Blue is one of the three primary colours..."`) look like a
  Tag/Comment fixture, not a token.
- `core/dist/api/post-element-file.md` — 400 example error body is the *change-password*
  endpoint's message (`"...property 'newPassword' is not identical to the old password..."`)
  reused on a file-upload endpoint.
- `core/dist/api/patch-element.md` — documents a `Location` response header (with example value
  and MDN/http.dev link section) on a `204 No Content` PATCH response. PATCH updates an existing
  resource and creates nothing, so `Location` shouldn't apply here; looks copy-pasted from the
  POST/PUT header block.
