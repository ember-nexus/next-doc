// Central place for the data shape, the type→style registry, and the
// elements → {nodes, edges} transform. Keeping it out of Graph.ts means the
// component file only deals with rendering concerns.

export interface GraphElement {
  id: string;
  /** semantic type, e.g. "user" / "data" — drives color + icon (NOT the g6 shape type) */
  type?: string;
  /** edge source id — presence of start+end marks this element as a relation */
  start?: string;
  /** edge target id */
  end?: string;
  /** pulsating highlight ring; may also be set inside `data` */
  highlight?: boolean;
  /** hover tooltip text; may also be set inside `data` */
  tooltip?: string;
  data?: {
    name?: string;
    label?: string; // legacy fallback
    highlight?: boolean;
    tooltip?: string;
    [key: string]: unknown;
  };
}

export interface ElementsPayload {
  elements?: GraphElement[];
  // backward-compat: raw g6 data is still accepted as-is
  nodes?: any[];
  edges?: any[];
}

export interface TypeStyle {
  color: string;
  icon: string; // must match a key in iconUtil.getIcon
}

/**
 * type name -> color + icon.
 * Add new categories here; unknown types fall back to DEFAULT_TYPE.
 */
export const TYPE_STYLES: Record<string, TypeStyle> = {
  User: { color: "#ef4444", icon: "user" },
  Group: { color: "#f59e0b", icon: "group" },
  Token: { color: "#d946ef", icon: "token" },

  Search: { color: "#6366f1", icon: "search" },

  Data: { color: "#2563eb", icon: "data" },
  Collection: { color: "#16a34a", icon: "collection" },
  File: { color: "#22d3ee", icon: "file" },

  Taxon: { color: "#6b7280", icon: "tag" },
  Plant: { color: "#16a34a", icon: "plant" },
};

export const DEFAULT_TYPE: TypeStyle = { color: "#6b7280", icon: "data" };

export function typeStyle(type?: string): TypeStyle {
  return (type && TYPE_STYLES[type]) || DEFAULT_TYPE;
}

const isEdge = (el: GraphElement) => el.start != null && el.end != null;

function firstDefined<T>(...vals: (T | undefined)[]): T | undefined {
  for (const v of vals) if (v !== undefined) return v;
  return undefined;
}

/**
 * Normalises a payload into g6's { nodes, edges } shape. Each produced item
 * carries a normalised `data` block: { ...original, type, name, highlight, tooltip }
 * so the style callbacks and tooltip plugin only ever read from one place.
 */
export function elementsToGraphData(payload: ElementsPayload): {
  nodes: any[];
  edges: any[];
} {
  // If someone still passes raw nodes/edges, pass them straight through.
  if (!payload?.elements && (payload?.nodes || payload?.edges)) {
    return { nodes: payload.nodes ?? [], edges: payload.edges ?? [] };
  }

  const elements = payload?.elements ?? [];
  const nodes: any[] = [];
  const edges: any[] = [];

  for (const el of elements) {
    const data = {
      ...el.data,
      type: el.type,
      name: firstDefined(el.data?.name, el.data?.label),
      highlight: Boolean(firstDefined(el.highlight, el.data?.highlight)),
      tooltip: firstDefined(el.tooltip, el.data?.tooltip),
    };

    if (isEdge(el)) {
      edges.push({ id: el.id, source: el.start, target: el.end, data });
    } else {
      nodes.push({ id: el.id, data });
    }
  }

  return { nodes, edges };
}
