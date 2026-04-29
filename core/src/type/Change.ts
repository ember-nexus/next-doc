export type ChangeType = 'add' | 'change' | 'remove';

export interface Change {
    version: string;
    type: ChangeType;
    title: string;
    features: string[]
}
