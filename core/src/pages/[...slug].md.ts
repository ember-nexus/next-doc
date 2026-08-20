// Markdown counterpart of `[...slug].astro`. Must be an *endpoint*
// (`GET`/`getStaticPaths`), not a `.md.astro` page: in Astro 7.2.4,
// `getOutFile` emits `<pathname>/index.html` unconditionally for
// `routeType: 'page'` under `build.format: 'directory'`, which would turn
// `foo.md` into `foo.md/index.html`. Only `routeType: 'endpoint'` writes
// `basename(pathname)` verbatim — see task.md §9.3.
import type { APIRoute, GetStaticPaths } from "astro";

import { pageRouteParamMd, prime } from "../lib";
import { getCollection, renderMd } from "../mdmx";
import { serialize } from "../mdmx/serialize";

export const getStaticPaths: GetStaticPaths = async () => {
  const pages = await getCollection("pages");
  return pages.map((entry) => ({
    params: { slug: pageRouteParamMd(entry.id) },
    props: { entry },
  }));
};

export const GET: APIRoute = async ({ props: { entry } }) => {
  await prime();
  const body = await renderMd(entry);
  const md = serialize([
    {
      type: "heading",
      depth: 1,
      children: [{ type: "text", value: entry.data.title }],
    },
    ...body,
  ]);
  return new Response(md, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
