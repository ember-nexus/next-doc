import { LitElement, html, css } from 'lit';
import { Graph } from '@antv/g6';
import type { EdgeOptions } from "@antv/g6/src/spec/element/edge.ts";
import type { NodeOptions } from "@antv/g6/src/spec/element/node.ts";
import type { GraphOptions } from "@antv/g6/src/spec";
import { iconNodeGeometry } from "./IconNode.ts";
import { elementsToGraphData, typeStyle, type ElementsPayload } from "./graphTypes.ts";

const PAD = 48; // padding around content, both sides

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
        }
    `;

    static properties = {
        direction: { type: String, reflect: true },
    };

    declare direction: 'LR' | 'TD';

    constructor() {
        super();
        this.direction = 'LR';
    }

    private _graph: Graph;
    private _tips = new Map<string, string>();
    private _ro: ResizeObserver | null = null;
    private _lastWidth = 0;

    render() {
        return html`<div class="wrapper"><div class="canvas"></div></div>`;
    }

    firstUpdated() {
        const payload = this._readData();
        if (!payload) return;

        const data = elementsToGraphData(payload);

        this._tips.clear();
        for (const item of [...data.nodes, ...data.edges]) {
            const tip = item?.data?.tooltip;
            if (tip) this._tips.set(item.id, String(tip));
        }

        this._graph = new Graph({
            container: this.renderRoot.querySelector('.canvas') as HTMLElement,
            data,
            animation: false,
            autoFit: false,
            autoResize: false,
            zoomRange: [0.05, 1.5],
            padding: PAD,
            layout: {
                type: 'antv-dagre',
                rankdir: this.direction,
                nodesep: 30,
                ranksep: 80,
                controlPoints: true,
                nodeSize: 120,
            },
            node: {
                type: 'icon-node',
                animation: false,
                style: {
                    fill: (d) => typeStyle(d.data?.type).color,
                    iconType: (d) => typeStyle(d.data?.type).icon,
                    iconSize: 24,
                    labelText: (d) => d.data?.name ?? d.data?.label ?? d.id,
                    labelFill: '#fff',
                    labelFontSize: 14,
                    labelFontWeight: 600,
                    labelFontFamily: 'Fira Code',
                    highlight: (d) => !!d.data?.highlight,
                    halo: (d) => !!d.data?.highlight,
                    haloStroke: (d) => typeStyle(d.data?.type).color,
                    haloOpacity: 0.35,
                    size: (d) => 2 * iconNodeGeometry({
                        labelText: d.data?.name ?? d.data?.label ?? d.id,
                        fontSize: 14,
                        fontFamily: 'Fira Code',
                        iconSize: 24,
                    }).outerCircleRadius,
                },
            } as NodeOptions,
            edge: {
                type: "polyline",
                animation: false,
                style: {
                    endArrow: true,
                    endArrowType: 'triangle',
                    stroke: '#8b949e',
                    lineWidth: 2,
                    labelText: (d) => d.data?.name ?? d.data?.type ?? '',
                    labelFill: '#3f3f46',
                    labelFontSize: 14,
                    labelFontWeight: 600,
                    labelFontFamily: 'Fira Code',
                    radius: 20,
                    labelBackground: true,
                    labelPadding: 5,
                    labelBackgroundFill: 'rgba(255, 255, 255, 0.9)',
                },
            } as EdgeOptions,
            behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
            plugins: [
                {
                    type: 'tooltip',
                    enable: (e: any, items?: any[]) => this._tips.has(this._eid(e, items)),
                    getContent: (e: any, items?: any[]) => {
                        const tip = this._tips.get(this._eid(e, items));
                        if (!tip) return '';
                        return `<div style="padding:6px 9px;border-radius:6px;`
                            + `font:12px/1.4 'Fira Code',monospace;color:#fff;`
                            + `background:#1f2430;box-shadow:0 1px 6px rgba(0,0,0,.35);`
                            + `max-width:240px;white-space:normal;">`
                            + this._esc(tip) + `</div>`;
                    },
                },
            ],
        } satisfies GraphOptions);

        this._graph.render().then(async () => {
            await this._fitAndSize();
        });

        // Only react to WIDTH changes to avoid feedback loop from our own height writes
        this._ro = new ResizeObserver((entries) => {
            const w = entries[0]?.contentBoxSize?.[0]?.inlineSize
                ?? this.clientWidth
                ?? 0;
            if (Math.abs(w - this._lastWidth) < 1) return; // height-only change → ignore
            this._lastWidth = w;
            this._fitAndSize();
        });
        this._ro.observe(this);
    }

    /**
     * Measures graph content height using layout-space node bounding boxes,
     * sets the host height AND the G6 viewport size, then fits the view inside it.
     *
     * Flow:
     *   1. Reset camera to zoom=1, origin=(0,0) so render bounds == graph-space coords
     *   2. Collect node render bounds → stable graph-space coordinates
     *   3. Compute raw content width/height
     *   4. Determine zoom fitView will use (fit-to-width, capped at 1)
     *   5. Derive pixel height = contentHeight * zoom + 2 * PAD
     *   6. Apply height to BOTH host (page layout) and G6 canvas via setSize(),
     *      wait for reflow, then fitView({ when: 'always', direction: 'both' })
     *
     * Why setSize() is mandatory:
     *   The graph runs with autoResize:false, so G6 never observes the host's CSS
     *   height change by itself. setSize() is the only thing that updates G6's
     *   internal canvas + camera viewport. Without it, fitView centers the content
     *   inside the *previous* (stale) viewport height — which is exactly why
     *   single-line graphs ended up offset/clipped (small target height, large
     *   stale height → big centering error) while big graphs (tiny relative error)
     *   looked almost correct.
     */
    private async _fitAndSize() {
        if (!this._graph) return;

        const nodes = this._graph.getNodeData();
        if (!nodes?.length) return;

        const wrapper = this.renderRoot.querySelector('.wrapper') as HTMLElement;
        const containerW = wrapper?.clientWidth ?? this.clientWidth;
        if (!containerW) return;

        // --- 1. Reset camera so render bounds are in stable graph-space coords ---
        // Without this, bounds reflect the current (arbitrary) viewport transform,
        // making it impossible to derive correct zoom/height relationships.
        await this._graph.zoomTo(1, false);
        await this._graph.translateTo([0, 0], false);

        // Allow G6 to flush the transform before we read bounds
        await new Promise<void>((r) => requestAnimationFrame(() => r()));

        // --- 2. Measure content bbox in graph-space ---
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (const node of nodes) {
            try {
                const b = this._graph.getElementRenderBounds(node.id);
                if (!b) continue;
                if (b.min[0] < minX) minX = b.min[0];
                if (b.min[1] < minY) minY = b.min[1];
                if (b.max[0] > maxX) maxX = b.max[0];
                if (b.max[1] > maxY) maxY = b.max[1];
            } catch { /* not yet rendered */ }
        }

        if (!isFinite(minY) || !isFinite(maxY)) return;

        const contentW = maxX - minX;
        const contentH = maxY - minY;

        // --- 3. Compute zoom fitView will apply (fit-to-width, capped at 1) ---
        // fitView will pick min(scaleX, scaleY) (capped at 1). Since we set the
        // height to exactly accommodate contentH at scaleX, scaleY === scaleX, so
        // min() resolves to the fit-to-width zoom.
        const availW = containerW - PAD * 2;
        const zoomFromWidth = contentW > 0 ? Math.min(availW / contentW, 1) : 1;

        // --- 4. Derive required pixel height ---
        const neededH = Math.ceil(contentH * zoomFromWidth) + PAD * 2;

        // --- 5. Resize BOTH the host (for page layout) and the G6 viewport ---
        // CRITICAL: with autoResize:false G6 will not pick up the CSS height on its
        // own; setSize() updates the canvas + camera viewport so fitView centers
        // inside the correct dimensions (see method doc above).
        this.style.height = `${neededH}px`;
        this._graph.setSize(containerW, neededH);

        // Wait two frames: first for style recalc, second for canvas/camera
        // viewport propagation after setSize().
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

        // --- 6. Fit + center in a single pass — no correction loop ---
        // when:'always' forces re-centering even when content does NOT overflow
        //   (the default 'overflow' leaves small/single-line graphs un-centered).
        // direction:'both' + our exact height makes fitView's min(scaleX, scaleY)
        //   rule resolve to the fit-to-width zoom, capped at 1.
        // Padding is taken from the graph-level `padding` option — fitView in v5
        //   has no padding field, only `when` and `direction`.
        await this._graph.fitView({ when: 'always', direction: 'both' });
    }

    private _eid(e: any, items?: any[]): string | undefined {
        return items?.[0]?.id ?? e?.target?.id;
    }

    private _esc(s: string): string {
        return String(s).replace(/[&<>"']/g, (c) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
        ));
    }

    _readData(): ElementsPayload | null {
        const script = this.querySelector('script[type="application/json"]');
        let raw = (script ? script.textContent : this.textContent) || '';
        raw = raw.trim();
        raw = raw.replace(/^\{`/, '').replace(/`\}$/, '').trim();
        try { return JSON.parse(raw); } catch { return null; }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._ro?.disconnect();
        this._graph?.destroy();
    }
}

customElements.define('g6-graph', G6Graph);
