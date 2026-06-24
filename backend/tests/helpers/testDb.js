const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  credit: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  thread: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  message: {
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
    groupBy: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  feedback: {
    count: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};

function resetMocks() {
  jest.clearAllMocks();
}

module.exports = { mockPrisma, resetMocks };
