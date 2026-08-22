import { HTTPSnippet, type HarRequest, type TargetId } from "httpsnippet";
import type { RootContent } from "mdast";

import { curlfmt } from "../../util/curl-fmt";

// `RequestCard.astro` renders four language tabs (curl, Python, JS, PHP) for
// human readers comparing client libraries. The markdown target is read by
// LLMs, not browsed tab-by-tab — curl alone says everything an agent needs
// to reproduce the request, so the other three are skipped here.
export function requestCard(request: Partial<HarRequest>): RootContent[] {
  const snippet = new HTTPSnippet(request);
  const opts = { indent: "\t" };

  const raw = snippet.convert("shell" as unknown as TargetId, "curl", opts) as string;
  const example = curlfmt(raw, {
    headerPriority: ["Authorization", "Content-Type", "Accept"],
  });

  return [
    {
      type: "heading",
      depth: 2,
      children: [{ type: "text", value: "Request" }],
    },
    { type: "code", lang: "bash", value: example },
  ];
}
