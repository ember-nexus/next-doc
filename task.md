# Changeset: Markdown output target for MDX content

Implement a second render target so every `.mdx` page is emitted both as HTML (unchanged)
and as spec-compliant CommonMark/GFM at `<route>.md`, in a single `astro build`.

**Repo:** `ember-nexus/next-doc`, app root is `core/`. Package manager: `pnpm`.
Dev shell: `task dev:cli`, then `pnpm run dev`.

---

## 1. Verified current state

Do not re-derive these; they were checked against the installed versions.

| Fact | Value |
|---|---|
| Astro | `7.2.4` |
| `@astrojs/mdx` | `7.0.7` |
| Content files | 69, **all `.mdx`**, zero `.md` (pages 21, endpoints 38, commands 10) |
| Collections | `pages`, `endpoints`, `commands` in `src/content.config.ts`, glob loader over `src/data/*` |
| Page shells | `src/pages/[...slug].astro`, `api/[endpoint].astro`, `command/[command].astro`, `schema/[schema].astro` |
| Route helpers | `src/lib/routes.ts` — `pageSlug`, `endpointParam`, `commandParam`, `schemaPath` |
| Components used inside MDX | `Code`, `Link`, `TwoColumn`, `ComparisonCard`, `SearchResponseCard`, `EndpointGroupList`, `CommandGroupList`, `SchemaList` |

Three facts the design depends on:

1. **`@astrojs/mdx` compiles every MDX file to**
   `components: { Fragment: _Fragment, ...components, ...props.components }`
   (`dist/vite-plugin-mdx-postprocess.js`). `props.components` is spread last, so it wins.
   MDX routes a capitalized tag through `_components.X` **only when `X` is not a local binding** —
   an `import` in the MDX file bypasses the map entirely.
2. **Astro's MDX transform filter is exactly `/\.mdx$/`** (`dist/vite-plugin-mdx.js`).
   A query-suffixed id such as `foo.mdx?md` does not match, so a second MDX plugin can claim it.
3. **`entry.filePath`** is set by the glob loader to a posix path relative to `config.root`
   (`src/data/pages/index.mdx`) and survives onto entries returned by `getCollection`.
   Astro's own `renderEntry` uses the same key (`contentModules.get(entry.filePath)`).

---

## 2. Architecture

Three mechanisms, in order of dependency:

**(a) Implicit components.** Content stops importing components. Each page shell passes its own
registry via `<Content components={...} />`. Same MDX tree, two registries, no duplicated content.

**(b) Second compilation.** Astro's MDX pipeline is HTML-committed — `extendMarkdownConfig` pulls
`rehypeExpressiveCode` in, so a code fence is already a `<figure class="frame">` before
`_components` is consulted. So the markdown target recompiles the same file under `?md` with its
own options, staying inside Vite so `?raw` / `.json` / `.yaml` imports resolve identically.

**(c) mdast runtime.** The `?md` compilation uses `jsxImportSource: 'mdmx'`, a runtime whose
`jsx()` returns **mdast nodes** instead of VDOM. Serialization is `mdast-util-to-markdown`, which
gives correct CommonMark escaping for free. **HTML is never produced, serialized, or parsed
anywhere in this path.**

---

## 3. Phase 0 — dependencies

```bash
cd core
pnpm add -D @mdx-js/rollup mdast-util-to-markdown mdast-util-gfm remark-gfm remark-frontmatter
```

Add to `core/tsconfig.json` `compilerOptions.paths`:

```json
"mdmx/jsx-runtime": ["./src/mdmx/jsx-runtime.ts"],
"mdmx/jsx-dev-runtime": ["./src/mdmx/jsx-runtime.ts"]
```

Mirror the same two aliases in `astro.config.mjs` under `vite.resolve.alias`.

---

## 4. Phase 1 — implicit components

**This phase is independently shippable and must be verified green before continuing.**

### 4.1 Create `src/component/registry.html.ts`

```ts
import { Code } from 'astro-expressive-code/components';
import ComparisonCard from './ComparisonCard.astro';
import CommandGroupList from './CommandGroupList.astro';
import EndpointGroupList from './EndpointGroupList.astro';
import Link from './Link.astro';
import SchemaList from './SchemaList.astro';
import SearchResponseCard from './SearchResponseCard.astro';
import TwoColumn from './TwoColumn.astro';

export const htmlComponents = {
  Code, ComparisonCard, CommandGroupList, EndpointGroupList,
  Link, SchemaList, SearchResponseCard, TwoColumn,
};
```

### 4.2 Strip component imports from all 69 `.mdx` files

Remove **only** the component import lines, e.g.:

```diff
-import { Code } from 'astro-expressive-code/components';
-import ComparisonCard from '../../../../component/ComparisonCard.astro';
-import TwoColumn from '../../../../component/TwoColumn.astro';
```

> **Keep every data import.** `?raw`, `.json` and `.yaml` imports are values, not components,
> and both pipelines need them:
> ```
> import emberNexusQuery from "./01-elasticsearch-query-dsl-mixin/ember-nexus-query.txt?raw"
> import simplePathSearch from '../assets/simple-path-search.json';
> import config from "../../../../public/ember_nexus.yaml?raw"
> ```
> Rule of thumb: if the identifier appears inside `{...}` as a prop value, keep it. If it appears
> as `<Identifier>`, delete the import.

### 4.3 Pass the registry in all four `.astro` shells

```diff
-<Content />
+<Content components={htmlComponents} />
```

### 4.4 Verify

`pnpm run build` must succeed and `dist/` output must be byte-identical to a pre-change build
except for irrelevant hashes. A missing registry entry surfaces as
`Expected component X to be defined` — that is the intended failure mode.

---

## 5. Phase 2 — the mdast JSX runtime

### 5.1 `src/mdmx/jsx-runtime.ts`

```ts
import type { RootContent } from 'mdast';

export const Fragment = Symbol.for('mdmx.fragment');

type Child = RootContent | RootContent[] | string | number | null | undefined | false;

export function jsx(type: unknown, props: Record<string, any>): any {
  const children = flatten(props?.children);
  if (type === Fragment) return children;
  if (typeof type === 'function') return type({ ...props, children });
  if (typeof type === 'string') {
    const handler = intrinsics[type];
    if (!handler) throw new Error(`[mdmx] no mdast mapping for <${type}>`);
    return handler(props ?? {}, children);
  }
  throw new Error(`[mdmx] unsupported element type: ${String(type)}`);
}
export const jsxs = jsx;
export const jsxDEV = jsx;

export function flatten(children: Child | Child[]): RootContent[] { /* … */ }
```

`flatten` must: drop `null` / `undefined` / `false` / `''`, recurse into arrays,
and convert `string | number` to `{ type: 'text', value: String(x) }`.

### 5.2 Intrinsic map

MDX always goes mdast → hast → JSX, so the tag names are hast names. Mapping them back is a
tree-to-tree transform, not an HTML round-trip. Implement all of these:

| Tag | mdast |
|---|---|
| `p` | `paragraph` |
| `h1`–`h6` | `heading` with matching `depth` |
| `a` | `link` (`url` from `href`, `title` from `title`) |
| `ul` / `ol` | `list` (`ordered`, `start` from `start`) |
| `li` | `listItem` (`checked` if a GFM task-list `input` child is present — strip that child) |
| `strong` / `em` / `del` | `strong` / `emphasis` / `delete` |
| `blockquote` | `blockquote` |
| `hr` | `thematicBreak` |
| `br` | `break` |
| `img` | `image` (`url` from `src`, `alt`, `title`) |
| `table` / `thead` / `tbody` / `tr` / `th` / `td` | `table` (`align` from each cell's `align`) / pass-through / pass-through / `tableRow` / `tableCell` / `tableCell` |
| `code` | see below |
| `pre` | see below |

**Code fences.** hast gives `<pre><code class="language-json">`. The `code` handler cannot know
its parent, so have it return an `inlineCode` node carrying a non-enumerable `block` payload, and
have `pre` unwrap it:

```ts
code: (props, children) => {
  const value = textOf(children);
  const node: any = { type: 'inlineCode', value };
  const lang = /(?:^|\s)language-([\w-]+)/.exec(props.className ?? '')?.[1];
  Object.defineProperty(node, 'block', {
    value: { type: 'code', lang: lang ?? null, value: value.replace(/\n$/, '') },
    enumerable: false,
  });
  return node;
},
pre: (_props, children) => (children[0] as any)?.block
  ?? { type: 'code', lang: null, value: textOf(children) },
```

Set `elementAttributeNameCase: 'react'` in the compile options (Phase 3) so prop names are
`className` / `htmlFor` as assumed above.

Throw loudly on unmapped tags rather than degrading — a silent drop is a content bug that ships.

### 5.3 `src/mdmx/serialize.ts`

```ts
import { toMarkdown } from 'mdast-util-to-markdown';
import { gfmToMarkdown } from 'mdast-util-gfm';

export const serialize = (children) => toMarkdown(
  { type: 'root', children },
  { extensions: [gfmToMarkdown()], bullet: '-', rule: '-', emphasis: '_',
    fences: true, listItemIndent: 'one', resourceLink: false },
);
```

---

## 6. Phase 3 — `?md` compilation

In `astro.config.mjs`, add to `vite.plugins`:

```js
import mdxRollup from '@mdx-js/rollup';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';

mdxRollup({
  include: /\.mdx\?md$/,
  jsxImportSource: 'mdmx',
  elementAttributeNameCase: 'react',
  remarkPlugins: [remarkFrontmatter, remarkGfm],
  rehypePlugins: [],          // deliberately none — no expressive-code, no link augmentation
})
```

`remarkFrontmatter` is **required**; without it the YAML block leaks into the body as a
`thematicBreak` plus a heading.

> **Verify first:** rollup's `createFilter` may normalise the query off the id before `include`
> is tested. Confirm with a scratch build. If it strips the query, replace the entry with a thin
> wrapper plugin (`enforce: 'pre'`) that tests `id.endsWith('.mdx?md')` itself and delegates to
> `mdxRollup({...}).transform.call(this, code, id.slice(0, -3))`, plus a `resolveId` hook that
> preserves the `?md` suffix. Do not skip the verification — pick whichever actually fires.

---

## 7. Phase 4 — markdown component registry

One file per component under `src/mdmx/registry/`, aggregated in `index.ts` as `mdComponents`.
Each is a plain function `(props) => RootContent | RootContent[]`. Reference behaviour:

- **`TwoColumn`** — structural only, returns `children` unchanged.
- **`ComparisonCard`** — `heading` depth 4 prefixed `✓ ` / `✗ ` / `` by `variant`, then `children`.
- **`Code`** — `{ type: 'code', lang, value: props.code }`.
- **`Link`** — `link` from `props.link.url` / `props.link.name`.
- **`EndpointGroupList`** / **`CommandGroupList`** / **`SchemaList`** — a `list` built from the
  same collection query the `.astro` version runs (see Phase 5).
- **`SearchResponseCard`** — no interactive equivalent exists; emit the response body as a
  ` ```json ` fence and the headers as a ` ```http ` fence, under depth-5 headings.
  Do **not** strip it.

---

## 8. Phase 5 — synchronous collection access

`jsx()` is synchronous, but `EndpointGroupList` needs `await getCollection('endpoints')`.
Do not make the runtime async — it infects the whole tree.

Create `src/lib/collections.ts` exporting `await prime()` (populates a module-level cache) plus
synchronous getters such as `endpointsInGroup(group)`. Call `prime()` once in each `.md.ts`
endpoint before rendering. **Refactor the existing `.astro` components to read from the same
getters**, so the query logic is not duplicated between the two implementations.

---

## 9. Phase 6 — routes

### 9.1 `src/mdmx/index.ts`

```ts
export { getCollection, getEntry, render } from 'astro:content';
export { renderMd } from './content';
```

### 9.2 `src/mdmx/content.ts`

```ts
const modules = import.meta.glob('/src/data/**/*.mdx', { query: '?md', import: 'default' });

export async function renderMd(entry: { filePath?: string }) {
  const load = modules[`/${entry.filePath}`];
  if (!load) throw new Error(`[mdmx] no markdown module for ${entry.filePath}`);
  return (await load())({ components: mdComponents });
}
```

### 9.3 `src/pages/[...slug].md.ts`

Endpoint, **not** a `.md.astro` page: `getOutFile` in Astro 7.2.4 emits `<pathname>/index.html`
unconditionally for `routeType: 'page'` under `build.format: 'directory'`, so `[...slug].md.astro`
would produce `foo.md/index.html`. Only `routeType: 'endpoint'` uses `basename(pathname)` verbatim.

```ts
export async function getStaticPaths() {
  const pages = await getCollection('pages');
  return pages.map((entry) => ({
    params: { slug: entry.id === 'index' ? 'index' : pageSlug(entry.id) },
    props: { entry },
  }));
}

export async function GET({ props: { entry } }) {
  await prime();
  const body = await renderMd(entry);
  const md = serialize([
    { type: 'heading', depth: 1, children: [{ type: 'text', value: entry.data.title }] },
    ...body,
  ]);
  return new Response(md, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
```

> **Index gotcha:** `[...slug].astro` maps the index entry to `undefined` so it can claim `/`.
> Here it must be the literal `'index'`, or the output filename resolves to `basename('/')` — empty.

Extract the shared params builder into `src/lib/routes.ts` so the HTML and markdown route sets
cannot drift.

### 9.4 Remaining shells

Ship `[...slug].md.ts` first and confirm output before starting these.
`command/[command].md.ts` mirrors its `.astro` twin closely. `api/[endpoint].md.ts` is the
largest: it composes the MDX body with swagger-derived Request/Response cards, so it needs
markdown implementations of `RequestCard`, `RequestBodyCard`, `RequestHeaderCard`,
`RequestParameterCard`, `ResponseCard`, `ResponseHeaderCard`. `schema/[schema].md.ts` is generated
purely from swagger and uses no MDX at all — it only needs `SchemaPropertyList` in mdast form.

---

## 10. Phase 7 — tests

Add to the existing vitest suite (`pnpm run test`):

1. Every collection entry resolves to a `?md` module:
   `expect(modules[`/${entry.filePath}`], entry.id).toBeDefined()`
2. Round-trip: `remark-parse` each generated `.md`; the parse must not error and must contain no
   `html` nodes. **An `html` node in the output means something leaked through and is a bug.**
3. Snapshot the markdown for three fixtures: `index`, the `TwoColumn > ComparisonCard > Code`
   nesting in `02-reference/02-search/01-elasticsearch-query-dsl-mixin`, and one
   `SearchResponseCard` page.

---

## 11. Acceptance criteria

- [ ] `pnpm run build` produces `dist/**/*.md` alongside the existing HTML; HTML output is unchanged.
- [ ] No `.mdx` file imports a component; all data imports still present and working.
- [ ] No HTML is serialized or parsed anywhere in the markdown path.
- [ ] Generated markdown contains no `html` mdast nodes and no leaked JSX.
- [ ] Nested components (`TwoColumn > ComparisonCard > Code`) render correctly.
- [ ] Frontmatter does not appear in the body.
- [ ] `pnpm run test` and `pnpm run cs` pass.

## 12. Out of scope

`llms.txt` aggregation, serving rules in `tools/Caddyfile`, sitemap entries for `.md` routes,
and pagefind indexing of markdown output. Note them, do not implement them.
