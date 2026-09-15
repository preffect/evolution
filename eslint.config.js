// Lint enforcement of docs/CODE-STANDARDS.md (#69). Every number and list here is named in
// that document; change the document first, then this file.
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import unicorn from 'eslint-plugin-unicorn';
import sonarjs from 'eslint-plugin-sonarjs';

// ---- CODE-STANDARDS §5: sizes ---------------------------------------------------------
const MAX_LINES_PER_FILE = 300;
const MAX_LINES_PER_FUNCTION = 40;
const MAX_CYCLOMATIC_COMPLEXITY = 10;
const MAX_COGNITIVE_COMPLEXITY = 15;
const MAX_PARAMETERS = 4;
const MAX_NESTING_DEPTH = 3;
const MAX_NESTED_CALLBACKS = 3;

// ---- CODE-STANDARDS §6: names ---------------------------------------------------------
const MIN_IDENTIFIER_LENGTH = 3;
/** Identifiers shorter than the minimum that §6 allows (coordinates, ids, zod's namespace). */
const SHORT_IDENTIFIER_ALLOW_LIST = ['x', 'y', 'id', 'z'];
/** Abbreviations §6 allows; everything else in unicorn's default table is a violation. */
const ABBREVIATION_ALLOW_LIST = { env: true, params: true, ref: true, args: true };
/** Abbreviations §6 names explicitly that unicorn's default table does not know. */
const EXTRA_ABBREVIATIONS = {
  conn: { connection: true },
  conns: { connections: true },
  msg: { message: true },
  pid: { playerId: true },
  gid: { gameId: true },
  dt: { deltaSeconds: true },
  pc: { playerCell: true },
  snap: { snapshot: true },
  mem: { memory: true },
  proto: { protocol: true },
  ev: { event: true },
  mp: { multiplayer: true },
};
const BOOLEAN_PREFIXES = ['is', 'has', 'can', 'should', 'was', 'did', 'will'];
/** The same predicates on a module-level constant: `IS_LITTLE_ENDIAN`, `HAS_SHARED_ARRAY_BUFFER` (§6). */
const BOOLEAN_CONSTANT_PREFIXES = BOOLEAN_PREFIXES.map((prefix) => `${prefix.toUpperCase()}_`);
const NUMERIC_LITERALS_ALLOWED_EVERYWHERE = [0, 1, -1];

// ---- CODE-STANDARDS §8: determinism bans ----------------------------------------------
const BANNED_TIMER_GLOBALS = ['setTimeout', 'setInterval', 'requestAnimationFrame'].map((name) => ({
  name,
  message: `Time flows through the injected Clock / Ticker only (docs/determinism/contract-and-clock.md §1). ${name} is banned in game code.`,
}));
const BANNED_WALL_CLOCK_PROPERTIES = [
  {
    object: 'Math',
    property: 'random',
    message: 'Draw from a named seeded stream (docs/determinism/random-streams.md §3).',
  },
  {
    object: 'Date',
    property: 'now',
    message: 'Read time through the injected Clock (docs/determinism/contract-and-clock.md §2).',
  },
  {
    object: 'performance',
    property: 'now',
    message: 'SystemClock is the one allowed call site (docs/determinism/contract-and-clock.md §2).',
  },
];

// ---- File groups ---------------------------------------------------------------------
const SOURCE_FILES = ['packages/*/src/**/*.ts'];
const TEST_FILES = ['packages/*/src/**/*.test.ts', 'packages/*/src/**/*.spec.ts'];
/** Builders and scenario fixtures: their defaults are the only tolerated inline numbers (§2, §10). */
const TEST_SUPPORT_FILES = ['packages/*/src/testing/**'];

// ---- architecture/encyclopedia.md §12.6: the formatter and the encyclopedia never import a tunable -----------------
const LIVE_BALANCE_READERS = 'packages/client/src/app/game/{encyclopedia,quantities}';
/** The two files that may read `DEFAULT_BALANCE`: the outside-a-room context and the registry's structure. */
const ENCYCLOPEDIA_DEFAULT_BALANCE_FILES = [
  'packages/client/src/app/game/encyclopedia/encyclopedia-context.ts',
  'packages/client/src/app/game/encyclopedia/registry.ts',
];
/** `UPPER_SNAKE_CASE` shared names that are no balance key: the id objects, and the clock's unit conversion. */
export const SHARED_NAMES_WITHOUT_A_BALANCE_KEY = [
  'CELL_STAGE',
  'ZONE_ID',
  'DNA_TAG',
  'CELL_KIND',
  'FOOD_KIND',
  'BACTERIUM_VARIANT',
  'ENTITY_KIND',
  'EFFECT_KIND',
  'CELL_STATE',
  'GAME_MODE',
  'WORLD_STANDING',
  'ENGULF_PHASE',
  'TRAIT_CATEGORY',
  'TRAIT_RARITY',
  'SECONDS_PER_MINUTE',
  'FIRST_TIER',
  'FIRST_LEVEL',
];
const LIVE_BALANCE_MESSAGE = 'Read tunables from the live balance (the context), never from a module import (§12.6).';
/** The syntax half of the live-balance guard: a namespace import of the shared package, any `.tiers` access. */
const LIVE_BALANCE_SYNTAX_RESTRICTIONS = [
  {
    selector: "ImportDeclaration[source.value='@evolution/shared'] > ImportNamespaceSpecifier",
    message: LIVE_BALANCE_MESSAGE,
  },
  {
    selector: "MemberExpression[property.name='tiers']",
    message: 'Tier numbers are read from balance.traits.TRAIT_TIERS only (constants-files-tests.md §9).',
  },
];
/** Encyclopedia content holds no number and computes none, even through a named constant (§12.6). */
const ENCYCLOPEDIA_CONTENT_FILES = ['packages/client/src/app/game/encyclopedia/content/**/*.ts'];
const CONTENT_NUMBER_MESSAGE = 'Encyclopedia content names a fact source, never a number or arithmetic (§12.3, §12.6).';
const CONTENT_SYNTAX_RESTRICTIONS = [
  { selector: 'Literal[raw=/^[0-9.]/]', message: CONTENT_NUMBER_MESSAGE },
  { selector: 'BinaryExpression[operator=/^([-+*/%]|\\*\\*)$/]', message: CONTENT_NUMBER_MESSAGE },
  { selector: 'AssignmentExpression[operator=/^([-+*/%]|\\*\\*)=$/]', message: CONTENT_NUMBER_MESSAGE },
  { selector: 'UpdateExpression', message: CONTENT_NUMBER_MESSAGE },
];
/** Forbids importing any `UPPER_SNAKE_CASE` name from `@evolution/shared` but `allowedNames`, a namespace import, `.tiers`. */
function liveBalanceOnlyRules(allowedNames) {
  return {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@evolution/shared'],
            importNamePattern: `^(?!(?:${allowedNames.join('|')})$)[A-Z][A-Z0-9_]*$`,
            message: LIVE_BALANCE_MESSAGE,
          },
        ],
      },
    ],
    'no-restricted-syntax': ['error', ...LIVE_BALANCE_SYNTAX_RESTRICTIONS],
  };
}
/** The definition sites of constants: a literal here IS the named constant (§1). */
const CONSTANT_DEFINITION_FILES = [
  'packages/shared/src/constants/**',
  'packages/client/src/app/game/render/constants.ts',
  'packages/client/src/app/game/render/constants/**',
  'packages/client/src/app/ui-kit/ui-kit-constants.ts',
];
/**
 * The UI kit's boundary (docs/ui/components-and-constants.md §10.1): it knows no game, so from `game/**` it imports
 * exactly the two files its colour and type roles live in, and nothing at all from the shared package.
 */
const UI_KIT_FILES = ['packages/client/src/app/ui-kit/**/*.ts'];
const UI_KIT_RESTRICTED_IMPORTS = [
  {
    regex: '(^|/)game/(?!render/constants/(colours|ui-type)$)',
    message:
      'The UI kit imports from game/** only game/render/constants/colours.ts and ui-type.ts (docs/ui/components-and-constants.md §10.1).',
  },
  {
    regex: '^@evolution/shared',
    message: 'The UI kit imports nothing from @evolution/shared (docs/ui/components-and-constants.md §10.1).',
  },
];
/** The only game-path modules allowed to touch the wall clock, the PRNG or timers (§8). */
const DETERMINISM_CALL_SITES = [
  'packages/shared/src/random/**',
  'packages/shared/src/time/**',
  'packages/server/src/lobby/ticker.ts',
];

/**
 * Template-owned infrastructure (CODE-STANDARDS §5, "Template-owned files"): each entry names the
 * ticket that retires it. #118 brings these files under the size cap and the determinism bans; a
 * game file never goes here.
 */
const TEMPLATE_FILE_EXEMPTIONS = [
  {
    // #118: the disconnect grace timers (#334 split them out of lobby-manager.ts, which is under the size cap).
    files: ['packages/server/src/lobby/seat-lifecycle.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    // #118: reconnect backoff timer.
    files: ['packages/client/src/app/services/websocket.service.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    // #118: the localStorage identity fallback mints from Date.now + Math.random.
    files: ['packages/client/src/app/services/identity.service.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },
];

export default tseslint.config(
  {
    // Reference artifacts with placeholder syntax — not project source; agent worktrees
    // (scripts/agent.sh --branch) are other checkouts and validate themselves.
    ignores: ['ha-router/**', 'dist/**', 'packages/*/dist/**', '.worktrees/**', 'packages/client/.angular/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // ---- The code standards, on every package source file -----------------------------
    files: SOURCE_FILES,
    plugins: { unicorn, sonarjs },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // §1 no magic values
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: NUMERIC_LITERALS_ALLOWED_EVERYWHERE,
          ignoreArrayIndexes: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
          detectObjects: true,
          enforceConst: true,
        },
      ],
      // §5 small units
      'max-lines': ['error', { max: MAX_LINES_PER_FILE, skipBlankLines: false, skipComments: false }],
      'max-lines-per-function': ['error', { max: MAX_LINES_PER_FUNCTION, skipBlankLines: true, skipComments: true }],
      complexity: ['error', MAX_CYCLOMATIC_COMPLEXITY],
      'sonarjs/cognitive-complexity': ['error', MAX_COGNITIVE_COMPLEXITY],
      'max-params': ['error', MAX_PARAMETERS],
      'max-depth': ['error', MAX_NESTING_DEPTH],
      'max-nested-callbacks': ['error', MAX_NESTED_CALLBACKS],
      // §3 no duplicated logic (jscpd covers blocks; these catch the small cases)
      'sonarjs/no-duplicate-string': 'error',
      'sonarjs/no-identical-functions': 'error',
      // §6 full descriptive names
      'id-length': [
        'error',
        { min: MIN_IDENTIFIER_LENGTH, exceptions: SHORT_IDENTIFIER_ALLOW_LIST, properties: 'never' },
      ],
      // unicorn ≥ 74 renamed prevent-abbreviations (the name CODE-STANDARDS §6 uses) to name-replacements.
      'unicorn/name-replacements': [
        'error',
        {
          allowList: ABBREVIATION_ALLOW_LIST,
          replacements: EXTRA_ABBREVIATIONS,
          checkFilenames: false,
          checkProperties: false,
          checkShorthandProperties: false,
          ignore: ['^_'],
        },
      ],
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        { selector: 'variable', modifiers: ['const', 'global'], format: ['camelCase', 'UPPER_CASE'] },
        { selector: 'classProperty', modifiers: ['static', 'readonly'], format: ['camelCase', 'UPPER_CASE'] },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
        // Branded ids carry `__brand`; rxjs streams carry a `$` suffix.
        { selector: 'typeProperty', format: ['camelCase'], leadingUnderscore: 'allowDouble' },
        {
          selector: ['classProperty', 'typeProperty', 'variable'],
          filter: { regex: '\\$$', match: true },
          format: ['camelCase'],
          suffix: ['$'],
        },
        // Keys imposed by external schemas / headers are quoted and left alone.
        { selector: ['objectLiteralProperty', 'typeProperty'], modifiers: ['requiresQuotes'], format: null },
        // Booleans read as predicates (§6). Object-literal keys are left out: they are mostly options
        // handed to frameworks (`standalone`, `logger`, `websocket`); our own shapes are typed, so
        // `typeProperty` covers them. A module-level boolean constant keeps the UPPER_SNAKE_CASE of
        // every other module-level constant, with the predicate as its first word: `IS_LITTLE_ENDIAN`.
        {
          selector: 'variable',
          modifiers: ['const', 'global'],
          types: ['boolean'],
          format: ['UPPER_CASE'],
          prefix: BOOLEAN_CONSTANT_PREFIXES,
        },
        {
          selector: ['variable', 'parameter', 'classProperty', 'typeProperty'],
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: BOOLEAN_PREFIXES,
        },
      ],
      // §9 error handling: server.log on the server, nothing in shared, the HUD banner on the client.
      'no-console': ['error', { allow: ['error', 'warn'] }],
      // §8 determinism
      'no-restricted-globals': ['error', ...BANNED_TIMER_GLOBALS],
      'no-restricted-properties': ['error', ...BANNED_WALL_CLOCK_PROPERTIES],
    },
  },
  {
    files: ['packages/shared/src/**/*.ts'],
    rules: { 'no-console': 'error' },
  },
  {
    // §9 error handling: a promise is awaited, returned or handled. The scenario runner is async
    // (#262), and an unawaited `.runDeterministic()` would pass a row before it ran.
    files: ['packages/server/src/**/*.ts', 'packages/shared/src/**/*.ts'],
    rules: { '@typescript-eslint/no-floating-promises': 'error' },
  },
  {
    // ---- Where a literal IS the constant --------------------------------------------
    files: [...CONSTANT_DEFINITION_FILES, ...TEST_SUPPORT_FILES],
    rules: { '@typescript-eslint/no-magic-numbers': 'off' },
  },
  {
    // ---- Tests: inline values, repeated strings and long describe blocks are the norm ---
    files: TEST_FILES,
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      'no-restricted-globals': 'off',
    },
  },
  {
    // ---- The one PRNG, the one clock, the one ticker ---------------------------------
    files: DETERMINISM_CALL_SITES,
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
  {
    // ---- architecture/encyclopedia.md §12.6: the formatter and the encyclopedia read tunables from the live balance
    files: [`${LIVE_BALANCE_READERS}/**/*.ts`],
    // Only their own specs (`*.spec.ts`, `*.integration.spec.ts`) read `DEFAULT_BALANCE`, to pin the shipped text.
    ignores: [`${LIVE_BALANCE_READERS}/**/*.spec.ts`, ...ENCYCLOPEDIA_DEFAULT_BALANCE_FILES],
    rules: liveBalanceOnlyRules(SHARED_NAMES_WITHOUT_A_BALANCE_KEY),
  },
  {
    files: ENCYCLOPEDIA_DEFAULT_BALANCE_FILES,
    rules: liveBalanceOnlyRules([...SHARED_NAMES_WITHOUT_A_BALANCE_KEY, 'DEFAULT_BALANCE']),
  },
  {
    // A later `no-restricted-syntax` replaces an earlier one, so the content block repeats the live-balance selectors.
    files: ENCYCLOPEDIA_CONTENT_FILES,
    rules: {
      'no-restricted-syntax': ['error', ...LIVE_BALANCE_SYNTAX_RESTRICTIONS, ...CONTENT_SYNTAX_RESTRICTIONS],
    },
  },
  ...TEMPLATE_FILE_EXEMPTIONS,
  {
    files: ['packages/client/**/*.ts'],
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    // ---- The UI kit: its own `ui` prefix, and its import boundary -------------------------
    files: UI_KIT_FILES,
    rules: {
      'no-restricted-imports': ['error', { patterns: UI_KIT_RESTRICTED_IMPORTS }],
      '@angular-eslint/component-selector': [
        'error',
        [
          { type: 'element', prefix: 'ui', style: 'kebab-case' },
          { type: 'attribute', prefix: 'ui', style: 'camelCase' },
        ],
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
);
