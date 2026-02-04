declare module 'dav' {
    export interface Account {
        [key: string]: any;
    }

    export interface ACLObject {
        href: string;
        props?: any;
    }

    export interface PropFindRequest {
        depth: string | number;
    }

    export function propFind(options: any): Promise<any>;
    export function createAccount(options: any): Promise<Account>;
    export const NS: any;
}
