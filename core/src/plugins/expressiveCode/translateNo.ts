import { definePlugin } from 'astro-expressive-code';

export function translateNo() {
    return definePlugin({
        name: 'No Translate',
        hooks: {
            postprocessRenderedBlock: ({ renderData }) => {
                renderData.blockAst.properties = {
                    ...renderData.blockAst.properties,
                    translate: 'no',
                };
            },
        },
    });
}