// Dynamic content for /llms.txt (https://llmstxt.org/).
//
// Mirrors the grouping `sidebar.ts` uses for on-site navigation, but flattened:
// llms.txt sections are a single level of "## Heading" followed by a flat
// bullet list of links, not a nested tree. Reusing the same collections and
// route helpers means the link targets here can't drift from the sidebar's.
import SwaggerParser from "@apidevtools/swagger-parser";
import { getCollection } from "astro:content";
import type { OpenAPIObject } from "openapi3-ts/oas31";

import { commandPath, endpointPath, humanize, markdownPath, pagePathMd, schemaPath } from "./routes";
import { extractSchemas } from "../util";

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

export interface LlmsEntry {
  name: string;
  url: string; // markdown href
  description?: string;
}

export interface LlmsSection {
  title: string;
  entries: LlmsEntry[];
}

/** Content pages, split the same way `sidebar.ts` splits them into sections. */
async function pagesSections(): Promise<LlmsSection[]> {
  const allEntries = (await getCollection("pages")).sort(byId);
  const sections: LlmsSection[] = [];

  const indexEntry = allEntries.find((e) => e.id === "index" && !e.data.hidden);
  if (indexEntry) {
    sections.push({
      title: "Overview",
      entries: [
        {
          name: indexEntry.data.name ?? indexEntry.data.title,
          url: pagePathMd(indexEntry.id),
          description: indexEntry.data.description,
        },
      ],
    });
  }

  const sectionDefs: Array<{ key: string; label: string }> = [
    { key: "01-getting-started", label: "Getting started" },
    { key: "02-guide", label: "Guide" },
    { key: "03-reference", label: "Reference" },
  ];

  for (const { key, label } of sectionDefs) {
    const entries = allEntries.filter((e) => e.id.startsWith(`${key}/`) && !e.data.hidden);
    if (entries.length === 0) continue;

    sections.push({
      title: label,
      entries: entries.map((e) => ({
        name: e.data.name ?? e.data.title,
        url: pagePathMd(e.id),
        description: e.data.description,
      })),
    });
  }

  return sections;
}

/** CLI commands — one flat, alphabetical list. */
async function commandsSection(): Promise<LlmsSection | null> {
  const entries = (await getCollection("commands")).sort((a, b) =>
    a.data.command.localeCompare(b.data.command),
  );
  if (entries.length === 0) return null;

  return {
    title: "Commands",
    entries: entries.map((e) => ({
      name: e.data.command,
      url: markdownPath(commandPath(e.data.command)),
      description: e.data.description ?? e.data.name,
    })),
  };
}

/** API endpoints — one section per `group`, same grouping as the sidebar. */
async function apiSections(): Promise<LlmsSection[]> {
  const entries = (await getCollection("endpoints")).sort(byId);

  const groups = new Map<string, LlmsEntry[]>();
  for (const e of entries) {
    const item: LlmsEntry = {
      name: `${e.data.method.toUpperCase()} ${e.data.endpointUrl}`,
      url: markdownPath(endpointPath(e.data.endpoint)),
      description: e.data.description ?? e.data.name,
    };
    if (!groups.has(e.data.group)) groups.set(e.data.group, []);
    groups.get(e.data.group)!.push(item);
  }

  return [...groups].map(([group, groupEntries]) => ({
    title: `Endpoints: ${humanize(group)}`,
    entries: groupEntries,
  }));
}

/** OpenAPI schemas — one flat, alphabetical list. */
async function schemasSection(): Promise<LlmsSection | null> {
  const spec = (await SwaggerParser.parse("./src/data/swagger.json")) as OpenAPIObject;
  const schemas = extractSchemas(spec).sort((a, b) => a.name.localeCompare(b.name));
  if (schemas.length === 0) return null;

  return {
    title: "Schemas",
    entries: schemas.map((s) => ({
      name: s.name,
      url: markdownPath(schemaPath(s.id)),
    })),
  };
}

/** All dynamic sections, content pages first, then commands/API/schemas — same order as the sidebar. */
export async function buildLlmsSections(): Promise<LlmsSection[]> {
  const [pages, commands, api, schemas] = await Promise.all([
    pagesSections(),
    commandsSection(),
    apiSections(),
    schemasSection(),
  ]);

  return [...pages, ...(commands ? [commands] : []), ...api, ...(schemas ? [schemas] : [])];
}
