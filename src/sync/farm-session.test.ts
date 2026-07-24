import { describe, expect, it, vi } from "vitest";
import { resolveRemoteFarmSession } from "@/sync/farm-session";

describe("resolveRemoteFarmSession", () => {
  it("returns the authenticated user's existing farm membership", async () => {
    const readMembership = vi.fn().mockResolvedValue({ farmId: "demo-farm", role: "admin" });

    await expect(resolveRemoteFarmSession("demo-user", readMembership)).resolves.toEqual({
      state: "found",
      session: { farmId: "demo-farm", userId: "demo-user", role: "admin" }
    });
    expect(readMembership).toHaveBeenCalledWith("demo-user");
  });

  it("keeps the provisioning path for a user without a farm", async () => {
    await expect(resolveRemoteFarmSession("new-user", async () => null)).resolves.toEqual({
      state: "missing"
    });
  });

  it("returns a recoverable failure instead of provisioning on a lookup error", async () => {
    await expect(resolveRemoteFarmSession("offline-user", async () => {
      throw new Error("Network unavailable");
    })).resolves.toEqual({ state: "failed", message: "Network unavailable" });
  });
});
