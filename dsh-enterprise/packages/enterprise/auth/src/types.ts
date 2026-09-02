export type UserId = string & { readonly __brand: 'UserId' };
export type OrgId = string & { readonly __brand: 'OrgId' };
export type Role = 'trader' | 'risk' | 'it' | 'audit' | 'org:admin' | 'org:member';
export interface Principal {
  userId: UserId;
  orgId: OrgId;
  roles: Role[];
  email?: string;
}
export interface Resource {
  type: string;
  owner?: UserId;
  orgId?: OrgId;
}
