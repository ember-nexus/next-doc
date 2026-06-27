import { type CollectionEntry, getCollection } from "astro:content";

import type {
  SidebarEndpointItemDto,
  SidebarGroupItemDto,
  SidebarItemDto,
  SidebarLinkItemDto,
} from "../type";
import type { HttpMethod } from "../type";

export async function endpointsToSidebarItems(): Promise<SidebarItemDto[]> {
  const groups = new Map<string, SidebarEndpointItemDto[]>();

  const endpoints = await getCollection("endpoints");

  for (const e of endpoints) {
    const url = `/${e.group}/${e.endpoint}`;

    const item: SidebarEndpointItemDto = {
      type: "endpoint",
      name: e.name,
      url: url,
      method: e.method as HttpMethod,
      endpointUrl: e.endpointUrl,
    };

    const existing = groups.get(e.group);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(e.group, [item]);
    }
  }

  const items: SidebarItemDto[] = [];
  for (const [groupName, groupItems] of groups) {
    const groupItem: SidebarGroupItemDto = {
      type: "group",
      name: groupName,
      items: groupItems,
    };
    items.push(groupItem);
  }

  return items;
}

export interface PageNode {
  slug: string;
  label: string;
  entry?: CollectionEntry<"pages">;
  children: PageNode[];
}

function stripPrefix(segment: string): string {
  return segment.replace(/^\d+[-_]/, "");
}

export async function buildPageTree(): Promise<PageNode[]> {
  const pages = await getCollection("pages");
  const root: PageNode = { slug: "", label: "", children: [] };

  for (const page of pages) {
    const rawSegments = page.id.split("/");
    const isIndex = rawSegments.at(-1) === "index";
    const segments = isIndex ? rawSegments.slice(0, -1) : rawSegments;

    let node = root;
    let slug = "";

    for (const rawSeg of segments) {
      slug = slug ? `${slug}/${stripPrefix(rawSeg)}` : stripPrefix(rawSeg);
      let child = node.children.find((c) => c.slug === slug);
      if (!child) {
        child = { slug, label: "", children: [] };
        node.children.push(child);
      }
      node = child;
    }

    node.label = page.data.name ?? page.data.title;
    node.entry = page;
  }

  return root.children;
}

function pageTreeToSidebar(
  nodes: PageNode[],
): (SidebarGroupItemDto | SidebarLinkItemDto)[] {
  return nodes.map((node) => {
    if (node.children.length > 0) {
      return {
        type: "group",
        name: node.label,
        items: pageTreeToSidebar(node.children),
      } satisfies SidebarGroupItemDto;
    }
    return {
      type: "link",
      name: node.label,
      url: `/${node.slug}`,
    } satisfies SidebarLinkItemDto;
  });
}

export async function buildSidebarPages(): Promise<SidebarItemDto[]> {
  return pageTreeToSidebar(await buildPageTree());
}

function flattenPageTree(nodes: PageNode[]): PageNode[] {
  return nodes.flatMap((node) => [node, ...flattenPageTree(node.children)]);
}

export async function getRoutablePages(): Promise<PageNode[]> {
  const tree = await buildPageTree();
  return flattenPageTree(tree).filter((node) => node.children.length === 0);
}
