// The markdown render target's implicit component registry — the
// `mdmx`-side counterpart of `src/component/registry.html.ts`. Every
// exported function takes the same props its `.astro` twin does and returns
// mdast node(s) instead of rendering HTML.
import { Code } from "./Code.ts";
import { CommandGroupList } from "./CommandGroupList.ts";
import { ComparisonCard } from "./ComparisonCard.ts";
import { EndpointGroupList } from "./EndpointGroupList.ts";
import { Link } from "./Link.ts";
import { Note } from "./Note.ts";
import { SchemaList } from "./SchemaList.ts";
import { SearchResponseCard } from "./SearchResponseCard.ts";
import { TwoColumn } from "./TwoColumn.ts";

export const mdComponents = {
  Code,
  CommandGroupList,
  ComparisonCard,
  EndpointGroupList,
  Link,
  Note,
  SchemaList,
  SearchResponseCard,
  TwoColumn,
};
