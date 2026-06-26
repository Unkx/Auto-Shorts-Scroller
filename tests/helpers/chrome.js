function createChromeMock() {
  return {
    runtime: {
      onMessage: { addListener: jest.fn() },
      onInstalled: { addListener: jest.fn() },
    },
    storage: {
      sync: {
        get: jest.fn((defaults, cb) => cb({ ...defaults })),
        set: jest.fn(),
      },
    },
    tabs: {
      query: jest.fn(),
      sendMessage: jest.fn().mockReturnValue(Promise.resolve()),
    },
  };
}

module.exports = { createChromeMock };
