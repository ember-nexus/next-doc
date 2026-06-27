// Replaces the four separate DTO files:
//   SidebarItemDto.ts, SidebarLinkItemDto.ts, SidebarEndpointItemDto.ts, SidebarGroupItemDto.ts
//
// A discriminated union (on `type`) lets TypeScript narrow automatically, so the
// rendering code never needs `as SidebarXDto` casts.

export type HttpMethod =
  "get" | "post" | "put" | "patch" | "delete" | "head" | "options";

export interface SidebarLink {
  type: "link";
  name: string;
  url: string;
}

export interface SidebarEndpoint {
  type: "endpoint";
  name: string;
  url: string;
  method: HttpMethod;
  endpointUrl: string;
}

export interface SidebarGroup {
  type: "group";
  name: string;
  items: SidebarItem[];
}

export type SidebarItem = SidebarLink | SidebarEndpoint | SidebarGroup;
