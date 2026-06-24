const mockPrisma = {
  credit: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  creditTransaction: { create: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../middleware/shared', () => ({
  prisma: mockPrisma,
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const { spendCredits, grantDailyCredits, getOrCreateCredit, DAILY_GRANT } = require('../services/credits');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getOrCreateCredit', () => {
  test('returns existing credit when found', async () => {
    const existing = { userId: 'u1', balance: 50 };
    mockPrisma.credit.findUnique.mockResolvedValue(existing);

    const result = await getOrCreateCredit('u1');
    expect(result).toEqual(existing);
    expect(mockPrisma.credit.create).not.toHaveBeenCalled();
  });

  test('creates new credit record if none exists', async () => {
    mockPrisma.credit.findUnique.mockResolvedValue(null);
    mockPrisma.credit.create.mockResolvedValue({ userId: 'u1', balance: DAILY_GRANT.free });

    const result = await getOrCreateCredit('u1');
    expect(result.balance).toBe(DAILY_GRANT.free);
    expect(mockPrisma.credit.create).toHaveBeenCalledWith({
      data: { userId: 'u1', balance: DAILY_GRANT.free },
    });
    expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith({
      data: { userId: 'u1', amount: DAILY_GRANT.free, reason: 'daily_grant' },
    });
  });
});

describe('grantDailyCredits', () => {
  test('does not top up when balance >= grant', async () => {
    mockPrisma.credit.findUnique.mockResolvedValue({ userId: 'u1', balance: 200 });

    const result = await grantDailyCredits('u1', 'free');
    expect(result.balance).toBe(200);
    expect(mockPrisma.credit.update).not.toHaveBeenCalled();
  });

  test('tops up balance to grant amount when below', async () => {
    mockPrisma.credit.findUnique.mockResolvedValue({ userId: 'u1', balance: 30 });

    const result = await grantDailyCredits('u1', 'pro');
    expect(result.balance).toBe(DAILY_GRANT.pro);
    expect(mockPrisma.credit.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { balance: DAILY_GRANT.pro },
    });
    expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith({
      data: { userId: 'u1', amount: DAILY_GRANT.pro - 30, reason: 'daily_grant' },
    });
  });

  test('uses free tier grant for unknown tier', async () => {
    mockPrisma.credit.findUnique.mockResolvedValue({ userId: 'u1', balance: 10 });

    await grantDailyCredits('u1', 'unknown');
    expect(mockPrisma.credit.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { balance: DAILY_GRANT.free },
    });
  });
});

describe('spendCredits', () => {
  test('deducts credits with sufficient balance', async () => {
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ balance: 100 }]),
        credit: { create: jest.fn(), update: jest.fn() },
        creditTransaction: { create: jest.fn() },
      };
      return fn(tx);
    });

    const result = await spendCredits('u1', 5, 'chat_gemini');
    expect(result.success).toBe(true);
    expect(result.balance).toBe(95);
  });

  test('rejects when balance is insufficient', async () => {
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ balance: 2 }]),
        credit: { create: jest.fn() },
      };
      return fn(tx);
    });

    const result = await spendCredits('u1', 5, 'chat_gemini');
    expect(result.success).toBe(false);
    expect(result.balance).toBe(2);
    expect(result.needed).toBe(5);
  });

  test('creates credit row inside transaction if none exists', async () => {
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        credit: {
          create: jest.fn().mockResolvedValue({ balance: 100 }),
          update: jest.fn(),
        },
        creditTransaction: { create: jest.fn() },
      };
      const result = await fn(tx);
      expect(tx.credit.create).toHaveBeenCalledWith({ data: { userId: 'u1', balance: 100 } });
      return result;
    });

    const result = await spendCredits('u1', 1, 'chat_gemini');
    expect(result.success).toBe(true);
  });
});
