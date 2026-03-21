-- CreateTable
CREATE TABLE "CountryProfile" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "nationName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "advantage" TEXT NOT NULL,
    "disadvantage" TEXT NOT NULL,
    "gdpBase" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "popMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "resourceRichness" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "tradeOpenness" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "industrialBase" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "financialDepth" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "militaryTradition" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "innovationIndex" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "debtTolerance" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sanctionResilience" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "startingInflation" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "startingUnemployment" DOUBLE PRECISION NOT NULL DEFAULT 6.0,
    "startingForex" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "startingMilitary" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "startingCreditRating" TEXT NOT NULL DEFAULT 'A',

    CONSTRAINT "CountryProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CountryProfile_teamId_key" ON "CountryProfile"("teamId");

-- AddForeignKey
ALTER TABLE "CountryProfile" ADD CONSTRAINT "CountryProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
