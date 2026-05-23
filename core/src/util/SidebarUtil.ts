import type {Endpoint, SidebarEndpointItemDto, SidebarGroupItemDto, SidebarItemDto} from "../type";
import type {HttpMethod} from "../type";


export function endpointsToSidebarItems(endpoints: Endpoint[], version: string): SidebarItemDto[] {
    const groups = new Map<string, SidebarEndpointItemDto[]>();

    for (const e of endpoints) {
        const url = `/${version}/${e.group}/${e.endpoint}`;

        const item: SidebarEndpointItemDto = {
            type: 'endpoint',
            name: e.name,
            url: url,
            method: e.method as HttpMethod,
            endpointUrl: e.endpoint,
        };

        const existing = groups.get(e.group);
        if (existing) {
            existing.push(item);
        } else {
            groups.set(e.group, [item]);
        }
    }

    const items: SidebarItemDto[] = [];
    for (const [groupName, groupItems] of groups) {
        const groupItem: SidebarGroupItemDto = {
            type: 'group',
            name: groupName,
            items: groupItems,
        };
        items.push(groupItem);
    }

    return items;
}