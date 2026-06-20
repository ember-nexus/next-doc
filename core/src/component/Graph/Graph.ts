import { LitElement, html, css } from 'lit';
import { Graph } from '@antv/g6';
import type { EdgeOptions } from "@antv/g6/src/spec/element/edge.ts";
import type { NodeOptions } from "@antv/g6/src/spec/element/node.ts";
import type { GraphOptions } from "@antv/g6/src/spec";
import { iconNodeGeometry } from "./IconNode.ts";
import { elementsToGraphData, typeStyle, type ElementsPayload } from "./graphTypes.ts";

export class G6Graph extends LitElement {
    static styles = css`
        :host { display: block; width: 100%; height: 100%; }
        .scroll { width: 100%; height: 100%; overflow: auto; }
        .canvas { width: 100%; height: 100%; }
    `;
    private _graph: Graph;
    /** id -> tooltip text, only for elements that define one */
    private _tips = new Map<string, string>();

    render() {
        return html`<div class="scroll"><div class="canvas"></div></div>`;
    }

    firstUpdated() {
        const payload = this._readData();
        if (!payload) return;

        const data = elementsToGraphData(payload);

        // Build the tooltip lookup once.
        this._tips.clear();
        for (const item of [...data.nodes, ...data.edges]) {
            const tip = item?.data?.tooltip;
            if (tip) this._tips.set(item.id, String(tip));
        }

        this._graph = new Graph({
            container: this.renderRoot.querySelector('.canvas') as HTMLElement,
            data,
            autoFit: 'center',
            zoomRange: [0.25, 1.5],
            padding: 20,
            layout: {
                type: 'antv-dagre',
                rankdir: 'LR',
                nodesep: 60,
                ranksep: 60
            },
            node: {
                type: 'icon-node',
                style: {
                    // color + icon now come from the element's semantic `type`
                    fill: (d) => typeStyle(d.data?.type).color,
                    iconType: (d) => typeStyle(d.data?.type).icon,
                    iconSize: 24,

                    labelText: (d) => d.data?.name ?? d.data?.label ?? d.id,
                    labelFill: '#fff',
                    labelFontSize: 12,
                    fontFamily: 'Fira Code',

                    // highlight -> breathing halo (animated in IconNode.onCreate)
                    highlight: (d) => !!d.data?.highlight,
                    halo: (d) => !!d.data?.highlight,
                    haloStroke: (d) => typeStyle(d.data?.type).color,
                    haloOpacity: 0.35,

                    // keep this in sync with the node's own measurement:
                    size: (d) => 2 * iconNodeGeometry({
                        labelText: d.data?.name ?? d.data?.label ?? d.id,
                        fontSize: 12, fontFamily: 'Fira Code', iconSize: 24,
                    }).outerCircleRadius,
                },
            } as NodeOptions,
            edge: {
                style: {
                    endArrow: true,
                    stroke: '#8b949e',
                    labelText: (d) => d.data?.name ?? d.data?.label ?? '',
                    labelFill: '#8b949e',
                    labelFontSize: 11,
                    labelFontFamily: 'Fira Code',
                },
            } as EdgeOptions,
            behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
            plugins: [
                {
                    type: 'tooltip',
                    // only fire for elements that actually declared a tooltip
                    enable: (e: any, items?: any[]) => this._tips.has(this._eid(e, items)),
                    getContent: (e: any, items?: any[]) => {
                        const tip = this._tips.get(this._eid(e, items));
                        if (!tip) return '';
                        // inline styles so it renders consistently inside the shadow root
                        return `<div style="padding:6px 9px;border-radius:6px;`
                            + `font:12px/1.4 'Fira Code',monospace;color:#fff;`
                            + `background:#1f2430;box-shadow:0 1px 6px rgba(0,0,0,.35);`
                            + `max-width:240px;white-space:normal;">`
                            + this._esc(tip) + `</div>`;
                    },
                },
            ],
        } satisfies GraphOptions);
        this._graph.render();
    }

    /** resolve the element id from a g6 plugin event (items is preferred, falls back to target) */
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
        // tolerate template-literal wrappers like {` ... `} that some templating leaves behind
        raw = raw.replace(/^\{`/, '').replace(/`\}$/, '').trim();
        try { return JSON.parse(raw); } catch { return null; }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._graph?.destroy();
    }
}

customElements.define('g6-graph', G6Graph);