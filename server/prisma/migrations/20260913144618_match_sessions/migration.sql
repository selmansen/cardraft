-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('OPEN', 'SETTLED', 'REJECTED');

-- CreateTable
CREATE TABLE "match_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'OPEN',
    "seed" TEXT NOT NULL,
    "playerLoadout" JSONB NOT NULL,
    "playerSupportLoadout" JSONB NOT NULL,
    "botLoadout" JSONB NOT NULL,
    "botSupportLoadout" JSONB NOT NULL,
    "difficulty" TEXT NOT NULL,
    "won" BOOLEAN,
    "turns" INTEGER,
    "actionCount" INTEGER,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "match_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_sessions_userId_createdAt_idx" ON "match_sessions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "match_sessions_status_idx" ON "match_sessions"("status");
