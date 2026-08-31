import { isExcludedPath } from '@acra/shared';
import type { TreeEntry } from '../analyzer/analyzer.types.js';

const LAYER_SUFFIXES = [
  'Controller',
  'Service',
  'Repository',
  'Request',
  'Model',
  'Middleware',
  'Resource',
  'Job',
  'Event',
  'Validator',
  'Test',
  'Spec',
];

function baseNameWithoutExt(path: string): string {
  const fileName = path.split('/').pop() ?? path;
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
}

function dirName(path: string): string {
  const segments = path.split('/');
  segments.pop();
  return segments.join('/');
}

/** Strips a trailing layer suffix (e.g. `PaymentController` -> `Payment`) so files across layers can be matched by component name. */
function componentStem(baseName: string): string {
  for (const suffix of LAYER_SUFFIXES) {
    if (baseName.length > suffix.length && baseName.endsWith(suffix)) {
      return baseName.slice(0, -suffix.length);
    }
  }
  return baseName;
}

export interface RelevantFileCandidate {
  path: string;
  reason: 'same-directory' | 'same-component';
}

/**
 * Picks existing (unchanged) files likely relevant to reviewing the changed
 * files: siblings in the same directory, and files elsewhere in the repo that
 * share a "component" name across architectural layers (e.g. `PaymentService`
 * when `PaymentController` changed).
 */
export function selectRelevantFiles(
  treeEntries: TreeEntry[],
  changedFilePaths: string[],
  maxRelevantFiles: number,
  excludedPatterns: string[] = [],
): RelevantFileCandidate[] {
  const changedSet = new Set(changedFilePaths);
  const files = treeEntries.filter(
    (e) => e.type === 'blob' && !changedSet.has(e.path) && !isExcludedPath(e.path, excludedPatterns),
  );

  const filesByDir = new Map<string, string[]>();
  for (const file of files) {
    const dir = dirName(file.path);
    const list = filesByDir.get(dir) ?? [];
    list.push(file.path);
    filesByDir.set(dir, list);
  }

  const selected = new Map<string, RelevantFileCandidate>();

  for (const changedPath of changedFilePaths) {
    const dir = dirName(changedPath);
    const siblings = (filesByDir.get(dir) ?? []).filter((p) => p !== changedPath);
    for (const sibling of siblings.slice(0, 2)) {
      if (!selected.has(sibling)) selected.set(sibling, { path: sibling, reason: 'same-directory' });
    }
  }

  for (const changedPath of changedFilePaths) {
    const changedBaseName = baseNameWithoutExt(changedPath);
    const stem = componentStem(changedBaseName);
    if (stem === changedBaseName) continue; // no recognized layer suffix, skip fuzzy match

    // Look for one file per *other* architectural layer sharing this component
    // name (e.g. `PaymentController` changed -> find `PaymentService`,
    // `PaymentRepository`, ... one candidate per suffix, not just the first
    // file anywhere in the tree that happens to match the stem).
    for (const suffix of LAYER_SUFFIXES) {
      const candidateBaseName = `${stem}${suffix}`;
      if (candidateBaseName === changedBaseName) continue;

      const match = files.find(
        (f) => !selected.has(f.path) && baseNameWithoutExt(f.path) === candidateBaseName,
      );
      if (match) selected.set(match.path, { path: match.path, reason: 'same-component' });
    }
  }

  return [...selected.values()].slice(0, maxRelevantFiles);
}
