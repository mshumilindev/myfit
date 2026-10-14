/**
 * Public barrel of the Coach crypto layer. Production code may import single files or this barrel; the symbols marked
 * `@internal planned` in their files are reachable from here so a test (barrel.test.ts) keeps them honest until the real
 * adapters / screens consume them (scripts/unused-exports.mjs lists what production does not use yet).
 */
export * from './conversationId';
export * from './conversationKey';
export * from './envelope';
export * from './newCollections';
export * from './sealOrThrow';
export * from './securityCode';
