/* global module -- CommonJS config read by dependency-cruiser */
/**
 * Module boundaries (SPO-135, rules: .claude/rules/client-architecture.md).
 * Existing violations are frozen in .dependency-cruiser-known-violations.json (a ratchet): fixing one
 * removes it from the file (`npm run deps:baseline`), a NEW violation fails `npm run deps:check` and CI.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Import cycles make load order fragile and hide real dependencies; split or invert one edge.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'kit-stays-presentational',
      severity: 'error',
      comment:
        'components/ui is the shared kit: no store, firebase, vault/crypto, offline or router imports; pass data and callbacks via props.',
      from: { path: '^client/src/components/ui/', pathNot: '\\.(test|stories)\\.[tj]sx?$' },
      to: {
        path: [
          '^client/src/(store|api|firebase|vault[A-Za-z]*|coachCrypto[^/]*|offline[^/]*)(\\.|/)',
          '^client/src/(views|coach|atlas|nutrition|today|learn)/',
          'node_modules/(firebase|react-router)',
        ],
      },
    },
    {
      name: 'no-test-in-prod',
      severity: 'error',
      comment: 'Production code must not import tests or stories.',
      from: { path: '^client/src/', pathNot: '\\.(test|stories)\\.[tj]sx?$|^client/src/stories/' },
      to: { path: '\\.(test|stories)\\.[tj]sx?$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    exclude: { path: '\\.(test|stories)\\.[tj]sx?$|\\.d\\.ts$' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
