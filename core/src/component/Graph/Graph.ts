import { LitElement, html, css } from 'lit';
import {Graph} from '@antv/g6';
import type {EdgeOptions} from "@antv/g6/src/spec/element/edge.ts";
import type {NodeOptions} from "@antv/g6/src/spec/element/node.ts";

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
            layout: {
                type: 'antv-dagre',
                rankdir: 'LR',
                nodesep: 40,
                ranksep: 60
            },
            node: {
                style: {
                    labelText: (d) => d.data?.label ?? d.id,
                    labelPlacement: 'center',
                    labelFill: '#fff',
                },
            } as NodeOptions,
            edge: {
                style: {
                    endArrow: true,
                    labelText: (d) => d.data?.label ?? ''
                },
            } as EdgeOptions,
            behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
        });
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
