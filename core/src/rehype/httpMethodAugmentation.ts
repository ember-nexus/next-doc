// rehype-http-methods.js
import { h } from 'hastscript';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

export function httpMethodAugmentation() {
    return (tree) => {
        walk(tree, null);
    };
}

function walk(node, parent) {
    if (
        node.type === 'element' &&
        node.tagName === 'code' &&
        parent?.tagName !== 'pre'
    ) {
        const text = node.children?.[0]?.value?.trim();
        const firstWord = text?.split(/\s+/)[0];

        if (HTTP_METHODS.includes(firstWord)) {
            const remainder = text.slice(firstWord.length).trim();

            if (!remainder) {
                // Only the method name — set prop directly on the code element
                node.properties = { ...node.properties, dataMethod: firstWord };
                node.children = [{ type: 'text', value: firstWord }];
            } else {
                // Additional content — wrap method in span, keep remainder as text
                const methodSpan = h('span', { dataMethod: firstWord }, firstWord);
                const remainderText = text.slice(firstWord.length); // preserve original spacing
                node.children = [
                    methodSpan,
                    { type: 'text', value: remainderText },
                ];
            }
        }
    }

    node.children?.forEach((child) => walk(child, node));
}
