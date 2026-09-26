jest.mock("../../src/Utils/eventBus");
jest.mock("../../src/Features/Search/service");

import request from "supertest";
import app from "../../src/app";
import * as adminService from "../../src/Features/Admin/service";
import * as kycService from "../../src/Features/Kyc/service";
import * as searchService from "../../src/Features/Search/service";
import { publishEvent } from "../../src/Utils/eventBus";
import { signupAndLogin, signupAdminAndLogin } from "../helpers/auth";

describe("Admin KYC review — event publishing", () => {
  it("publishes kyc.approved when approving a pending submission", async () => {
    const user = await signupAndLogin();
    const admin = await signupAndLogin();
    await kycService.submitKyc(user.userId, "22212345678", "12345678901");

    await adminService.approveKyc(user.userId, admin.userId);

    expect(publishEvent).toHaveBeenCalledWith("kyc.approved", {
      userId: user.userId,
    });
  });

  it("publishes kyc.rejected with the reason when rejecting a pending submission", async () => {
    const user = await signupAndLogin();
    const admin = await signupAndLogin();
    await kycService.submitKyc(user.userId, "22212345678", "12345678901");

    await adminService.rejectKyc(user.userId, "Blurry ID photo", admin.userId);

    expect(publishEvent).toHaveBeenCalledWith("kyc.rejected", {
      userId: user.userId,
      reason: "Blurry ID photo",
    });
  });

  it("publishes a search index event when approving KYC", async () => {
    const user = await signupAndLogin();
    const admin = await signupAndLogin();
    await kycService.submitKyc(user.userId, "22212345678", "12345678901");
    (publishEvent as jest.Mock).mockClear();

    await adminService.approveKyc(user.userId, admin.userId);

    expect(publishEvent).toHaveBeenCalledWith("search.user.upsert", {
      userId: user.userId,
    });
  });

  it("publishes a search index event when rejecting KYC", async () => {
    const user = await signupAndLogin();
    const admin = await signupAndLogin();
    await kycService.submitKyc(user.userId, "22212345678", "12345678901");
    (publishEvent as jest.Mock).mockClear();

    await adminService.rejectKyc(user.userId, "Blurry ID photo", admin.userId);

    expect(publishEvent).toHaveBeenCalledWith("search.user.upsert", {
      userId: user.userId,
    });
  });

  it("publishes a search index event when freezing a user", async () => {
    const user = await signupAndLogin();
    const admin = await signupAndLogin();
    (publishEvent as jest.Mock).mockClear();

    await adminService.freezeUser(user.userId, admin.userId);

    expect(publishEvent).toHaveBeenCalledWith("search.user.upsert", {
      userId: user.userId,
    });
  });

  it("publishes a search index event when unfreezing a user", async () => {
    const user = await signupAndLogin();
    const admin = await signupAndLogin();
    await adminService.freezeUser(user.userId, admin.userId);
    (publishEvent as jest.Mock).mockClear();

    await adminService.unfreezeUser(user.userId, admin.userId);

    expect(publishEvent).toHaveBeenCalledWith("search.user.upsert", {
      userId: user.userId,
    });
  });

  describe("Admin search endpoints", () => {
    it("GET /admin/users/search calls searchUsers with the query and pagination", async () => {
      const admin = await signupAdminAndLogin();
      (searchService.searchUsers as jest.Mock).mockResolvedValue({
        results: [{ firstName: "Ada" }],
        total: 1,
      });

      const res = await request(app)
        .get("/api/v1/admin/users/search?q=ada&page=2&limit=10")
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .expect(200);

      expect(searchService.searchUsers).toHaveBeenCalledWith("ada", 2, 10);
      expect(res.body.data.results).toEqual([{ firstName: "Ada" }]);
    });

    it("GET /admin/transactions/search calls searchTransactions with the query and pagination", async () => {
      const admin = await signupAdminAndLogin();
      (searchService.searchTransactions as jest.Mock).mockResolvedValue({
        results: [],
        total: 0,
      });

      await request(app)
        .get("/api/v1/admin/transactions/search?q=ref_abc")
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .expect(200);

      expect(searchService.searchTransactions).toHaveBeenCalledWith(
        "ref_abc",
        1,
        20,
      );
    });

    it("rejects a search request without admin auth", async () => {
      const user = await signupAndLogin();

      await request(app)
        .get("/api/v1/admin/users/search?q=ada")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(403);
    });
  });
});
