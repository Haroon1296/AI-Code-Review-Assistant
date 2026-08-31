export interface ManifestContents {
  packageJson?: string | null;
  composerJson?: string | null;
  requirementsTxt?: string | null;
  pyprojectToml?: string | null;
  goMod?: string | null;
  gemfile?: string | null;
}

function safeJsonParse(text: string | null | undefined): Record<string, unknown> | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function dependencyNames(pkg: Record<string, unknown> | null): Set<string> {
  if (!pkg) return new Set();
  const deps = { ...(pkg.dependencies as object), ...(pkg.devDependencies as object) };
  return new Set(Object.keys(deps ?? {}));
}

const NODE_FRAMEWORK_PRIORITY: Array<{ dep: string; framework: string }> = [
  { dep: 'next', framework: 'Next.js' },
  { dep: '@nestjs/core', framework: 'NestJS' },
  { dep: 'fastify', framework: 'Fastify' },
  { dep: 'express', framework: 'Express' },
  { dep: 'react', framework: 'React' },
  { dep: 'vue', framework: 'Vue' },
];

/** Detects the primary application framework from manifest dependency declarations — never guessed from filenames alone. */
export function detectFramework(manifests: ManifestContents): string | null {
  const pkg = dependencyNames(safeJsonParse(manifests.packageJson));
  for (const { dep, framework } of NODE_FRAMEWORK_PRIORITY) {
    if (pkg.has(dep)) return framework;
  }

  const composer = safeJsonParse(manifests.composerJson);
  const composerRequire = { ...(composer?.require as object) };
  const composerDeps = Object.keys(composerRequire ?? {});
  if (composerDeps.some((d) => d.startsWith('laravel/'))) return 'Laravel';
  if (composerDeps.some((d) => d.startsWith('symfony/'))) return 'Symfony';

  const pythonManifest = `${manifests.requirementsTxt ?? ''}\n${manifests.pyprojectToml ?? ''}`.toLowerCase();
  if (pythonManifest.includes('django')) return 'Django';
  if (pythonManifest.includes('fastapi')) return 'FastAPI';
  if (pythonManifest.includes('flask')) return 'Flask';

  const goMod = (manifests.goMod ?? '').toLowerCase();
  if (goMod.includes('gin-gonic/gin')) return 'Gin';
  if (goMod.includes('labstack/echo')) return 'Echo';

  if ((manifests.gemfile ?? '').toLowerCase().includes('rails')) return 'Ruby on Rails';

  return null;
}
