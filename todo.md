# Todo

Content gaps found by `task check:test` (specifically
`tests/quality/links/local-links.test.ts` and `external-links.test.ts`) that need real content
or a decision, not a mechanical link fix. These are expected, currently-failing test cases —
see each file for the exact assertion.

## Stub pages (body is literally just "blub")

Placeholder pages with no real content yet:

- `core/src/data/pages/02-guide/01-authentication.mdx`
- `core/src/data/pages/02-guide/02-elements.mdx`
- `core/src/data/pages/02-guide/03-search/01-choosing-a-search-step.mdx`
- `core/src/data/pages/02-guide/03-search/02-writing-an-elasticsearch-query.mdx`
- `core/src/data/pages/02-guide/03-search/03-parameters-and-expressions.mdx`

`blub` is whitelisted in `core/tests/quality/spellcheck/project-words.txt` so spellcheck stays
green — it does not mean these pages are finished.

## `./todo-link` placeholder (3 occurrences)

`core/src/data/pages/01-getting-started/02-first-api-requests.mdx` links to a literal
`./todo-link` placeholder three times (lines 9, 77, 88 as of writing) — each needs a real target
once the corresponding tutorial page exists.

## Cypher Path Subset — dead "grammars" link

`core/src/data/pages/03-reference/02-search/02-cypher-path-subset.mdx` links to
`../../concepts/grammars?id=cypher-path-subset`, a page that doesn't exist anywhere in this
project (looks like it was carried over from a different docs source). Needs either a real
target or the link removed.

## Caching guide — hand-captured conditional-request examples

`core/src/data/pages/02-guide/07-caching-and-conditional-requests.mdx` ("Sending a conditional
successful request" / "Sending a conditional invalid request") shows real `204`/`412` responses
for a conditional `PATCH`, captured by hand from a live run against the `api` dev container's
reference dataset (mirroring `tests/FeatureTests/General/IfMatchTest.php::testEtagIfMatchWithPatchElement`
in the `ember-nexus-dev-api/api` repo) rather than sourced from a committed fixture file. Every
other request/response example on this site is pulled from a generated fixture (the
`command-output/*.html` pattern for CLI commands, `query.sh`/`header.txt`/`result.json` for search
examples, `swagger/paths/**/*.json` for endpoint examples) so it can't silently drift from actual
behavior. These two blocks have no such fixture and will go stale silently if the API's `ETag`
computation, problem-response shape, or header set ever changes. Worth wiring into the API repo's
`tests/ExampleGenerationController` pipeline (or equivalent) the same way, so they're generated and
verified like everything else instead of hand-maintained.

## Element Hydration — leftover docsify content

`core/src/data/pages/03-reference/02-search/03-element-hydration.mdx` has two separate gaps:

- Two `[Response Header](... ':include :type=code')` / `[Response Body](...)` links use
  **docsify's `:include` syntax**, which does nothing in this Astro/MDX site — they render as
  plain broken links, and the `response-header.txt` / `response-body.json` files they point at
  don't exist in the repo. Needs porting to a real code-block example (however other reference
  pages on this site show request/response examples) or dropping.
- The "Further examples" section links to four pages that were never built:
  `/search/example/element-hydration/{implicit-elements-hydration,implicit-paths-hydration,
  explicit-elementids-hydration,parameterized-elementids-hydration}`. Either write these pages
  or remove the section.
