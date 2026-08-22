// The markdown render target's implicit component registry — the
// `mdmx`-side counterpart of `src/component/registry.html.ts`. Every
// exported function takes the same props its `.astro` twin does and returns
// mdast node(s) instead of rendering HTML.
import { Code } from "./Code";
import { CommandGroupList } from "./CommandGroupList";
import { ComparisonCard } from "./ComparisonCard";
import { EndpointGroupList } from "./EndpointGroupList";
import { Link } from "./Link";
import { Note } from "./Note";
import { SchemaList } from "./SchemaList";
import { SearchResponseCard } from "./SearchResponseCard";
import { TwoColumn } from "./TwoColumn";

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
