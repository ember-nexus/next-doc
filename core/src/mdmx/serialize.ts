// Turns the mdast tree produced by the `mdmx` JSX runtime into CommonMark/GFM
// text. This is the only place in the markdown render path that touches
// serialization — no HTML is ever produced or parsed on this path.
import type { RootContent } from "mdast";
import { gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";

export function serialize(children: RootContent[]): string {
  return toMarkdown(
    { type: "root", children },
    {
      extensions: [gfmToMarkdown()],
      bullet: "-",
      rule: "-",
      emphasis: "_",
      fences: true,
      listItemIndent: "one",
      resourceLink: false,
    },
  );
}
