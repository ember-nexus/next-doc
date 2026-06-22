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

    render() {
        return html`<div class="scroll"><div class="canvas"></div></div>`;
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
            autoFit: {
                type: 'view',
                options: {
                    when: 'overflow'
                },
                animation: false
            },
            autoResize: true,
            zoomRange: [0.25, 1.5],
            padding: 20,
            layout: {
                type: 'antv-dagre',
                rankdir: this.direction,
                nodesep: 30,
                ranksep: 80,
                controlPoints: true,
                nodeSize: 120
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
                        fontSize: 14, fontFamily: 'Fira Code', iconSize: 24,
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
        this._graph.render();
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
        this._graph?.destroy();
    }
}

customElements.define('g6-graph', G6Graph);
