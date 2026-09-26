jest.mock("../../src/Utils/eventBus");

import * as adminService from "../../src/Features/Admin/service";
import * as kycService from "../../src/Features/Kyc/service";
import { publishEvent } from "../../src/Utils/eventBus";
import { signupAndLogin } from "../helpers/auth";

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

    await adminService.approveKyc(user.userId, admin.userId);

    expect(publishEvent).toHaveBeenCalledWith("search.user.upsert", {
      userId: user.userId,
    });
  });

  it("publishes a search index event when rejecting KYC", async () => {
    const user = await signupAndLogin();
    const admin = await signupAndLogin();
    await kycService.submitKyc(user.userId, "22212345678", "12345678901");

    await adminService.rejectKyc(user.userId, "Blurry ID photo", admin.userId);

    expect(publishEvent).toHaveBeenCalledWith("search.user.upsert", {
      userId: user.userId,
    });
  });

  it("publishes a search index event when freezing a user", async () => {
    const user = await signupAndLogin();
    const admin = await signupAndLogin();

    await adminService.freezeUser(user.userId, admin.userId);

    expect(publishEvent).toHaveBeenCalledWith("search.user.upsert", {
      userId: user.userId,
    });
  });

  it("publishes a search index event when unfreezing a user", async () => {
    const user = await signupAndLogin();
    const admin = await signupAndLogin();
    await adminService.freezeUser(user.userId, admin.userId);

    await adminService.unfreezeUser(user.userId, admin.userId);

    expect(publishEvent).toHaveBeenCalledWith("search.user.upsert", {
      userId: user.userId,
    });
  });
});
