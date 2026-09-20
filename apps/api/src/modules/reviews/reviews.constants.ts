/** The SHA git (and GitHub) recognize for the empty tree — comparing against it yields every file on a branch as "added", letting a whole branch be reviewed with no base branch. */
export const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

/** Stored as `Review.baseBranch` for whole-branch reviews, which have no real base branch. */
export const WHOLE_BRANCH_BASE_LABEL = '(entire branch — no base)';
