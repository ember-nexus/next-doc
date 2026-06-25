// Single source of truth for how a collection entry maps to a URL.
//
// Both the page routes (getStaticPaths) and the sidebar import from here, so a
// link in the sidebar and the route it points at can never drift out of sync.
//
// Convention: `*Param` returns the bare route param; `*Path` returns the full
// absolute href. Routes use the param helpers, the sidebar uses the path helpers.

/**
 * Strip a leading ordering prefix like "01-" or "1_" from a path segment.
 * This lets you order files lexically on disk (01-intro.md, 02-auth.md…) without
 * the numbers leaking into URLs or labels.
 *
 * If you do NOT prefix your filenames, this is a no-op and safe to keep.
 * If you have a legitimate page like "2024-report.md", drop this call.
 */
export const cleanSegment = (segment: string): string =>
    segment.replace(/^\d+[-_]/, '');

/** "getting-started" -> "Getting started" (used for folder/group headings). */
export const humanize = (segment: string): string => {
    const s = cleanSegment(segment).replace(/[-_]/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
};

// --- pages: routed by [...slug], slug === the (cleaned) collection id ----------

/** "guides/01-auth" -> "guides/auth" */
export const pageSlug = (id: string): string =>
    id.split('/').map(cleanSegment).join('/');

/** "guides/01-auth" -> "/guides/auth" */
export const pagePath = (id: string): string => '/' + pageSlug(id);

// --- commands: routed by command/[command] ------------------------------------

/** "config:set" -> "config-set" */
export const commandParam = (command: string): string =>
    command.replace(/:/g, '-');

/** "config:set" -> "/command/config-set" */
export const commandPath = (command: string): string =>
    '/command/' + commandParam(command);

// --- endpoints: routed by api/[endpoint] (group is NOT in the URL) ------------

/** "users/{uuid}" -> "users_{uuid}" */
export const endpointParam = (endpoint: string): string =>
    endpoint.replace(/\//g, '_');

/** "users/{uuid}" -> "/api/users_{uuid}" */
export const endpointPath = (endpoint: string): string =>
    '/api/' + endpointParam(endpoint);
