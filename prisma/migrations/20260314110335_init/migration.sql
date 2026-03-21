-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "flagEmoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "phase" TEXT NOT NULL DEFAULT 'waiting',
    "globalEvent" TEXT,
    "oilPriceIndex" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "isLeaderboardVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL,
    "infraSpending" DOUBLE PRECISION NOT NULL,
    "subsidySpending" DOUBLE PRECISION NOT NULL,
    "defenseSpending" DOUBLE PRECISION NOT NULL,
    "borrowing" DOUBLE PRECISION NOT NULL,
    "tradePolicy" TEXT NOT NULL,
    "diplomaticAction" TEXT NOT NULL,
    "diplomaticTarget" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundState" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "gdpGrowth" DOUBLE PRECISION NOT NULL,
    "gdp" DOUBLE PRECISION NOT NULL,
    "inflation" DOUBLE PRECISION NOT NULL,
    "unemployment" DOUBLE PRECISION NOT NULL,
    "fiscalDeficit" DOUBLE PRECISION NOT NULL,
    "currencyIndex" DOUBLE PRECISION NOT NULL,
    "forexReserves" DOUBLE PRECISION NOT NULL,
    "militaryStrength" DOUBLE PRECISION NOT NULL,
    "approvalRating" DOUBLE PRECISION NOT NULL,
    "tradeIncome" DOUBLE PRECISION NOT NULL,
    "taxRevenue" DOUBLE PRECISION NOT NULL,
    "creditRating" TEXT NOT NULL,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 80,

    CONSTRAINT "RoundState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiplomaticRelation" (
    "id" TEXT NOT NULL,
    "fromTeamId" TEXT NOT NULL,
    "toTeamId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiplomaticRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsEvent" (
    "id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "headline" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_teamId_round_key" ON "Decision"("teamId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "RoundState_teamId_round_key" ON "RoundState"("teamId", "round");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundState" ADD CONSTRAINT "RoundState_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
