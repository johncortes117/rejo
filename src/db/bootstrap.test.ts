import { beforeEach, describe, expect, it } from "vitest";
import { clearFarmSession, readFarmSession, saveFarmSession } from "@/db/bootstrap";

describe("farm session storage", () => {
  beforeEach(() => {
    clearFarmSession();
  });

  it("clears the local session when an authenticated user signs out", () => {
    saveFarmSession({ farmId: "farm", userId: "user", role: "admin" });

    clearFarmSession();

    expect(readFarmSession()).toBeNull();
  });
});
