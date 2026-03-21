import { DiplomaticRelation } from "@prisma/client";

interface TeamState {
  teamId: string;
  gdpGrowth: number;
  gdp: number;
  inflation: number;
  tradeIncome: number;
  currencyIndex: number;
}

interface TeamDecision {
  teamId: string;
  interestRate: number;
  tradePolicy: string;
}

interface CrossCountryDelta {
  teamId: string;
  gdpGrowth: number;
  inflation: number;
  tradeIncome: number;
  currencyIndex: number;
}

export function applyCrossCountryEffects(
  allTeamStates: TeamState[],
  allDecisions: TeamDecision[],
  relations: DiplomaticRelation[]
): CrossCountryDelta[] {
  const deltas: CrossCountryDelta[] = allTeamStates.map((s) => ({
    teamId: s.teamId,
    gdpGrowth: 0,
    inflation: 0,
    tradeIncome: 0,
    currencyIndex: 0,
  }));

  const getDelta = (teamId: string) => deltas.find((d) => d.teamId === teamId)!;
  const getState = (teamId: string) => allTeamStates.find((s) => s.teamId === teamId)!;

  const activeRelations = relations.filter((r) => r.active);

  // 1. Trade deals: both nations GDP +0.5%
  activeRelations
    .filter((r) => r.type === "trade_deal")
    .forEach((r) => {
      getDelta(r.fromTeamId).gdpGrowth += 0.5;
      getDelta(r.toTeamId).gdpGrowth += 0.5;
    });

  // 2. Sanctions: target GDP -1.0%, trade income -30%; sender GDP -0.3%
  activeRelations
    .filter((r) => r.type === "sanctions")
    .forEach((r) => {
      getDelta(r.toTeamId).gdpGrowth -= 1.0;
      const targetState = getState(r.toTeamId);
      getDelta(r.toTeamId).tradeIncome -= targetState.tradeIncome * 0.3;
      getDelta(r.fromTeamId).gdpGrowth -= 0.3;
    });

  // 3. Trade wars: both GDP -0.8%, inflation +0.5%. Larger GDP takes 30% less damage
  activeRelations
    .filter((r) => r.type === "trade_war")
    .forEach((r) => {
      const fromState = getState(r.fromTeamId);
      const toState = getState(r.toTeamId);
      const fromLarger = fromState.gdp >= toState.gdp;

      getDelta(r.fromTeamId).gdpGrowth -= fromLarger ? 0.8 * 0.7 : 0.8;
      getDelta(r.toTeamId).gdpGrowth -= fromLarger ? 0.8 : 0.8 * 0.7;
      getDelta(r.fromTeamId).inflation += 0.5;
      getDelta(r.toTeamId).inflation += 0.5;
    });

  // 4. If 3+ nations have rates below 4%: 30% chance of global bubble burst
  const lowRateCount = allDecisions.filter((d) => d.interestRate < 4).length;
  if (lowRateCount >= 3 && Math.random() < 0.3) {
    deltas.forEach((d) => {
      d.gdpGrowth -= 1.5;
    });
  }

  // 5. If any nation inflation > 10%: currency crashes -15 points
  allTeamStates.forEach((s) => {
    if (s.inflation > 10) {
      getDelta(s.teamId).currencyIndex -= 15;
    }
  });

  // 6. If global avg GDP growth < 1%: recession, all trade income halved
  const avgGrowth =
    allTeamStates.reduce((sum, s) => sum + s.gdpGrowth, 0) / allTeamStates.length;
  if (avgGrowth < 1) {
    deltas.forEach((d) => {
      const state = getState(d.teamId);
      d.tradeIncome -= state.tradeIncome * 0.5;
    });
  }

  // 7. Sanctions collateral: if A sanctions B, and C has trade deal with B, C trade income -15%
  activeRelations
    .filter((r) => r.type === "sanctions")
    .forEach((sanction) => {
      activeRelations
        .filter(
          (r) =>
            r.type === "trade_deal" &&
            (r.fromTeamId === sanction.toTeamId || r.toTeamId === sanction.toTeamId)
        )
        .forEach((deal) => {
          const affectedId =
            deal.fromTeamId === sanction.toTeamId ? deal.toTeamId : deal.fromTeamId;
          if (affectedId !== sanction.fromTeamId) {
            const affectedState = getState(affectedId);
            getDelta(affectedId).tradeIncome -= affectedState.tradeIncome * 0.15;
          }
        });
    });

  return deltas;
}
