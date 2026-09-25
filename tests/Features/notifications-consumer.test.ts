jest.mock("../../src/Features/Notifications/service");

import { handleMessage } from "../../src/Features/Notifications/consumer";
import * as notificationsService from "../../src/Features/Notifications/service";

describe("Notifications event consumer — handleMessage", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("turns a circle.payout event into a CIRCLE notification", async () => {
    await handleMessage("circle.payout", {
      userId: "user-1",
      circleId: "circle-1",
      round: 2,
    });

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      "user-1",
      "CIRCLE",
      "Circle payout received",
      "Your circle round has completed and the payout has been credited to your wallet.",
    );
  });

  it("turns a kyc.approved event into a KYC notification", async () => {
    await handleMessage("kyc.approved", { userId: "user-2" });

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      "user-2",
      "KYC",
      "KYC approved",
      "Your identity verification has been approved.",
    );
  });

  it("turns a kyc.rejected event into a KYC notification carrying the reason", async () => {
    await handleMessage("kyc.rejected", {
      userId: "user-3",
      reason: "Selfie did not match ID photo",
    });

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      "user-3",
      "KYC",
      "KYC rejected",
      "Your identity verification was rejected: Selfie did not match ID photo",
    );
  });

  it("logs and does nothing for an unrecognized routing key, without throwing", async () => {
    await expect(
      handleMessage("some.future.event", { anything: true }),
    ).resolves.toBeUndefined();

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });
});
