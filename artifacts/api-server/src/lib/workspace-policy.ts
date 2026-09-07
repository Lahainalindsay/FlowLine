export type SubscriptionPlan = "STARTER" | "PRO" | "BUSINESS";
export type WorkspaceRole = "OWNER" | "ADMIN" | "OPERATOR" | "VIEWER";

export const PLAN_ENTITLEMENTS: Record<SubscriptionPlan, {
  activeEvents: number;
  templates: number;
  members: number;
}> = {
  STARTER: { activeEvents: 3, templates: 3, members: 3 },
  PRO: { activeEvents: 25, templates: 25, members: 15 },
  BUSINESS: { activeEvents: 250, templates: 250, members: 100 },
};

const permissions = {
  "workspace:read": ["OWNER", "ADMIN", "OPERATOR", "VIEWER"],
  "event:read": ["OWNER", "ADMIN", "OPERATOR", "VIEWER"],
  "event:write": ["OWNER", "ADMIN", "OPERATOR"],
  "live:control": ["OWNER", "ADMIN", "OPERATOR"],
  "display:manage": ["OWNER", "ADMIN", "OPERATOR"],
  "template:read": ["OWNER", "ADMIN", "OPERATOR", "VIEWER"],
  "template:write": ["OWNER", "ADMIN", "OPERATOR"],
  "team:read": ["OWNER", "ADMIN"],
  "team:manage": ["OWNER", "ADMIN"],
  "billing:read": ["OWNER"],
  "audit:read": ["OWNER", "ADMIN"],
} as const satisfies Record<string, readonly WorkspaceRole[]>;

export type Permission = keyof typeof permissions;
export type EntitlementKind = keyof (typeof PLAN_ENTITLEMENTS)[SubscriptionPlan];

export function roleCan(role: WorkspaceRole, permission: Permission) {
  return (permissions[permission] as readonly WorkspaceRole[]).includes(role);
}

export function evaluateEntitlement(plan: SubscriptionPlan, kind: EntitlementKind, current: number) {
  const limit = PLAN_ENTITLEMENTS[plan][kind];
  return { allowed: current < limit, plan, limit };
}