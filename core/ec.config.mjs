import { defineEcConfig } from 'astro-expressive-code'
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections'

export default defineEcConfig({
    themes: ['min-dark', 'min-light'],
    useDarkModeMediaQuery: true,
    defaultProps: {
        frame: 'none',
        collapseStyle: 'collapsible-start',
    },
    plugins: [pluginCollapsibleSections()],
    styleOverrides: {
        collapsibleSections: {
            closedBackgroundColor: '#e4e4e7',
            openBackgroundColorCollapsible: '#f4f4f5'
        },
    },
})
