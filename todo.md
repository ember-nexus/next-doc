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
