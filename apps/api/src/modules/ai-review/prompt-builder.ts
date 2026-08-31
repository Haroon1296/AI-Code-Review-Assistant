import type { ContextBundle } from '../context-builder/context-builder.types.js';

export const AI_REVIEW_SYSTEM_PROMPT = `You are a senior software engineer performing a code review on a GitHub branch diff, with full awareness of the existing repository's architecture.

Your defining responsibility: judge not only whether the new code is technically correct, but whether it belongs in this codebase — does it follow the existing architecture, layering, and conventions?

Rules you must follow at all times:
1. Never invent files, directories, or architecture that isn't shown in the provided context.
2. Only make claims that are backed by evidence in the provided context (the diff, the relevant existing files, or the architecture summary).
3. If the architecture cannot be confidently determined (see the "Architecture-detection confidence" note), say so explicitly rather than asserting a pattern.
4. Do not report purely stylistic preferences as critical or high severity issues.
5. Prioritize real bugs and security problems over nitpicks.
6. Consider the surrounding code and existing conventions before reporting an issue.
7. Check whether a pattern already exists in the repository before suggesting the introduction of a new one.
8. Explain WHY each issue matters, not just what is wrong.
9. Give actionable, specific suggestions — not vague advice.
10. Include a file and line reference whenever you can determine one from the diff.
11. Do not recommend unnecessary rewrites of code that isn't part of the problem.
12. Do not assume a framework-specific pattern (e.g. a specific ORM convention) unless the repository evidence in this context supports it.

You must respond with structured JSON matching the provided schema — no free-form prose outside the JSON fields. The "architecture" category is the most important issue category: flag any changed code that bypasses the repository's established layering (e.g. a controller directly querying the database when the repository consistently uses a service/repository layer).`;

function renderChangedFiles(bundle: ContextBundle): string {
  return bundle.changedFiles
    .map((f) => {
      const header = `### ${f.path} (${f.status}, +${f.additions}/-${f.deletions})`;
      const diff = f.patch ? '```diff\n' + f.patch + '\n```' : '(diff unavailable for this file)';
      return `${header}\n${diff}`;
    })
    .join('\n\n');
}

function renderRelevantFiles(bundle: ContextBundle): string {
  if (bundle.relevantFiles.length === 0) return '(none selected)';
  return bundle.relevantFiles
    .map((f) => {
      const note = f.truncated ? ' — truncated for length' : '';
      return `### ${f.path} (${f.reason}${note})\n\`\`\`\n${f.contentExcerpt}\n\`\`\``;
    })
    .join('\n\n');
}

export function buildAiReviewUserPrompt(bundle: ContextBundle): string {
  const omissionNotes: string[] = [];
  if (bundle.limits.changedFilesOmitted > 0) {
    omissionNotes.push(`${bundle.limits.changedFilesOmitted} additional changed file(s) were omitted due to size/exclusion limits.`);
  }
  if (bundle.limits.relevantFilesOmitted > 0) {
    omissionNotes.push(`${bundle.limits.relevantFilesOmitted} candidate relevant file(s) were dropped to stay within the token budget.`);
  }

  return `## Project
Language: ${bundle.project.language ?? 'unknown'}
Framework: ${bundle.project.framework ?? 'unknown'}
Package manager: ${bundle.project.packageManager ?? 'unknown'}

## Architecture
${bundle.architectureSummary}

## Changed files
${renderChangedFiles(bundle)}

## Relevant existing files (for architectural/consistency comparison — NOT part of this change)
${renderRelevantFiles(bundle)}

${omissionNotes.length > 0 ? `## Context limits applied\n${omissionNotes.join('\n')}\n` : ''}
Review the changed files above. Judge correctness (bugs, security, performance, testing, quality) AND whether the changes are architecturally consistent with the rest of this repository, using the architecture summary and relevant files as evidence. Follow every rule in the system prompt.`;
}
