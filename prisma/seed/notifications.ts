import * as notificationsService from "../../src/Features/Notifications/service";

export const seedNotifications = async () => {
  await notificationsService.createBroadcast(
    "BROADCAST",
    "Welcome to Cowrywise",
    "Thanks for joining — explore savings, investments, and group circles to start growing your money.",
  );

  console.log("Seeded a broadcast notification");
};
