// Markdown counterpart of `command/[command].astro`. Endpoint, not a page —
// see the routing note in `src/pages/[...slug].md.ts`.
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { APIRoute, GetStaticPaths } from "astro";
import { parse } from "node-html-parser";

import { commandParam, commandPath, prime } from "../../lib";
import { getCollection, renderMd } from "../../mdmx";
import { footerNav } from "../../mdmx/footerNav";
import { serialize } from "../../mdmx/serialize";

// `TerminalExample.astro` keeps these files as ANSI-colorized HTML (`aha`
// output) and renders the markup directly. There's no HTML in the markdown
// pipeline (see task.md acceptance criteria), so only the plain text
// survives — the color spans carry no information a terminal reader needs.
async function readTerminalOutput(file: string): Promise<string> {
  const raw = await readFile(path.resolve(process.cwd(), file), "utf-8");
  const body = parse(raw).querySelector("body");
  return (body?.textContent ?? raw).replace(/\n+$/, "");
}

export const getStaticPaths: GetStaticPaths = async () => {
  const entries = await getCollection("commands");
  return entries.map((entry) => ({
    params: { command: commandParam(entry.data.command) },
    props: { entry },
  }));
};

export const GET: APIRoute = async ({ props: { entry } }) => {
  await prime();
  const {
    command,
    name,
    helpCommand,
    helpOutput,
    exampleCommand,
    exampleOutput,
  } = entry.data;

  const [body, help, example] = await Promise.all([
    renderMd(entry),
    readTerminalOutput(`src/data/command-output/${helpOutput}`),
    readTerminalOutput(`src/data/command-output/${exampleOutput}`),
  ]);

  const md = serialize([
    {
      type: "heading",
      depth: 1,
      children: [{ type: "inlineCode", value: command }],
    },
    ...(name
      ? [
          {
            type: "paragraph",
            children: [{ type: "text", value: name }],
          } as const,
        ]
      : []),
    ...body,
    { type: "heading", depth: 2, children: [{ type: "text", value: "Help" }] },
    { type: "code", lang: "bash", value: helpCommand },
    { type: "code", lang: "text", value: help },
    {
      type: "heading",
      depth: 2,
      children: [{ type: "text", value: "Example" }],
    },
    { type: "code", lang: "bash", value: exampleCommand },
    { type: "code", lang: "text", value: example },
    ...(await footerNav(commandPath(command))),
  ]);

  return new Response(md, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
