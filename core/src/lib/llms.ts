// Dynamic content for /llms.txt (https://llmstxt.org/).
//
// Renders the exact same tree `buildSidebar()` produces for the HTML
// sidebar — same sections, same nesting (groups, link-groups, endpoints) —
// as nested markdown lists instead of a flat one, so link targets and
// structure can't drift from what's actually in the on-site nav. The only
// transform applied here is pointing every link at its markdown twin
// (`markdownPath`), same helper the header button and footer nav use.
import type { RootContent } from "mdast";

import { buildSidebar } from "./sidebar";
import { markdownPath } from "./routes";
import type { SidebarItem } from "../type";

const linkChild = (url: string, children: RootContent[]): RootContent => ({
  type: "link",
  url: markdownPath(url),
  title: null,
  children,
});

const list = (children: RootContent[]): RootContent => ({
  type: "list",
  ordered: false,
  start: null,
  spread: false,
  children,
});

const listItem = (children: RootContent[]): RootContent => ({
  type: "listItem",
  checked: null,
  spread: false,
  children,
});

// The "Commands" section renders each command name as code (`backup:create`)
// — same treatment `CommandGroupList.ts` and `SchemaList.ts` give identifiers
// embedded in page bodies. Threaded through the recursion so namespace-folder
// group labels (e.g. "Backup") stay plain text; only the leaf links get it.
type ItemKind = "command" | undefined;

/** One SidebarItem -> one (possibly nested) list item, mirroring SidebarNode.astro. */
function itemToListItem(item: SidebarItem, kind?: ItemKind): RootContent {
  switch (item.type) {
    case "link": {
      const label: RootContent =
        kind === "command"
          ? { type: "inlineCode", value: item.name }
          : { type: "text", value: item.name };
      return listItem([{ type: "paragraph", children: [linkChild(item.url, [label])] }]);
    }

    case "link-group":
      return listItem([
        { type: "paragraph", children: [linkChild(item.url, [{ type: "text", value: item.name }])] },
        list(item.items.map((i) => itemToListItem(i, kind))),
      ]);

    case "group":
      return listItem([
        { type: "paragraph", children: [{ type: "text", value: item.name }] },
        list(item.items.map((i) => itemToListItem(i, kind))),
      ]);

    case "endpoint":
      return listItem([
        {
          type: "paragraph",
          children: [
            linkChild(item.url, [
              { type: "inlineCode", value: `${item.method.toUpperCase()} ${item.endpointUrl}` },
              { type: "text", value: ` — ${item.name}` },
            ]),
          ],
        },
      ]);
  }
}

/**
 * The whole sidebar as `## Heading` + nested list per top-level section. The
 * "index" entry is the one bare `link` `buildSidebar()` emits outside of any
 * section group (see `sidebar.ts`'s pagesSection()); everything else is a
 * top-level `group` (variant "section").
 */
export async function buildLlmsBody(): Promise<RootContent[]> {
  const items = await buildSidebar();
  const nodes: RootContent[] = [];

  for (const item of items) {
    if (item.type === "link") {
      nodes.push({ type: "heading", depth: 2, children: [{ type: "text", value: "Overview" }] });
      nodes.push(list([itemToListItem(item)]));
    } else if (item.type === "group" && item.variant === "section") {
      nodes.push({ type: "heading", depth: 2, children: [{ type: "text", value: item.name }] });
      const kind: ItemKind = item.name === "Commands" ? "command" : undefined;
      nodes.push(list(item.items.map((i) => itemToListItem(i, kind))));
    }
  }

  return nodes;
}
