// A JSX runtime that produces mdast nodes instead of VDOM/HTML.
//
// @astrojs/mdx always compiles JSX through mdast -> hast -> JSX, so the tag
// names this runtime receives are hast tag names (`p`, `a`, `ul`, ...), not
// the original mdast node types. Mapping them back is a tree-to-tree
// transform: build the mdast node the JSX call describes, never touch HTML.
//
// Used only by the `?md` compilation of MDX (see astro.config.mjs); the HTML
// render target still goes through @astrojs/mdx's default (React-like) JSX
// runtime.
import type { RootContent } from "mdast";

export const Fragment = Symbol.for("mdmx.fragment");

type Child =
  RootContent | RootContent[] | string | number | null | undefined | false;

// JSX props are an arbitrary bag supplied by whatever tag/component is being
// rendered — there's no single shape to check against here, so each handler
// narrows the specific keys it reads.
type Props = Record<string, unknown>;

type Handler = (
  props: Props,
  children: RootContent[],
) => RootContent | RootContent[];

// Three intrinsics stash an extra payload on the mdast node they return, as a
// non-enumerable property invisible to mdast-util-to-markdown, for a sibling
// handler further up the tree to read back out:
//   - leafCode()   attaches `block`      (the real "code" node, see below)
//   - `input`      attaches `__checkbox` (for the `li` handler)
//   - `th`/`td`    attaches `__align`    (for the `table` handler)
type CodeCarrier = RootContent & { block?: RootContent };
type CheckboxCarrier = RootContent & { __checkbox?: boolean };
type AlignCarrier = RootContent & {
  __align?: "left" | "right" | "center" | null;
};

/**
 * mdast node types that may appear as siblings inside phrasing (inline)
 * content — i.e. everything that is legal directly inside a `paragraph`,
 * `heading`, `tableCell`, etc. Anything else is a block node.
 */
const PHRASING_TYPES = new Set([
  "text",
  "inlineCode",
  "link",
  "emphasis",
  "strong",
  "delete",
  "image",
  "break",
]);

const isPhrasing = (node: RootContent): boolean =>
  PHRASING_TYPES.has(node.type);

/**
 * Container tags (`li`, `blockquote`, `div`, ...) can receive a mix of loose
 * text/inline nodes and already-block nodes (e.g. a nested `<ul>`). mdast
 * requires block-level containers to hold only block nodes, so consecutive
 * runs of phrasing content are folded into a `paragraph`.
 */
function groupIntoBlocks(nodes: RootContent[]): RootContent[] {
  const out: RootContent[] = [];
  let run: RootContent[] = [];
  const flushRun = (): void => {
    if (run.length > 0) {
      out.push({ type: "paragraph", children: run } as RootContent);
      run = [];
    }
  };
  for (const node of nodes) {
    if (isPhrasing(node)) {
      run.push(node);
    } else {
      flushRun();
      out.push(node);
    }
  }
  flushRun();
  return out;
}

export function textOf(nodes: RootContent[]): string {
  return nodes
    .map((n) => {
      if (n.type === "text" || n.type === "inlineCode") return n.value;
      if ("children" in n && Array.isArray(n.children))
        return textOf(n.children as RootContent[]);
      return "";
    })
    .join("");
}

function parseAlign(props: Props): "left" | "right" | "center" | null {
  const style = props.style as { textAlign?: unknown } | undefined;
  const raw = props.align ?? style?.textAlign ?? null;
  if (raw === "left" || raw === "right" || raw === "center") return raw;
  return null;
}

/**
 * Shared implementation for the two "code-bearing" element pairs in this
 * document set: `<pre><code>` (real fenced code) and `<g6-graph><script>`
 * (a JSON payload for the interactive graph component, which has no
 * interactive markdown equivalent — the JSON is the closest useful thing to
 * ship in its place). Both follow the same shape: an inner leaf element
 * carries the text as a non-enumerable `block` payload (so it still behaves
 * as ordinary inline code if never unwrapped — e.g. real inline `` `code` ``
 * outside of a `<pre>`), and the outer element unwraps it into a `code` node.
 */
function leafCode(
  lang: string | null,
  cleanValue: (v: string) => string,
  meta?: string,
): Handler {
  return (_props, children) => {
    const value = textOf(children);
    const node = { type: "inlineCode", value } as RootContent;
    Object.defineProperty(node, "block", {
      value: {
        type: "code",
        lang,
        meta: meta ?? null,
        value: cleanValue(value),
      },
      enumerable: false,
    });
    return node;
  };
}

function unwrapCode(_props: Props, children: RootContent[]): RootContent {
  return (
    (children[0] as CodeCarrier | undefined)?.block ?? {
      type: "code",
      lang: null,
      value: textOf(children),
    }
  );
}

const intrinsics: Record<string, Handler> = {
  p: (_props, children) => ({ type: "paragraph", children }) as RootContent,

  h1: (_props, children) =>
    ({ type: "heading", depth: 1, children }) as RootContent,
  h2: (_props, children) =>
    ({ type: "heading", depth: 2, children }) as RootContent,
  h3: (_props, children) =>
    ({ type: "heading", depth: 3, children }) as RootContent,
  h4: (_props, children) =>
    ({ type: "heading", depth: 4, children }) as RootContent,
  h5: (_props, children) =>
    ({ type: "heading", depth: 5, children }) as RootContent,
  h6: (_props, children) =>
    ({ type: "heading", depth: 6, children }) as RootContent,

  a: (props, children) =>
    ({
      type: "link",
      url: (props.href as string | undefined) ?? "",
      title: (props.title as string | undefined) ?? null,
      children,
    }) as RootContent,

  ul: (_props, children) =>
    ({
      type: "list",
      ordered: false,
      start: null,
      spread: false,
      children,
    }) as RootContent,
  ol: (props, children) =>
    ({
      type: "list",
      ordered: true,
      start:
        props.start !== null && props.start !== undefined
          ? Number(props.start as string | number)
          : null,
      spread: false,
      children,
    }) as RootContent,

  li: (_props, children) => {
    let checked: boolean | null = null;
    let rest = children;
    const first = children[0] as CheckboxCarrier | undefined;
    if (first && first.__checkbox !== undefined) {
      checked = first.__checkbox;
      rest = children.slice(1);
    }
    return {
      type: "listItem",
      checked,
      spread: false,
      children: groupIntoBlocks(rest),
    } as RootContent;
  },

  // Rendered by mdast-util-to-hast for GFM task-list items: `<li><input
  // type="checkbox" checked disabled /> ...</li>`. Not real content — the
  // `li` handler above reads `__checkbox` off it and strips it.
  input: (props) => {
    const node = { type: "text", value: "" } as RootContent;
    Object.defineProperty(node, "__checkbox", {
      value: Boolean(props.checked),
      enumerable: false,
    });
    return node;
  },

  strong: (_props, children) => ({ type: "strong", children }) as RootContent,
  em: (_props, children) => ({ type: "emphasis", children }) as RootContent,
  del: (_props, children) => ({ type: "delete", children }) as RootContent,

  blockquote: (_props, children) =>
    ({
      type: "blockquote",
      children: groupIntoBlocks(children),
    }) as RootContent,

  hr: () => ({ type: "thematicBreak" }) as RootContent,
  br: () => ({ type: "break" }) as RootContent,

  img: (props) =>
    ({
      type: "image",
      url: (props.src as string | undefined) ?? "",
      alt: (props.alt as string | undefined) ?? null,
      title: (props.title as string | undefined) ?? null,
    }) as RootContent,

  table: (_props, children) => {
    const rows = children;
    const firstRow = rows[0] as
      (RootContent & { children?: RootContent[] }) | undefined;
    const align = (firstRow?.children ?? []).map(
      (cell) => (cell as AlignCarrier).__align ?? null,
    );
    return { type: "table", align, children: rows } as RootContent;
  },
  thead: (_props, children) => children,
  tbody: (_props, children) => children,
  tr: (_props, children) => ({ type: "tableRow", children }) as RootContent,
  th: (props, children) => {
    const node = { type: "tableCell", children } as RootContent;
    Object.defineProperty(node, "__align", {
      value: parseAlign(props),
      enumerable: false,
    });
    return node;
  },
  td: (props, children) => {
    const node = { type: "tableCell", children } as RootContent;
    Object.defineProperty(node, "__align", {
      value: parseAlign(props),
      enumerable: false,
    });
    return node;
  },

  code: (props, children) =>
    leafCode(
      /(?:^|\s)language-([\w-]+)/.exec(
        (props.className as string | undefined) ?? "",
      )?.[1] ?? null,
      (v) => v.replace(/\n$/, ""),
    )(props, children),
  pre: unwrapCode,

  // --- Extensions beyond the base hast vocabulary -----------------------
  // A handful of `.mdx` files use raw HTML/custom elements directly rather
  // than a registered component. These have no place in the spec table
  // above (they aren't produced by remark/rehype from markdown syntax) but
  // do appear in real content, so they're mapped here rather than left to
  // throw.

  // `<div class="code-title">Response Headers</div>` — a plain text label.
  // No block-level markdown equivalent; fold its content into a paragraph
  // (or pass block children through unchanged) same as any other wrapper.
  div: (_props, children) => groupIntoBlocks(children),
  span: (_props, children) => children,

  // `<g6-graph><script type="application/json">{...}</script></g6-graph>`
  // renders an interactive graph with no markdown equivalent. The closest
  // useful substitute is the element list, as a fenced code block — the
  // graph's other config (layout, mode, ...) lives on `<g6-graph>`'s own
  // props, not in this JSON, and is display-only anyway, so it's dropped
  // rather than dumped alongside the actual data. Each element is one line
  // (no internal line breaks — an element is one flat record, breaking it
  // across lines just makes it harder to scan), but the surrounding array is
  // still indented one level per line — a hybrid between fully-inlined and
  // fully-expanded JSON. Tagged with a "graph-example" info-string suffix
  // (fence becomes ```json graph-example) rather than a made-up language
  // like "json+graph": `lang` stays a real, highlightable language, and the
  // extra word rides in `meta`, which mdast-util-to-markdown appends to the
  // same fence line — still a hint a reader (or an LLM) can pick up, without
  // breaking every syntax highlighter that doesn't recognize the tag.
  script: (props, children) =>
    leafCode(
      props.type === "application/json" ? "json" : null,
      (v) => {
        if (props.type !== "application/json") return v.trim();
        try {
          const parsed: unknown = JSON.parse(v);
          const elements = Array.isArray(
            (parsed as { elements?: unknown })?.elements,
          )
            ? (parsed as { elements: unknown[] }).elements
            : parsed;
          if (!Array.isArray(elements)) return JSON.stringify(parsed, null, 2);
          if (elements.length === 0) return "[]";
          return `[\n${elements.map((el) => `  ${JSON.stringify(el)}`).join(",\n")}\n]`;
        } catch {
          return v.trim();
        }
      },
      props.type === "application/json" ? "graph-example" : undefined,
    )(props, children),
  "g6-graph": unwrapCode,
};

// Between JSX elements written on separate source lines, the MDX compiler
// emits a literal `"\n"` string child purely to preserve formatting — the
// same "insignificant whitespace" text JSX itself drops when building
// children arrays. A string is only ever insignificant this way if it's
// *entirely* whitespace and spans a line break; a lone space between inline
// elements on the same line (`"text " + <a> + " more"`) is real content and
// must survive.
const isInsignificantWhitespace = (value: string): boolean =>
  value.includes("\n") && /^\s*$/.test(value);

export function flatten(children: Child | Child[]): RootContent[] {
  if (
    children === null ||
    children === undefined ||
    children === false ||
    children === ""
  )
    return [];
  if (Array.isArray(children))
    return children.flatMap((c) => flatten(c as Child));
  if (typeof children === "string") {
    return isInsignificantWhitespace(children)
      ? []
      : [{ type: "text", value: children } as RootContent];
  }
  if (typeof children === "number")
    return [{ type: "text", value: String(children) } as RootContent];
  return [children];
}

export function jsx(type: unknown, props: Props): RootContent | RootContent[] {
  const children = flatten(props?.children as Child | Child[]);
  // The document root is a block-level container just like `blockquote` /
  // `li` / `div` — a component used as its own top-level block (e.g. a bare
  // `<Link />` on its own line) can return phrasing content, which mdast
  // requires to be wrapped in a `paragraph` before it can sit among root
  // siblings. Skipping this turned every such page into unparseable
  // concatenated output — see the `swagger.mdx` regression.
  if (type === Fragment) return groupIntoBlocks(children);
  if (typeof type === "function") {
    // Registered mdmx components (see `registry/`, `cards/`) all share this
    // shape: a props bag ending in `children`, returning mdast node(s).
    const component = type as (props: Props) => RootContent | RootContent[];
    return component({ ...props, children });
  }
  if (typeof type === "string") {
    const handler = intrinsics[type];
    if (!handler) throw new Error(`[mdmx] no mdast mapping for <${type}>`);
    return handler(props ?? {}, children);
  }
  throw new Error(`[mdmx] unsupported element type: ${String(type)}`);
}

export const jsxs = jsx;
export const jsxDEV = jsx;
