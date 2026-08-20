import type { RootContent } from "mdast";

interface Props {
  responseBody: object;
  responseHeaders: string;
}

/**
 * No interactive equivalent exists for the graph/table tabs — emit the raw
 * response instead of stripping it, same principle as the rest of this
 * registry: never silently drop content.
 */
export function SearchResponseCard(props: Props): RootContent[] {
  return [
    {
      type: "heading",
      depth: 5,
      children: [{ type: "text", value: "Response Body" }],
    },
    {
      type: "code",
      lang: "json",
      value: JSON.stringify(props.responseBody, null, 2),
    },
    {
      type: "heading",
      depth: 5,
      children: [{ type: "text", value: "Response Headers" }],
    },
    { type: "code", lang: "http", value: props.responseHeaders },
  ];
}
