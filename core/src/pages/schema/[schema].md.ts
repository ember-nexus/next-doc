// Markdown counterpart of `schema/[schema].astro`. Endpoint, not a page —
// see the routing note in `src/pages/[...slug].md.ts`. Generated purely from
// swagger, same as its HTML twin — no MDX involved.
import SwaggerParser from "@apidevtools/swagger-parser";
import type { APIRoute, GetStaticPaths } from "astro";
import type { OpenAPIObject } from "openapi3-ts/oas31";

import { schemaPath } from "../../lib/routes";
import { schemaPropertyList } from "../../mdmx/cards";
import { footerNav } from "../../mdmx/footerNav";
import { parseMarkdownSource } from "../../mdmx/markdownSource";
import { serialize } from "../../mdmx/serialize";
import type { Schema } from "../../type";
import { extractSchemas } from "../../util";

export const getStaticPaths: GetStaticPaths = async () => {
  const spec = (await SwaggerParser.parse(
    "./src/data/swagger.json",
  )) as OpenAPIObject;
  return extractSchemas(spec).map((schema) => ({
    params: { schema: schema.id },
    props: { schema },
  }));
};

export const GET: APIRoute = async ({
  props: { schema },
}: {
  props: { schema: Schema };
}) => {
  const raw = (schema.schema ?? {}) as Record<string, unknown>;
  const description =
    typeof raw.description === "string" ? raw.description : null;

  const md = serialize([
    {
      type: "heading",
      depth: 1,
      children: [{ type: "inlineCode", value: schema.name }],
    },
    ...(description ? parseMarkdownSource(description) : []),
    {
      type: "heading",
      depth: 2,
      children: [{ type: "text", value: "Properties" }],
    },
    ...schemaPropertyList(schema.schema),
    {
      type: "heading",
      depth: 2,
      children: [{ type: "text", value: "Raw Schema" }],
    },
    {
      type: "code",
      lang: "json",
      value: JSON.stringify(schema.schema, null, 2),
    },
    ...(await footerNav(schemaPath(schema.id))),
  ]);

  return new Response(md, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
