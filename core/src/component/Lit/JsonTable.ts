import { LitElement, html, css, type PropertyValues } from 'lit';
import '@vaadin/grid';
import '@vaadin/grid/vaadin-grid-column.js';
import { gridRowDetailsRenderer } from '@vaadin/grid/lit.js';
import type { GridActiveItemChangedEvent } from '@vaadin/grid';

// ── Types ────────────────────────────────────────────────────────────────────

/** A loosely typed record from the JSON payload */
type JsonRecord = Record<string, unknown>;

/** Detected "element" shape: has id + type */
interface Element extends JsonRecord {
    id: string;
    type: string;
    start?: string;
    end?: string;
    data?: JsonRecord;
}

const isElement = (r: JsonRecord): r is Element =>
    typeof r.id === 'string' && typeof r.type === 'string';

const CLIP_LENGTH = 60;

const clip = (s: string): string =>
    s.length > CLIP_LENGTH ? s.slice(0, CLIP_LENGTH) + '…' : s;

const stringify = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
};

// ── Column definition ────────────────────────────────────────────────────────

interface ColDef {
    key: string;        // dot-path or flat key used for display
    header: string;
    priority: number;   // lower = further left
}

/**
 * Derive column definitions from the records.
 *
 * Priority rules:
 *   0  type
 *   1  id
 *   2  start
 *   3  end
 *   4  data.name / name
 *   5  everything else (alphabetical)
 *
 * Nested objects (other than data.name) are rendered as clipped JSON.
 * The `data` bag is flattened one level: data.name → shown as "name", etc.
 */
function deriveColumns(records: JsonRecord[], hasElements: boolean): ColDef[] {
    const seen = new Map<string, ColDef>();

    const add = (key: string, header: string, priority: number) => {
        if (!seen.has(key)) seen.set(key, { key, header, priority });
    };

    if (hasElements) {
        add('type', 'Type', 0);
        add('id', 'ID', 1);
        add('start', 'Start', 2);
        add('end', 'End', 3);
    }

    for (const rec of records) {
        for (const [k, v] of Object.entries(rec)) {
            if (['id', 'type', 'start', 'end', 'data'].includes(k)) continue;
            const p = k === 'name' ? 4 : 10;
            add(k, k, p);
        }

        // flatten data one level
        if (rec.data && typeof rec.data === 'object') {
            for (const [k, v] of Object.entries(rec.data as JsonRecord)) {
                const key = `data.${k}`;
                const p = k === 'name' ? 4 : 10;
                add(key, k, p);
            }
        }
    }

    // remove data.* columns where the value is always an object/array
    // (those are too noisy for a column — they live in row details only)
    const bulky = new Set<string>();
    for (const col of seen.values()) {
        if (!col.key.startsWith('data.')) continue;
        const subKey = col.key.slice('data.'.length);
        const allBulky = records.every((r) => {
            const d = (r.data ?? {}) as JsonRecord;
            const v = d[subKey];
            return v !== undefined && typeof v === 'object';
        });
        if (allBulky) bulky.add(col.key);
    }
    bulky.forEach((k) => seen.delete(k));

    return [...seen.values()].sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
}

/** Read a (possibly dotted) key from a record */
function readKey(rec: JsonRecord, key: string): unknown {
    if (key.includes('.')) {
        const [head, ...rest] = key.split('.');
        const child = rec[head];
        if (child && typeof child === 'object')
            return readKey(child as JsonRecord, rest.join('.'));
        return undefined;
    }
    return rec[key];
}

// ── LitElement ───────────────────────────────────────────────────────────────

export class JsonTable extends LitElement {

    static styles = css`
        :host {
            display: block;
            font-family: 'Fira Code', monospace;
        }

        vaadin-grid {
            height: auto;
            max-height: 600px;
        }

        .cell {
            font-size: 0.8rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 240px;
            display: block;
        }

        .cell.type-badge {
            display: inline-block;
            padding: 1px 7px;
            border-radius: 9999px;
            font-size: 0.72rem;
            font-weight: 600;
            background: var(--type-badge-bg, #334155);
            color: var(--type-badge-fg, #e2e8f0);
            letter-spacing: 0.03em;
        }

        .cell.mono {
            font-family: 'Fira Code', monospace;
            font-size: 0.72rem;
            color: var(--id-color, #94a3b8);
        }

        /* ── row details ── */
        .detail-wrapper {
            padding: 0.75rem 1rem 1rem;
            background: var(--detail-bg, #0f172a);
            border-top: 1px solid var(--detail-border, #1e293b);
        }

        .detail-wrapper h4 {
            margin: 0 0 0.4rem;
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--detail-heading, #64748b);
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }

        pre.json-detail {
            margin: 0;
            padding: 0.75rem 1rem;
            border-radius: 0.5rem;
            background: var(--json-bg, #1e293b);
            color: var(--json-fg, #e2e8f0);
            font-size: 0.8rem;
            line-height: 1.55;
            overflow-x: auto;
            white-space: pre;
            tab-size: 2;
        }

        /* syntax highlight tokens */
        .json-key   { color: #7dd3fc; }
        .json-str   { color: #86efac; }
        .json-num   { color: #fbbf24; }
        .json-bool  { color: #f472b6; }
        .json-null  { color: #94a3b8; }
    `;

    static properties = {
        src: { type: String, reflect: true },
    };

    /** Optional: pass JSON as attribute string. Otherwise reads inner <script type="application/json"> */
    declare src: string | undefined;

    private _records: JsonRecord[] = [];
    private _columns: ColDef[] = [];
    private _hasElements = false;
    private _openItems: JsonRecord[] = [];

    connectedCallback() {
        super.connectedCallback();
        this._parseData();
    }

    private _parseData() {
        let raw = '';
        if (this.src) {
            raw = this.src;
        } else {
            const script = this.querySelector('script[type="application/json"]');
            raw = (script ? script.textContent : this.textContent) ?? '';
        }
        raw = raw.trim();
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                console.warn('JsonTable: expected JSON array');
                return;
            }
            this._records = parsed as JsonRecord[];
            this._hasElements = this._records.some(isElement);
            this._columns = deriveColumns(this._records, this._hasElements);
        } catch (e) {
            console.error('JsonTable: JSON parse error', e);
        }
    }

    // ── rendering ────────────────────────────────────────────────────────────

    render() {
        if (!this._records.length) {
            return html`<p style="color:#94a3b8;font-size:0.85rem;">No data.</p>`;
        }

        return html`
            <vaadin-grid
                .items="${this._records}"
                .detailsOpenedItems="${this._openItems}"
                @active-item-changed="${this._onActiveItemChanged}"
                theme="row-stripes compact"
                ${gridRowDetailsRenderer<JsonRecord>(
            (rec) => this._renderDetail(rec),
            []
        )}
            >
                ${this._columns.map((col) => this._renderColumn(col))}
            </vaadin-grid>
        `;
    }

    private _renderColumn(col: ColDef) {
        return html`
            <vaadin-grid-column
                .header="${col.header}"
                .renderer="${(root: HTMLElement, _col: unknown, model: { item: JsonRecord }) => {
            const val = readKey(model.item, col.key);
            const text = clip(stringify(val));

            if (col.key === 'type') {
                root.innerHTML = `<span class="cell type-badge">${this._esc(text)}</span>`;
            } else if (col.key === 'id' || col.key === 'start' || col.key === 'end') {
                root.innerHTML = `<span class="cell mono" title="${this._esc(stringify(val))}">${this._esc(text)}</span>`;
            } else {
                root.innerHTML = `<span class="cell" title="${this._esc(stringify(val))}">${this._esc(text)}</span>`;
            }
        }}"
            ></vaadin-grid-column>
        `;
    }

    private _renderDetail(rec: JsonRecord) {
        return html`
            <div class="detail-wrapper">
                <h4>Full record</h4>
                <pre class="json-detail">${this._highlightJson(JSON.stringify(rec, null, 2))}</pre>
            </div>
        `;
    }

    // Very lightweight JSON syntax highlight — no deps.
    private _highlightJson(json: string): unknown {
        // We return a lit TemplateResult using unsafeHTML — but to avoid that
        // dep, we do it purely via innerHTML inside a <pre>. Since _renderDetail
        // already uses a <pre>, we set its innerHTML directly:
        // Called via .innerHTML of the <pre> in updated().
        // So we just return the HTML string here and set it via lit's `unsafeHTML`.

        // Actually — return as lit html using unsafeHTML-equivalent via a directive.
        // Simplest safe approach: return plain text (no XSS risk with JSON.stringify output).
        // We do a safe token-replace on the already-escaped string.

        const escaped = json
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const highlighted = escaped
            // keys
            .replace(
                /(&quot;[^&]*&quot;)\s*:/g,
                '<span class="json-key">$1</span>:'
            )
            // string values
            .replace(
                /:\s*(&quot;[^&]*&quot;)/g,
                ': <span class="json-str">$1</span>'
            )
            // numbers
            .replace(
                /:\s*(-?\d+\.?\d*)/g,
                ': <span class="json-num">$1</span>'
            )
            // booleans
            .replace(
                /:\s*(true|false)/g,
                ': <span class="json-bool">$1</span>'
            )
            // null
            .replace(
                /:\s*(null)/g,
                ': <span class="json-null">$1</span>'
            );

        // Inject as innerHTML via a temporary container trick in lit
        const tpl = document.createElement('template');
        tpl.innerHTML = highlighted;
        return tpl.content.cloneNode(true);
    }

    private _onActiveItemChanged(e: GridActiveItemChangedEvent<JsonRecord>) {
        const item = e.detail.value;
        this._openItems = item ? [item] : [];
        this.requestUpdate();
    }

    private _esc(s: string): string {
        return String(s).replace(/[&<>"']/g, (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
        );
    }
}

customElements.define('json-table', JsonTable);
