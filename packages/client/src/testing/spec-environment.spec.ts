// @vitest-environment node
// The client spec environment convention (docs/testing/tiers-and-builders.md §2.1, #477), enforced (#489). A spec
// runs under jsdom unless its docblock says `node`, and jsdom costs ~1.8 s a file before the spec asserts anything.
// This walks every client spec's transitive import graph (static and dynamic imports, into `@evolution/shared`'s
// sources; `import type` loads nothing and is not followed) and pins both directions:
// (a) a spec whose graph reaches no DOM carries the `node` docblock;
// (b) a `node` spec's graph holds no environment sniff (`typeof` or a `globalThis.` read of a DOM global, `self` or
//     `process`, or `'document' in globalThis`), which takes the other branch under node instead of throwing, and
//     stays green while the spec tests code the browser never runs.
// "Reaches the DOM" is the rule PR #487 converted 91 specs by (§2.1), conservative on purpose: a file in the graph
// imports a package other than `vitest`, a `node:` builtin or `@evolution/shared` (`@angular/*`, `pixi.js`, and any
// third-party package no one has checked under node), or names a DOM global in its code (`DOM_GLOBALS`). The names
// are read off the TypeScript syntax tree, so a comment, a string or another object's `.window` member does not
// count. It over-blocks: a spec it calls DOM-reaching may still pass under node, and (b) is its only bar. A real
// false positive of (a) or (b) goes in `EXEMPTIONS` with the reason.

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import typescript from 'typescript';
import { describe, expect, it } from 'vitest';

import { DOM_GLOBALS, SNIFFED_GLOBALS } from './dom-globals';
import { DYNAMIC_IMPORT, STATIC_IMPORT, importGraph, type ImportGraph } from './import-graph';
import { repoPath } from './repo-document';

const CLIENT_SOURCE = 'packages/client/src';
const SHARED_PACKAGE = '@evolution/shared';
const SHARED_ENTRY = 'packages/shared/src/index.ts';
const SPEC_SUFFIX = '.spec.ts';
const TYPESCRIPT_SUFFIX = '.ts';
const NODE_ENVIRONMENT = 'node';
/** Vitest's own docblock pattern (`vitest/dist`, `groupFilesByEnv`): the first match anywhere in the spec. */
const ENVIRONMENT_DOCBLOCK = /@(?:vitest|jest)-environment\s+([\w-]+)\b/;
const NODE_BUILTIN_PREFIX = 'node:';
const PACKAGES_SAFE_UNDER_NODE: readonly string[] = ['vitest'];

const GLOBAL_THIS = 'globalThis';

interface Exemption {
  /** The spec's path under `packages/client/src`. */
  readonly spec: string;
  readonly rule: 'dom-free-needs-node' | 'node-graph-has-no-sniff';
  readonly reason: string;
}

/** Specs the classifier misreads, each with the reason a reviewer accepted. Empty is the goal. */
const EXEMPTIONS: readonly Exemption[] = [];

interface FileFacts {
  readonly hasDomGlobal: boolean;
  readonly hasEnvironmentSniff: boolean;
}

interface SpecFacts {
  readonly spec: string;
  readonly environment: string | undefined;
  readonly isDomReaching: boolean;
  readonly sniffingFiles: readonly string[];
}

function specFiles(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith(SPEC_SUFFIX))
    .map((path) => join(root, path))
    .sort();
}

function packageReachesDom(specifier: string): boolean {
  return !specifier.startsWith(NODE_BUILTIN_PREFIX) && !PACKAGES_SAFE_UNDER_NODE.includes(specifier);
}

/** `globalThis.window`, read as the global it names. */
function isGlobalThisMember(node: typescript.PropertyAccessExpression): boolean {
  return typescript.isIdentifier(node.expression) && node.expression.text === GLOBAL_THIS;
}

/** A DOM global named as code: bare, or through `globalThis.`, but not as another object's member. */
function isDomGlobalRead(node: typescript.Node): boolean {
  if (!typescript.isIdentifier(node) || !DOM_GLOBALS.includes(node.text)) return false;
  const parent = node.parent;
  return !(typescript.isPropertyAccessExpression(parent) && parent.name === node && !isGlobalThisMember(parent));
}

/** `typeof ResizeObserver` and its kin, bare or through `globalThis.`. */
function isTypeofSniff(node: typescript.Node): boolean {
  if (!typescript.isTypeOfExpression(node)) return false;
  const operand =
    typescript.isPropertyAccessExpression(node.expression) && isGlobalThisMember(node.expression)
      ? node.expression.name
      : node.expression;
  return typescript.isIdentifier(operand) && SNIFFED_GLOBALS.includes(operand.text);
}

/** `globalThis.devicePixelRatio ?? 1`: under node the read is `undefined`, not a throw, so the fallback runs. */
function isGlobalThisSniff(node: typescript.Node): boolean {
  return (
    typescript.isPropertyAccessExpression(node) && isGlobalThisMember(node) && SNIFFED_GLOBALS.includes(node.name.text)
  );
}

/** `'document' in globalThis`, whatever the name. */
function isInGlobalThisSniff(node: typescript.Node): boolean {
  return (
    typescript.isBinaryExpression(node) &&
    node.operatorToken.kind === typescript.SyntaxKind.InKeyword &&
    typescript.isIdentifier(node.right) &&
    node.right.text === GLOBAL_THIS
  );
}

/** Code that asks whether it runs in a browser, and so takes another branch under node instead of throwing. */
function isEnvironmentSniff(node: typescript.Node): boolean {
  return isTypeofSniff(node) || isGlobalThisSniff(node) || isInGlobalThisSniff(node);
}

function factsOf(file: string, source: string): FileFacts {
  const facts = { hasDomGlobal: false, hasEnvironmentSniff: false };
  const visit = (node: typescript.Node): void => {
    facts.hasDomGlobal ||= isDomGlobalRead(node);
    facts.hasEnvironmentSniff ||= isEnvironmentSniff(node);
    typescript.forEachChild(node, visit);
  };
  visit(typescript.createSourceFile(file, source, typescript.ScriptTarget.Latest, true));
  return facts;
}

function classifySpecs(): SpecFacts[] {
  const root = repoPath(CLIENT_SOURCE);
  const sources = new Map<string, string>();
  const readSource = (file: string): string => {
    const cached = sources.get(file) ?? readFileSync(file, 'utf8');
    sources.set(file, cached);
    return cached;
  };
  const facts = new Map<string, FileFacts>();
  const factsFor = (file: string): FileFacts => {
    const cached = facts.get(file) ?? factsOf(file, readSource(file));
    facts.set(file, cached);
    return cached;
  };
  const walk = {
    patterns: [STATIC_IMPORT, DYNAMIC_IMPORT],
    packageEntries: { [SHARED_PACKAGE]: repoPath(SHARED_ENTRY) },
    readSource,
  };
  return specFiles(root).map((specPath) => {
    const graph: ImportGraph = importGraph(specPath, walk);
    const sourceFiles = [...graph.files].filter((file) => file.endsWith(TYPESCRIPT_SUFFIX));
    return {
      spec: relative(root, specPath),
      environment: ENVIRONMENT_DOCBLOCK.exec(readSource(specPath))?.[1],
      isDomReaching:
        [...graph.packages].some(packageReachesDom) || sourceFiles.some((file) => factsFor(file).hasDomGlobal),
      sniffingFiles: sourceFiles
        .filter((file) => factsFor(file).hasEnvironmentSniff)
        .map((file) => relative(root, file)),
    };
  });
}

/** Whether the spec still breaks the rule its exemption waives; an exemption that no longer does is stale. */
function isExemptionStillNeeded(exemption: Exemption, facts: SpecFacts | undefined): boolean {
  if (facts === undefined) return false;
  return exemption.rule === 'dom-free-needs-node'
    ? !facts.isDomReaching && facts.environment !== NODE_ENVIRONMENT
    : facts.environment === NODE_ENVIRONMENT && facts.sniffingFiles.length > 0;
}

function exempt(rule: Exemption['rule']): Set<string> {
  return new Set(EXEMPTIONS.filter((exemption) => exemption.rule === rule).map((exemption) => exemption.spec));
}

describe('the client spec environment (#477, #489)', () => {
  const specs = classifySpecs();
  const bySpec = new Map(specs.map((facts) => [facts.spec, facts]));

  it('reads DOM globals and sniffs from code, not from prose, strings or members', () => {
    const facts = (source: string): FileFacts => factsOf('probe.ts', source);
    expect(facts('document.body.append(node);').hasDomGlobal).toBe(true);
    expect(facts('const context = globalThis.window;').hasDomGlobal).toBe(true);
    expect(facts("// the window closes\nconst label = 'document';").hasDomGlobal).toBe(false);
    expect(facts('const width = this.window.width;').hasDomGlobal).toBe(false);
    expect(facts("const isBrowser = typeof window !== 'undefined';").hasEnvironmentSniff).toBe(true);
    expect(facts("const hasPage = typeof globalThis.document === 'object';").hasEnvironmentSniff).toBe(true);
    expect(facts("const hasPage = 'document' in globalThis;").hasEnvironmentSniff).toBe(true);
    expect(facts("const canObserve = typeof ResizeObserver !== 'undefined';").hasEnvironmentSniff).toBe(true);
    expect(facts("const isNode = typeof process === 'object';").hasEnvironmentSniff).toBe(true);
    expect(facts('const pixelRatio = globalThis.devicePixelRatio ?? 1;').hasEnvironmentSniff).toBe(true);
    expect(facts('const pixelRatio = devicePixelRatio;').hasEnvironmentSniff).toBe(false);
    expect(facts('const ratio = screen.devicePixelRatio ?? 1;').hasEnvironmentSniff).toBe(false);
    expect(facts("// typeof window !== 'undefined'\nconst kind = typeof value;").hasEnvironmentSniff).toBe(false);
  });

  it('classifies known specs the way their graphs say', () => {
    // Angular's root component under TestBed, and a formatter whose graph is its module and @evolution/shared.
    expect(bySpec.get('app/app.component.spec.ts')?.isDomReaching).toBe(true);
    expect(bySpec.get('app/game/hud/format/leaderboard-rows.spec.ts')?.isDomReaching).toBe(false);
  });

  it('gives every spec whose graph reaches no DOM the node docblock', () => {
    const allowed = exempt('dom-free-needs-node');
    const missing = specs
      .filter((facts) => !facts.isDomReaching && facts.environment !== NODE_ENVIRONMENT && !allowed.has(facts.spec))
      .map((facts) => facts.spec);
    expect(missing, 'add `// @vitest-environment node` as the first line').toEqual([]);
  });

  it('lets no node spec import a module that sniffs the environment', () => {
    const allowed = exempt('node-graph-has-no-sniff');
    const sniffing = specs
      .filter((facts) => facts.environment === NODE_ENVIRONMENT && facts.sniffingFiles.length > 0)
      .filter((facts) => !allowed.has(facts.spec))
      .map((facts) => `${facts.spec} <- ${facts.sniffingFiles.join(', ')}`);
    expect(sniffing, 'drop the node docblock, or the sniff').toEqual([]);
  });

  it('keeps an exemption only while its spec still breaks the rule it waives', () => {
    const domFree: SpecFacts = {
      spec: 'probe.spec.ts',
      environment: undefined,
      isDomReaching: false,
      sniffingFiles: [],
    };
    const nodeSniffing: SpecFacts = { ...domFree, environment: NODE_ENVIRONMENT, sniffingFiles: ['probe.ts'] };
    const waiveDocblock: Exemption = { spec: domFree.spec, rule: 'dom-free-needs-node', reason: 'probe' };
    const waiveSniff: Exemption = { spec: domFree.spec, rule: 'node-graph-has-no-sniff', reason: 'probe' };
    expect(isExemptionStillNeeded(waiveDocblock, domFree)).toBe(true);
    expect(isExemptionStillNeeded(waiveDocblock, { ...domFree, environment: NODE_ENVIRONMENT })).toBe(false);
    expect(isExemptionStillNeeded(waiveDocblock, { ...domFree, isDomReaching: true })).toBe(false);
    expect(isExemptionStillNeeded(waiveSniff, nodeSniffing)).toBe(true);
    expect(isExemptionStillNeeded(waiveSniff, { ...nodeSniffing, sniffingFiles: [] })).toBe(false);
    expect(isExemptionStillNeeded(waiveSniff, undefined)).toBe(false);
    for (const exemption of EXEMPTIONS) {
      expect(isExemptionStillNeeded(exemption, bySpec.get(exemption.spec)), `${exemption.spec}: stale exemption`).toBe(
        true,
      );
    }
  });
});
