// Markdown counterpart of `api/[endpoint].astro`. Endpoint, not a page — see
// the routing note in `src/pages/[...slug].md.ts`.
import SwaggerParser from "@apidevtools/swagger-parser";
import type { APIRoute, GetStaticPaths } from "astro";

import { endpointParam, endpointPath, prime } from "../../lib";
import { getCollection, renderMd } from "../../mdmx";
import {
  requestBodyCard,
  requestCard,
  requestHeaderCard,
  requestParameterCard,
  responseCard,
  responseHeaderCard,
} from "../../mdmx/cards";
import { footerNav } from "../../mdmx/footerNav";
import { serialize } from "../../mdmx/serialize";
import {
  extractHarExamples,
  extractRequestBody,
  extractRequestHeaders,
  extractRequestParameters,
  extractResponseExamples,
  extractResponseHeaders,
} from "../../util";

export const getStaticPaths: GetStaticPaths = async () => {
  const entries = await getCollection("endpoints");
  return entries.map((entry) => ({
    params: { endpoint: endpointParam(entry.data.endpoint) },
    props: { entry },
  }));
};

export const GET: APIRoute = async ({ props: { entry } }) => {
  await prime();
  const { method, endpointUrl, swaggerUrl, name } = entry.data;

  const spec = await SwaggerParser.dereference("./src/data/swagger.json");
  const path = swaggerUrl ?? "/";
  const specMethod = swaggerUrl === undefined ? "get" : method;

  const requests = extractHarExamples(spec, path, specMethod);
  const requestParameters = extractRequestParameters(spec, path, specMethod);
  const requestHeaders = extractRequestHeaders(spec, path, specMethod);
  const requestBody = extractRequestBody(spec, path, specMethod);
  const responseHeaders = extractResponseHeaders(spec, path, specMethod);
  const responseExamples = extractResponseExamples(spec, path, specMethod);

  const body = await renderMd(entry);

  const md = serialize([
    {
      type: "heading",
      depth: 1,
      children: [
        {
          type: "text",
          value: `${method.toUpperCase()} ${endpointUrl} — ${name}`,
        },
      ],
    },
    ...body,
    ...requestCard(requests),
    ...responseCard(responseExamples),
    ...requestParameterCard(requestParameters),
    ...requestHeaderCard(requestHeaders),
    ...(requestBody ? requestBodyCard(requestBody) : []),
    ...responseHeaderCard(responseHeaders),
    ...(await footerNav(endpointPath(entry.data.endpoint))),
  ]);

  return new Response(md, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
