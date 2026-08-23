/**
 * Open Graph image generator using Satori + Sharp.
 *
 * Produces a 1200×630 PNG for every page type:
 *   - title (top-left, Qanelas Soft, large, black, word-wrap)
 *   - "Ember Nexus" label + logo (bottom-right)
 *   - white background
 */

import { readFile } from "node:fs/promises";

import satori, { type SatoriOptions } from "satori";
import sharp from "sharp";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OgData {
  title: string;
}

// ---------------------------------------------------------------------------
// Font + logo (loaded once, cached at module level)
// ---------------------------------------------------------------------------

let _fontData: ArrayBuffer | null = null;
let _logoDataUri: string | null = null;

async function getFontData(): Promise<ArrayBuffer> {
  if (!_fontData) {
    const buf = await readFile(
      "./public/fonts/qanelas-soft-custom-semi-bold.woff",
    );
    _fontData = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer;
  }
  return _fontData;
}

async function getLogoDataUri(): Promise<string> {
  if (!_logoDataUri) {
    const svgBuf = await readFile("./public/logo.svg");
    const pngBuf = await sharp(svgBuf).resize(72, 72).png().toBuffer();
    _logoDataUri = `data:image/png;base64,${pngBuf.toString("base64")}`;
  }
  return _logoDataUri;
}

// ---------------------------------------------------------------------------
// Satori template (plain objects — no JSX/React required)
// ---------------------------------------------------------------------------

/**
 * Split `title` on every "Ember Nexus" occurrence and return Satori child
 * nodes where each "Ember Nexus" is wrapped in a nowrap span so the two
 * words can never be broken across lines.
 */
function buildTitleChildren(title: string): unknown[] {
  const parts = title.split("Ember Nexus");
  const children: unknown[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) {
      children.push(parts[i]);
    }
    if (i < parts.length - 1) {
      children.push({
        type: "span",
        props: {
          style: { whiteSpace: "nowrap" },
          children: "Ember Nexus",
        },
      });
    }
  }
  return children;
}

function buildTemplate(
  title: string,
  logoDataUri: string,
): Parameters<typeof satori>[0] {
  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#ffffff",
        padding: "60px",
        fontFamily: "QanelasSoft",
      },
      children: [
        // ── Title (top-left) ──────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexWrap: "wrap",
              fontSize: 80,
              fontWeight: 600,
              color: "#18181b", // zinc-900
              lineHeight: 1.25,
              maxWidth: "100%",
              wordBreak: "break-word",
            },
            children: buildTitleChildren(title),
          },
        },
        // ── Bottom row: "Ember Nexus" + logo (bottom-right) ───────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "row",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 16,
            },
            children: [
              {
                type: "span",
                props: {
                  style: {
                    fontSize: 36,
                    fontWeight: 600,
                    color: "#18181b",
                  },
                  children: "Ember Nexus",
                },
              },
              {
                type: "img",
                props: {
                  src: logoDataUri,
                  width: 72,
                  height: 72,
                  style: { display: "flex" },
                },
              },
            ],
          },
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateOgImage(title: string): Promise<Buffer> {
  const [fontData, logoDataUri] = await Promise.all([
    getFontData(),
    getLogoDataUri(),
  ]);

  const options: SatoriOptions = {
    width: 1200,
    height: 630,
    embedFont: true,
    fonts: [
      {
        name: "QanelasSoft",
        data: fontData,
        weight: 600,
        style: "normal",
      },
    ],
  };

  const svg = await satori(buildTemplate(title, logoDataUri), options);
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return buffer;
}
