-- CreateEnum
CREATE TYPE "GithubCommentTarget" AS ENUM ('pull_request', 'commit');

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "githubCommentId" INTEGER,
ADD COLUMN     "githubCommentPostedAt" TIMESTAMP(3),
ADD COLUMN     "githubCommentTarget" "GithubCommentTarget",
ADD COLUMN     "githubCommentUrl" TEXT;
