const { prisma, logger } = require('../middleware/shared');

const DAILY_GRANT = {
  free: 100,
  pro: 1000,
  team: 999999,
};

const CREDIT_COSTS = {
  chat_gemini: 1,
  chat_gemma: 1,
  image_gen: 5,
  image_gen_hd: 10,
  video_gen: 20,
  workflow: 3,
};

async function getOrCreateCredit(userId) {
  let credit = await prisma.credit.findUnique({ where: { userId } });
  if (!credit) {
    credit = await prisma.credit.create({
      data: { userId, balance: DAILY_GRANT.free },
    });
    await prisma.creditTransaction.create({
      data: { userId, amount: DAILY_GRANT.free, reason: 'daily_grant' },
    });
  }
  return credit;
}

async function grantDailyCredits(userId, tier) {
  const credit = await getOrCreateCredit(userId);
  const grant = DAILY_GRANT[tier] || DAILY_GRANT.free;

  if (credit.balance >= grant) {
    return credit;
  }

  const topUp = grant - credit.balance;
  await prisma.credit.update({
    where: { userId },
    data: { balance: grant },
  });

  await prisma.creditTransaction.create({
    data: { userId, amount: topUp, reason: 'daily_grant' },
  });

  logger.info(`Granted ${topUp} daily credits to user ${userId} (tier: ${tier})`);
  return { ...credit, balance: grant };
}

async function spendCredits(userId, amount, reason, executionId) {
  const credit = await getOrCreateCredit(userId);

  if (credit.balance < amount) {
    return { success: false, balance: credit.balance, needed: amount };
  }

  await prisma.credit.update({
    where: { userId },
    data: { balance: { decrement: amount } },
  });

  await prisma.creditTransaction.create({
    data: {
      userId,
      amount: -amount,
      reason,
      executionId: executionId || null,
    },
  });

  logger.info(`Deducted ${amount} credits from user ${userId} for ${reason}`);
  return { success: true, balance: credit.balance - amount };
}

async function addCredits(userId, amount, reason) {
  await prisma.credit.update({
    where: { userId },
    data: { balance: { increment: amount } },
  });

  await prisma.creditTransaction.create({
    data: { userId, amount, reason },
  });

  logger.info(`Added ${amount} credits to user ${userId} for ${reason}`);
}

async function getCreditBalance(userId) {
  const credit = await getOrCreateCredit(userId);
  return credit.balance;
}

async function getCreditHistory(userId, limit = 50) {
  return prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

module.exports = {
  DAILY_GRANT,
  CREDIT_COSTS,
  getOrCreateCredit,
  grantDailyCredits,
  spendCredits,
  addCredits,
  getCreditBalance,
  getCreditHistory,
};
