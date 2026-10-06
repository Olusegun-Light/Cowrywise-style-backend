import * as circlesService from "../../src/Features/Circles/service";

export const seedCircles = async (adaId: string, graceId: string) => {
  const circle = await circlesService.createCircle({
    creatorId: adaId,
    name: "Weekly Savers",
    contributionAmount: 50_000n,
    frequency: "WEEKLY",
    maxMembers: 2,
  });

  await circlesService.joinCircle(circle.id, graceId);

  await circlesService.contributeToCircle(circle.id, adaId);
  await circlesService.contributeToCircle(circle.id, graceId);

  console.log("Seeded a circle, two members, and a completed payout round");
};
