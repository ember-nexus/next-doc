// /llms.txt — https://llmstxt.org/
//
// A static header (who we are, how to fetch a plain-text copy of any page)
// followed by a dynamic body generated from the same collections/route
// helpers the sidebar uses, so it can't silently drift out of sync with the
// actual site content.
import type { APIRoute } from "astro";

import { buildLlmsSections, type LlmsEntry } from "../lib";

const formatEntry = (entry: LlmsEntry): string =>
  entry.description ? `- [${entry.name}](${entry.url}): ${entry.description}` : `- [${entry.name}](${entry.url})`;

export const GET: APIRoute = async () => {
  const sections = await buildLlmsSections();

  const staticHeader = `# Ember Nexus API

> Ember Nexus is a self-hosted, source-first REST API for connected data: elements (nodes) and
> the relations between them, with user accounts, permissions, file storage and search built in.

This site's documentation is also available as plain Markdown: append \`.md\` to any page's URL
(the homepage is available at [/index.md](/index.md)).

## Links

- [Homepage](/): Documentation home
- [OpenAPI / Swagger spec](/swagger.json): Full API specification
- [GitHub](https://github.com/ember-nexus/api): Source code
- [Docker Hub](https://hub.docker.com/r/embernexus/api): Container image
- [Discord](https://discord.gg/qbQFBrJrRC): Community chat`;

  const dynamicBody = sections
    .map((section) => `## ${section.title}\n\n${section.entries.map(formatEntry).join("\n")}`)
    .join("\n\n");

  const body = `${staticHeader}\n\n${dynamicBody}\n`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
