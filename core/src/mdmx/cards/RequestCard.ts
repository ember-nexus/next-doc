import { HTTPSnippet, type HarRequest, type TargetId } from "httpsnippet";
import type { RootContent } from "mdast";

import { curlfmt } from "../../util/curl-fmt";

// Same four examples `RequestCard.astro` renders as tabs; markdown has no
// tabs, so all four are stacked under sub-headings instead.
const EXAMPLES = [
  { lang: "shell", library: "curl", mdLang: "bash", label: "cURL" },
  {
    lang: "python",
    library: "requests",
    mdLang: "python",
    label: "Python (requests)",
  },
  {
    lang: "javascript",
    library: "fetch",
    mdLang: "js",
    label: "JavaScript (fetch)",
  },
  { lang: "php", library: "guzzle", mdLang: "php", label: "PHP (guzzle)" },
] as const;

export function requestCard(request: Partial<HarRequest>): RootContent[] {
  const snippet = new HTTPSnippet(request);
  const opts = { indent: "\t" };

  const nodes: RootContent[] = [
    {
      type: "heading",
      depth: 2,
      children: [{ type: "text", value: "Request" }],
    },
  ];

  for (const e of EXAMPLES) {
    const raw = snippet.convert(
      e.lang as unknown as TargetId,
      e.library,
      opts,
    ) as string;
    const example =
      e.library === "curl"
        ? curlfmt(raw, {
            headerPriority: ["Authorization", "Content-Type", "Accept"],
          })
        : raw;
    nodes.push({
      type: "heading",
      depth: 3,
      children: [{ type: "text", value: e.label }],
    });
    nodes.push({ type: "code", lang: e.mdLang, value: example });
  }

  return nodes;
}
