import { getCollection } from "astro:content";

import { commandPath, endpointPath, humanize, pagePath } from "./routes";
import type {
  HttpMethod,
  SidebarEndpoint,
  SidebarGroup,
  SidebarItem,
  SidebarLink,
} from "../type/Sidebar";

// Lexical order by collection id (the file path without extension) is THE
// ordering for the sidebar. We sort once up front; everything downstream just
// preserves first-seen order, so the on-disk filename order wins everywhere.
const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

/**
 * Build a nested tree from entry ids of the form "a/b/c".
 * Every segment except the last becomes a folder GROUP; the last segment is a
 * leaf produced by `toLeaf`. Groups are created on first encounter, so (because
 * entries are pre-sorted by id) they come out in lexical filename order.
 */
function buildTree<E extends { id: string }>(
  entries: E[],
  toLeaf: (entry: E) => SidebarItem,
): SidebarItem[] {
  const root: SidebarItem[] = [];
  const folders = new Map<string, SidebarItem[]>([["", root]]);

  const ensureFolder = (segments: string[]): SidebarItem[] => {
    let path = "";
    let parent = root;
    for (const seg of segments) {
      path = path ? `${path}/${seg}` : seg;
      let items = folders.get(path);
      if (!items) {
        items = [];
        const group: SidebarGroup = {
          type: "group",
          name: humanize(seg),
          items,
        };
        parent.push(group);
        folders.set(path, items);
      }
      parent = items;
    }
    return parent;
  };

  for (const entry of entries) {
    const segments = entry.id.split("/");
    segments.pop(); // drop the filename; only folders form groups
    ensureFolder(segments).push(toLeaf(entry));
  }
  return root;
}

/** Regular content pages — arbitrary folder nesting -> nested groups. */
async function pagesSection(): Promise<SidebarItem[]> {
  const entries = (await getCollection("pages")).sort(byId);
  return buildTree(entries, (e): SidebarLink => ({
    type: "link",
    name: e.data.name ?? e.data.title,
    url: pagePath(e.id),
  }));
}

/** CLI commands — grouped by folder, wrapped under one "Commands" heading. */
async function commandsSection(): Promise<SidebarItem[]> {
  const entries = (await getCollection("commands")).sort(byId);
  const items = buildTree(entries, (e): SidebarLink => ({
    type: "link",
    name: e.data.command, // the command string is the natural label
    url: commandPath(e.data.command),
  }));
  if (items.length === 0) return [];
  return [{ type: "group", name: "Commands", items }];
}

/** API endpoints — grouped by the `group` frontmatter field (not by folder). */
async function apiSection(): Promise<SidebarItem[]> {
  const entries = (await getCollection("endpoints")).sort(byId);

  // Map preserves insertion order, so groups appear in the order their first
  // (lexically-first) endpoint does.
  const groups = new Map<string, SidebarEndpoint[]>();
  for (const e of entries) {
    const item: SidebarEndpoint = {
      type: "endpoint",
      name: e.data.name,
      url: endpointPath(e.data.endpoint),
      method: e.data.method.toLowerCase() as HttpMethod,
      endpointUrl: e.data.endpointUrl,
    };
    if (!groups.has(e.data.group)) groups.set(e.data.group, []);
    groups.get(e.data.group)!.push(item);
  }

  return [...groups].map(([group, items]): SidebarGroup => ({
    type: "group",
    name: humanize(group),
    items,
  }));
}

/**
 * The whole sidebar, top to bottom: content pages, then commands, then API.
 * Reorder the spread to taste.
 */
export async function buildSidebar(): Promise<SidebarItem[]> {
  const [pages, commands, api] = await Promise.all([
    pagesSection(),
    commandsSection(),
    apiSection(),
  ]);
  return [...pages, ...commands, ...api];
}
