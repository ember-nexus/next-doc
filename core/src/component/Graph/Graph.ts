import { LitElement, html, css } from 'lit';
import {Graph} from '@antv/g6';
import type {EdgeOptions} from "@antv/g6/src/spec/element/edge.ts";
import type {NodeOptions} from "@antv/g6/src/spec/element/node.ts";
import type {GraphOptions} from "@antv/g6/src/spec";
import {iconNodeGeometry} from "./IconNode.ts";

export class G6Graph extends LitElement {
    static styles = css`
    :host { display: block; width: 100%; height: 100%; }
    .scroll { width: 100%; height: 100%; overflow: auto; }
    .canvas { width: 100%; height: 100%; }
  `;
    private _graph: Graph;

    render() {
        return html`<div class="scroll"><div class="canvas"></div></div>`;
    }

    firstUpdated() {
        const data = this._readData();
        if (!data) return;
        this._graph = new Graph({
            container: this.renderRoot.querySelector('.canvas') as HTMLElement,
            data: data,
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
                    fill: '#1f6feb',                                  // was cfg.style.fill
                    labelText: (d) => d.data?.label ?? d.id,
                    labelFill: '#fff',                                // was cfg.labelCfg.style.fill
                    labelFontSize: 12,                                // was cfg.labelCfg.style.fontSize
                    fontFamily: 'Fira Code',
                    iconType: (d) => d.data?.icon ?? 'data',          // was cfg.icon
                    iconSize: 24,
                    // keep this in sync with the node's own measurement:
                    size: (d) => 2 * iconNodeGeometry({
                        labelText: d.data?.label ?? d.id,
                        fontSize: 12, fontFamily: 'Fira Code', iconSize: 24,
                    }).outerCircleRadius,
                },
            } as NodeOptions,
            edge: {
                style: {
                    endArrow: true,
                    labelText: (d) => d.data?.label ?? ''
                },
            } as EdgeOptions,
            behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
        } satisfies GraphOptions);
        this._graph.render();
    }

    _readData() {
        const script = this.querySelector('script[type="application/json"]');
        const raw = (script ? script.textContent : this.textContent) || '';
        try { return JSON.parse(raw); } catch { return null; }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._graph?.destroy();
    }
}

customElements.define('g6-graph', G6Graph);
