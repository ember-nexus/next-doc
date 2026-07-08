import { defineEcConfig } from 'astro-expressive-code'
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections'
import { pluginSchemaLinks } from './src/plugins/expressive-code/plugin-schema-links.js'

export default defineEcConfig({
    themes: ['min-dark', 'min-light'],
    useDarkModeMediaQuery: true,
    defaultProps: {
        frame: 'none',
        collapseStyle: 'collapsible-start',
    },
    plugins: [pluginCollapsibleSections(), pluginSchemaLinks()],
    styleOverrides: {
        collapsibleSections: {
            closedBackgroundColor: '#e4e4e7',
            openBackgroundColorCollapsible: '#f4f4f5'
        },
    },
})
