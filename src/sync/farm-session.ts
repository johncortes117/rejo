import type { FarmMemberRole, FarmSession } from "@/domain/models";

export interface RemoteFarmMembership {
  farmId: string;
  role: string;
}

export type RemoteFarmMembershipReader = (
  userId: string
) => Promise<RemoteFarmMembership | null>;

export type RemoteFarmSessionResult =
  | { state: "found"; session: FarmSession }
  | { state: "missing" }
  | { state: "failed"; message: string };

const isFarmMemberRole = (role: string): role is FarmMemberRole =>
  role === "admin" || role === "owner" || role === "worker" || role === "advisor";

export const resolveRemoteFarmSession = async (
  userId: string,
  readMembership: RemoteFarmMembershipReader
): Promise<RemoteFarmSessionResult> => {
  try {
    const membership = await readMembership(userId);

    if (!membership) {
      return { state: "missing" };
    }

    return {
      state: "found",
      session: {
        farmId: membership.farmId,
        userId,
        role: isFarmMemberRole(membership.role) ? membership.role : "owner"
      }
    };
  } catch (caught) {
    return {
      state: "failed",
      message: caught instanceof Error ? caught.message : "No se pudo buscar la finca asociada."
    };
  }
};
