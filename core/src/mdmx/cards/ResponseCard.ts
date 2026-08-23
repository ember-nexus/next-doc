import type { RootContent } from "mdast";

import { linksParagraph } from "./linkNode.ts";
import {
  type ResponseExample,
  getHttpStatusCodeLabel,
} from "../../type/index.ts";
import { parseMarkdownSource } from "../markdownSource.ts";

export function responseCard(examples: ResponseExample[]): RootContent[] {
  const nodes: RootContent[] = [
    {
      type: "heading",
      depth: 2,
      children: [{ type: "text", value: "Response" }],
    },
  ];

  for (const e of examples) {
    const label = e.name ?? getHttpStatusCodeLabel(e.httpStatusCode);
    nodes.push({
      type: "heading",
      depth: 3,
      children: [{ type: "text", value: `${e.httpStatusCode} · ${label}` }],
    });
    nodes.push(...parseMarkdownSource(e.description));

    if (e.body?.type === "binary") {
      nodes.push({
        type: "heading",
        depth: 4,
        children: [{ type: "text", value: "Body" }],
      });
      nodes.push({
        type: "paragraph",
        children: [
          {
            type: "emphasis",
            children: [{ type: "text", value: "binary response / raw file" }],
          },
        ],
      });
    } else if (e.body !== null && e.body.content) {
      nodes.push({
        type: "heading",
        depth: 4,
        children: [{ type: "text", value: "Body" }],
      });
      nodes.push({ type: "code", lang: e.body.type, value: e.body.content });
    }

    if (e.headers) {
      nodes.push({
        type: "heading",
        depth: 4,
        children: [{ type: "text", value: "Headers" }],
      });
      nodes.push({ type: "code", lang: "http", value: e.headers });
    }

    if (e.schema !== null) {
      nodes.push({
        type: "heading",
        depth: 4,
        children: [{ type: "text", value: "Schema" }],
      });
      nodes.push({ type: "code", lang: "json", value: e.schema });
    }

    const links = linksParagraph(e.links);
    if (links) nodes.push(links);
  }

  return nodes;
}
