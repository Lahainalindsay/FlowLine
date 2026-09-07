import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import {
  appUsersTable,
  db,
  eventsTable,
  subscriptionsTable,
  workspaceMembersTable,
  workspacesTable,
} from "@workspace/db";
import {
  evaluateEntitlement,
  PLAN_ENTITLEMENTS,
  roleCan,
  type Permission,
} from "./workspace-policy.js";

export { PLAN_ENTITLEMENTS, roleCan, type Permission };

/**
 * Creates a personal Starter workspace on first authenticated request and
 * atomically claims legacy ownerUserId events that predate workspaces.
 */
export async function ensurePersonalWorkspace(userId: string) {
  const workspaceId = `personal_${userId}`;
  return db.transaction(async (tx) => {
    await tx.insert(appUsersTable).values({ clerkUserId: userId }).onConflictDoNothing();
    await tx.insert(workspacesTable).values({
      id: workspaceId,
      name: "Personal workspace",
      ownerUserId: userId,
    }).onConflictDoNothing();
    await tx.insert(workspaceMembersTable).values({
      id: randomUUID(), workspaceId, userId, role: "OWNER",
    }).onConflictDoNothing();
    await tx.insert(subscriptionsTable).values({
      id: randomUUID(), workspaceId, plan: "STARTER", status: "active",
    }).onConflictDoNothing();
    // Never overwrite a workspace assignment: only historical unassigned
    // events owned by this Clerk identity are claimed.
    await tx.update(eventsTable)
      .set({ workspaceId })
      .where(and(eq(eventsTable.ownerUserId, userId), isNull(eventsTable.workspaceId)));
    return workspaceId;
  });
}

export async function getWorkspaceMembership(workspaceId: string, userId: string) {
  const [membership] = await db.select().from(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.workspaceId, workspaceId), eq(workspaceMembersTable.userId, userId)))
    .limit(1);
  return membership ?? null;
}

export async function getWorkspacePlan(workspaceId: string) {
  const [subscription] = await db.select({ plan: subscriptionsTable.plan }).from(subscriptionsTable)
    .where(eq(subscriptionsTable.workspaceId, workspaceId)).limit(1);
  return subscription?.plan ?? "STARTER";
}

export async function mayCreate(workspaceId: string, kind: "activeEvents" | "templates" | "members", current: number) {
  const plan = await getWorkspacePlan(workspaceId);
  return evaluateEntitlement(plan, kind, current);
}