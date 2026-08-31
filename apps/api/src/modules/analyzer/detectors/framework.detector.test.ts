import { describe, expect, it } from 'vitest';
import { detectFramework } from './framework.detector.js';

describe('detectFramework', () => {
  it('detects Next.js from package.json dependencies', () => {
    const framework = detectFramework({
      packageJson: JSON.stringify({ dependencies: { next: '14.0.0', react: '18.0.0' } }),
    });
    expect(framework).toBe('Next.js');
  });

  it('prefers a more specific framework over a generic one (Next.js over React)', () => {
    const framework = detectFramework({
      packageJson: JSON.stringify({ dependencies: { react: '18.0.0', next: '14.0.0' } }),
    });
    expect(framework).toBe('Next.js');
  });

  it('detects Laravel from composer.json require entries', () => {
    const framework = detectFramework({
      composerJson: JSON.stringify({ require: { 'laravel/framework': '^10.0' } }),
    });
    expect(framework).toBe('Laravel');
  });

  it('detects Django from requirements.txt', () => {
    const framework = detectFramework({ requirementsTxt: 'Django==5.0\npsycopg2==2.9' });
    expect(framework).toBe('Django');
  });

  it('never invents a framework when there is no manifest evidence', () => {
    const framework = detectFramework({});
    expect(framework).toBeNull();
  });

  it('ignores unparsable manifests instead of throwing', () => {
    const framework = detectFramework({ packageJson: '{not valid json' });
    expect(framework).toBeNull();
  });
});
