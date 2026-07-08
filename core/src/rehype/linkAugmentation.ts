import { h } from "hastscript";
import { visit } from "unist-util-visit";

const LOCAL_PREFIX = "https://api.ember-nexus.dev";

const ICON_PATHS: Record<string, string> = {
  "arrow-right": "M5 12h14M12 5l7 7-7 7",
  "arrow-up-right": "M7 17L17 7M7 7h10v10",
};

function makeIconNode(name: string) {
  return h(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      class: "link-icon",
    },
    [h("path", { d: ICON_PATHS[name] })],
  );
}

function isBrokenHref(href: string): boolean {
  const normalized = href.trim().toLowerCase();
  return normalized === "" || normalized.includes("todo");
}

function isExternalHref(href: string): boolean {
  const trimmed = href.trim();

  // Protocol-relative URLs → external
  if (trimmed.startsWith("//")) return true;

  // No explicit scheme → relative or path-absolute → internal
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return false;

  // Has scheme, matches own domain → internal
  if (trimmed.startsWith(LOCAL_PREFIX)) return false;

  // Has scheme, foreign domain → external
  return true;
}

export function linkAugmentation() {
  return (tree: any, file: any) => {
    visit(tree, "element", (node: any) => {
      if (node.tagName !== "a") return;

      const href = node.properties?.href as string | undefined;
      if (href === undefined) return;

      const broken = isBrokenHref(href);
      const isExternal = isExternalHref(href);
      const iconName = isExternal ? "arrow-up-right" : "arrow-right";

      if (broken) {
        node.properties = {
          ...node.properties,
          style: "color: red;",
        };

        const filePath = file?.path ?? "unknown file";
        const line = node.position?.start?.line;
        const location = line !== undefined ? `${filePath}:${line}` : filePath;
        console.warn(
          `[linkAugmentation] Broken/placeholder link (href="${href}") at ${location}`,
        );
      }

      // Wrap icon in a no-break span to prevent gap+icon from orphaning onto its own line
      node.children = [
        ...node.children,
        h("span", { class: "link-icon-wrap" }, [makeIconNode(iconName)]),
      ];
      if (isExternal) {
        node.properties.target = "_blank";
      }
    });
  };
}
