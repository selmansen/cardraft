-- CreateEnum
CREATE TYPE "CardKind" AS ENUM ('VEHICLE', 'SUPPORT');

-- CreateEnum
CREATE TYPE "AcquisitionSource" AS ENUM ('STARTER', 'PURCHASE', 'PACK', 'REWARD');

-- CreateTable
CREATE TABLE "owned_cards" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cardId" TEXT NOT NULL,
    "kind" "CardKind" NOT NULL,
    "source" "AcquisitionSource" NOT NULL DEFAULT 'PURCHASE',
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owned_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owned_cards_userId_kind_idx" ON "owned_cards"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "owned_cards_userId_cardId_key" ON "owned_cards"("userId", "cardId");

-- AddForeignKey
ALTER TABLE "owned_cards" ADD CONSTRAINT "owned_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
