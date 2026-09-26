import prisma from "../src/Config/db";
import * as searchService from "../src/Features/Search/service";
import { startElasticsearch } from "../src/Config/elasticsearch";

const main = async () => {
  await startElasticsearch();

  const users = await prisma.user.findMany();
  for (const user of users) {
    await searchService.indexUser(user);
  }
  console.log(`Indexed ${users.length} users`);

  const transactions = await prisma.transaction.findMany({
    include: { wallet: { include: { user: true } } },
  });
  let indexedCount = 0;
  for (const transaction of transactions) {
    const user = transaction.wallet.user;
    if (!user) continue;
    await searchService.indexTransaction(transaction, user);
    indexedCount++;
  }
  console.log(`Indexed ${indexedCount} transactions`);

  process.exit(0);
};

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
