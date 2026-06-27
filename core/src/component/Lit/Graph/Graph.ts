import { Graph } from "@antv/g6";
import type {
  EdgeData,
  EdgeOptions,
  GraphOptions,
  NodeData,
  NodeOptions,
} from "@antv/g6";
import { LitElement, type PropertyValues, css, html } from "lit";

import {
  type ElementsPayload,
  elementsToGraphData,
  typeStyle,
} from "./graphTypes.ts";
import { iconNodeGeometry } from "./IconNode.ts";

const PAD = 48; // padding around content, both sides
const ZOOM_RANGE: [number, number] = [0.05, 2.0]; // shared by zoomRange + manual pinch clamp

/* ------------------------------------------------------------------ *
 *  Color scheme tokens
 *  Only the properties that should differ between light / dark live
 *  here. Add more keys as needed and reference them via `this._theme`.
 * ------------------------------------------------------------------ */
type Scheme = "light" | "dark";

interface Theme {
  nodeLabelFill: string;
  edgeStroke: string;
  edgeLabelFill: string;
  edgeLabelBg: string;
  tooltipBg: string;
  tooltipFill: string;
}

const THEMES: Record<Scheme, Theme> = {
  light: {
    nodeLabelFill: "#ffffff",
    edgeStroke: "#8b949e",
    edgeLabelFill: "#3f3f46",
    edgeLabelBg: "rgba(255, 255, 255, 0.9)",
    tooltipBg: "#1f2430",
    tooltipFill: "#ffffff",
  },
  dark: {
    nodeLabelFill: "#ffffff",
    edgeStroke: "#6e7681",
    edgeLabelFill: "#e6edf3",
    edgeLabelBg: "rgba(22, 27, 34, 0.92)",
    tooltipBg: "#0d1117",
    tooltipFill: "#e6edf3",
  },
};

/** Supported layout variants, selected via the `layout` attribute. */
type LayoutKind = "antv-dagre-LR" | "antv-dagre-TB" | "grid" | "force";

/** Business data we attach under each element's `data` field. */
interface NodeDatum {
  type?: string;
  name?: string;
  label?: string;
  highlight?: boolean;
  tooltip?: string;
}

interface EdgeDatum {
  name?: string;
  type?: string;
  tooltip?: string;
}

const nodeDatum = (d: NodeData): NodeDatum => (d.data ?? {}) as NodeDatum;
const edgeDatum = (d: EdgeData): EdgeDatum => (d.data ?? {}) as EdgeDatum;
const nodeLabel = (d: NodeData): string => {
  const x = nodeDatum(d);
  return String(x.name ?? x.label ?? d.id);
};

export class G6Graph extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      min-height: 80px;
    }

    .wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      touch-action: none;
    }
  `;

  static properties = {
    layout: { type: String, reflect: true },
    scheme: { type: String, reflect: true },
  };

  /** Layout variant. */
  declare layout: LayoutKind;
  /** 'light' (default) | 'dark' | 'auto' (follow prefers-color-scheme). */
  declare scheme: "light" | "dark" | "auto";

  constructor() {
    super();
    this.layout = "antv-dagre-LR";
    this.scheme = "auto";
  }

  private _graph: Graph;
  private _tips = new Map<string, string>();
  private _ro: ResizeObserver | null = null;
  private _lastWidth = 0;
  private _mql: MediaQueryList | null = null;
  private _firstPaintDone = false;

  // --- Manual pinch-zoom state (scoped to THIS component's own canvas) ---
  // We deliberately do NOT use G6's `trigger: ['pinch']` behavior: its touch
  // gesture isn't cleanly scoped per-canvas, so with several graphs mounted a
  // single pinch drives only the first graph and they appear linked. Handling
  // pointer events on our own shadow-root canvas keeps each instance isolated.
  private _canvasEl: HTMLElement | null = null;
  private _pointers = new Map<number, { x: number; y: number }>();
  private _pinchStartDist = 0;
  private _pinchStartZoom = 1;
  private _dragSuspended = false;

  // Stable reference so we can add/remove the same listener.
  private _onSchemeChange = () => {
    if (this.scheme === "auto") this._applyTheme();
  };

  /** Resolve the effective scheme, honoring OS preference when 'auto'. */
  private get _theme(): Theme {
    const prefersDark = this._mql
      ? this._mql.matches
      : typeof window !== "undefined" &&
        Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    const s: Scheme =
      this.scheme === "auto" ? (prefersDark ? "dark" : "light") : this.scheme;
    return THEMES[s];
  }

  render() {
    return html` <div class="wrapper">
      <div class="canvas"></div>
    </div>`;
  }

  connectedCallback() {
    super.connectedCallback();
    if (typeof window !== "undefined" && window.matchMedia) {
      this._mql = window.matchMedia("(prefers-color-scheme: dark)");
      this._mql.addEventListener("change", this._onSchemeChange);
    }
  }

  /** Build the layout spec for the current `layout` variant. */
  private _layoutOptions(): GraphOptions["layout"] {
    switch (this.layout) {
      case "antv-dagre-LR":
        return {
          type: "antv-dagre",
          rankdir: "LR",
          nodesep: 30,
          ranksep: 80,
          controlPoints: true,
          nodeSize: 120,
        };
      case "antv-dagre-TB":
        return {
          type: "antv-dagre",
          rankdir: "TB",
          nodesep: 30,
          ranksep: 80,
          controlPoints: true,
          nodeSize: 120,
        };
      case "force":
        return {
          type: "force",
          preventOverlap: true,
          nodeSize: 100,
        };
      case "grid":
      default:
        return {
          type: "grid",
          preventOverlap: true,
          nodeSize: 100,
          condense: false,
        };
    }
  }

  /** Behaviors. Wheel/trackpad zoom stays native; pinch is handled manually. */
  private _behaviorOptions(): GraphOptions["behaviors"] {
    return [
      // Default trigger is the wheel; trackpad pinch arrives as wheel+ctrlKey,
      // so desktop (mouse + laptop trackpad) is fully covered here.
      { type: "zoom-canvas", key: "zoom-wheel" },
      { type: "drag-canvas", key: "drag-canvas" },
    ];
  }

  /** Build the node spec. Reused for initial render and theme swaps. */
  private _nodeOptions(): NodeOptions {
    const t = this._theme;
    return {
      type: "icon-node",
      animation: false,
      style: {
        fill: (d: NodeData) => typeStyle(nodeDatum(d).type).color,
        iconType: (d: NodeData) => typeStyle(nodeDatum(d).type).icon,
        iconSize: 24,
        labelText: (d: NodeData) => nodeLabel(d),
        labelFill: t.nodeLabelFill,
        labelFontSize: 14,
        labelFontWeight: 600,
        labelFontFamily: "Fira Code",
        highlight: (d: NodeData) => Boolean(nodeDatum(d).highlight),
        halo: (d: NodeData) => Boolean(nodeDatum(d).highlight),
        haloStroke: (d: NodeData) => typeStyle(nodeDatum(d).type).color,
        haloOpacity: 0.35,
        size: (d: NodeData) =>
          2 *
          iconNodeGeometry({
            labelText: nodeLabel(d),
            fontSize: 14,
            fontFamily: "Fira Code",
            iconSize: 24,
          }).outerCircleRadius,
      },
    };
  }

  /** Build the edge spec. Reused for initial render and theme swaps. */
  private _edgeOptions(): EdgeOptions {
    const t = this._theme;
    return {
      type: "polyline",
      animation: false,
      style: {
        endArrow: true,
        endArrowType: "triangle",
        stroke: t.edgeStroke,
        lineWidth: 2,
        labelText: (d: EdgeData) =>
          edgeDatum(d).name ?? edgeDatum(d).type ?? "",
        labelFill: t.edgeLabelFill,
        labelFontSize: 14,
        labelFontWeight: 600,
        labelFontFamily: "Fira Code",
        radius: 20,
        labelBackground: true,
        labelPadding: 5,
        labelBackgroundFill: t.edgeLabelBg,
      },
    };
  }

  firstUpdated() {
    const payload = this._readData();
    if (!payload) return;

    const data = elementsToGraphData(payload);

    console.log(data);

    this._tips.clear();
    for (const item of [...data.nodes, ...data.edges]) {
      const tip = (item?.data as { tooltip?: unknown } | undefined)?.tooltip;
      if (tip) this._tips.set(item.id as string, String(tip));
    }

    const options = {
      container: this.renderRoot.querySelector(".canvas") as HTMLElement,
      data,
      animation: false,
      autoResize: false,
      zoomRange: ZOOM_RANGE,
      padding: PAD,
      layout: this._layoutOptions(),
      node: this._nodeOptions(),
      edge: this._edgeOptions(),
      behaviors: this._behaviorOptions(),
      plugins: [
        {
          type: "tooltip",
          enable: (e: any, items?: any[]) =>
            this._tips.has(this._eid(e, items) ?? ""),
          getContent: (e: any, items?: any[]) => {
            const tip = this._tips.get(this._eid(e, items) ?? "");
            if (!tip) return "";
            const t = this._theme;
            return (
              `<div style="padding:6px 9px;border-radius:6px;` +
              `font:12px/1.4 'Fira Code',monospace;color:${t.tooltipFill};` +
              `background:${t.tooltipBg};box-shadow:0 1px 6px rgba(0,0,0,.35);` +
              `max-width:240px;white-space:normal;">` +
              this._esc(tip) +
              `</div>`
            );
          },
        },
      ],
    } satisfies GraphOptions;

    this._graph = new Graph(options);

    this._graph.render().then(async () => {
      await this._fitAndSize();
      this._firstPaintDone = true;
    });

    // Manual pinch-zoom: bind pointer events to our own canvas element so the
    // gesture stays isolated to this component instance.
    this._canvasEl = this.renderRoot.querySelector(".canvas") as HTMLElement;
    this._canvasEl.addEventListener("pointerdown", this._onPointerDown);
    this._canvasEl.addEventListener("pointermove", this._onPointerMove, {
      passive: false,
    });
    this._canvasEl.addEventListener("pointerup", this._onPointerUp);
    this._canvasEl.addEventListener("pointercancel", this._onPointerUp);

    // Only react to WIDTH changes to avoid feedback loop from our own height writes
    this._ro = new ResizeObserver((entries) => {
      const w =
        entries[0]?.contentBoxSize?.[0]?.inlineSize ?? this.clientWidth ?? 0;
      if (Math.abs(w - this._lastWidth) < 1) return; // height-only change → ignore
      this._lastWidth = w;
      this._fitAndSize();
    });
    this._ro.observe(this);
  }

  updated(changed: PropertyValues) {
    // React to runtime scheme changes (the initial scheme is already baked
    // into the first render via the option builders, so skip until painted).
    if (this._firstPaintDone && changed.has("scheme")) this._applyTheme();
    // React to runtime layout changes: re-run layout, then refit/resize.
    if (this._firstPaintDone && changed.has("layout")) this._applyLayout();
  }

  /* -------------------------------------------------------------- *
   *  Manual pinch-zoom handlers
   * -------------------------------------------------------------- */

  private _onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    this._canvasEl?.setPointerCapture?.(e.pointerId);
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this._pointers.size === 2) {
      const [a, b] = [...this._pointers.values()];
      this._pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
      this._pinchStartZoom = this._graph?.getZoom() ?? 1;
      // Stop drag-canvas from panning off one finger mid-pinch.
      if (this._graph && !this._dragSuspended) {
        this._graph.updateBehavior({ key: "drag-canvas", enable: false });
        this._dragSuspended = true;
      }
    }
  };

  private _onPointerMove = (e: PointerEvent) => {
    if (!this._pointers.has(e.pointerId) || !this._graph) return;
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this._pointers.size !== 2 || this._pinchStartDist <= 0) return;

    const [a, b] = [...this._pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const ratio = dist / this._pinchStartDist;

    // Clamp to the graph's zoomRange.
    const target = Math.min(
      ZOOM_RANGE[1],
      Math.max(ZOOM_RANGE[0], this._pinchStartZoom * ratio),
    );

    // Midpoint of the two fingers, in canvas-local (viewport) coordinates.
    const rect = this._canvasEl!.getBoundingClientRect();
    const ox = (a.x + b.x) / 2 - rect.left;
    const oy = (a.y + b.y) / 2 - rect.top;

    e.preventDefault();
    // (ratio, animation, origin) — same arg order used elsewhere in this file.
    this._graph.zoomTo(target, false, [ox, oy]);
  };

  private _onPointerUp = (e: PointerEvent) => {
    this._pointers.delete(e.pointerId);
    if (this._pointers.size < 2) {
      this._pinchStartDist = 0;
      if (this._graph && this._dragSuspended) {
        this._graph.updateBehavior({ key: "drag-canvas", enable: true });
        this._dragSuspended = false;
      }
    }
  };

  /** Re-skin the graph in place for the current scheme — no relayout. */
  private async _applyTheme() {
    if (!this._graph) return;
    this._graph.setNode(this._nodeOptions());
    this._graph.setEdge(this._edgeOptions());
    await this._graph.draw(); // re-derives styles; camera/zoom preserved
  }

  /** Swap to the current `layout` variant and re-run layout in place. */
  private async _applyLayout() {
    if (!this._graph) return;
    this._graph.setLayout(this._layoutOptions());
    await this._graph.layout();
    await this._fitAndSize();
  }

  private async _fitAndSize() {
    if (!this._graph) return;

    const nodes = this._graph.getNodeData();
    if (!nodes?.length) return;

    const wrapper = this.renderRoot.querySelector(".wrapper") as HTMLElement;
    const containerW = wrapper?.clientWidth ?? this.clientWidth;
    if (!containerW) return;

    await this._graph.zoomTo(1, false);
    await this._graph.translateTo([0, 0], false);

    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const node of nodes) {
      try {
        const b = this._graph.getElementRenderBounds(node.id);
        if (!b) continue;
        if (b.min[0] < minX) minX = b.min[0];
        if (b.min[1] < minY) minY = b.min[1];
        if (b.max[0] > maxX) maxX = b.max[0];
        if (b.max[1] > maxY) maxY = b.max[1];
      } catch {
        /* not yet rendered */
      }
    }
    if (!isFinite(minY) || !isFinite(maxY)) return;

    const contentW = maxX - minX;
    const contentH = maxY - minY;

    const availW = containerW - PAD * 2;
    const zoomFromWidth = contentW > 0 ? Math.min(availW / contentW, 1) : 1;
    const neededH = Math.ceil(contentH * zoomFromWidth) + PAD * 2;

    this.style.height = `${neededH}px`;
    this._graph.setSize(containerW, neededH);

    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );

    await this._graph.fitView({ when: "always", direction: "both" });
  }

  private _eid(e: any, items?: any[]): string | undefined {
    return items?.[0]?.id ?? e?.target?.id;
  }

  private _esc(s: string): string {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c] as string,
    );
  }

  _readData(): ElementsPayload | null {
    const script = this.querySelector('script[type="application/json"]');
    console.log(script);
    let raw = (script ? script.textContent : this.textContent) || "";
    raw = raw.trim();
    raw = raw.replace(/^\{`/, "").replace(/`\}$/, "").trim();
    const parsed = JSON.parse(raw);
    return parsed;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._mql?.removeEventListener("change", this._onSchemeChange);
    this._ro?.disconnect();

    // Tear down manual pinch listeners.
    this._canvasEl?.removeEventListener("pointerdown", this._onPointerDown);
    this._canvasEl?.removeEventListener("pointermove", this._onPointerMove);
    this._canvasEl?.removeEventListener("pointerup", this._onPointerUp);
    this._canvasEl?.removeEventListener("pointercancel", this._onPointerUp);
    this._pointers.clear();
    this._canvasEl = null;

    this._graph?.destroy();
  }
}

customElements.define("g6-graph", G6Graph);
