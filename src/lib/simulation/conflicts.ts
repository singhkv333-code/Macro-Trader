import { DiplomaticRelation } from "@prisma/client";

interface TeamCombatState {
  teamId: string;
  militaryStrength: number;
  gdpGrowth: number;
  unemployment: number;
  approvalRating: number;
  trustScore: number;
}

interface ConflictResult {
  winnerId: string;
  loserId: string;
  deltas: Record<
    string,
    {
      gdpGrowth: number;
      unemployment: number;
      approvalRating: number;
      trustScore: number;
    }
  >;
}

export function resolveConflicts(
  teamStates: TeamCombatState[],
  relations: DiplomaticRelation[]
): ConflictResult[] {
  const conflicts = relations.filter((r) => r.type === "conflict" && r.active);
  const alliances = relations.filter((r) => r.type === "alliance" && r.active);
  const results: ConflictResult[] = [];

  for (const conflict of conflicts) {
    const attacker = teamStates.find((s) => s.teamId === conflict.fromTeamId);
    const defender = teamStates.find((s) => s.teamId === conflict.toTeamId);
    if (!attacker || !defender) continue;

    // Find allies
    const attackerAllies = alliances
      .filter(
        (a) => a.fromTeamId === attacker.teamId || a.toTeamId === attacker.teamId
      )
      .map((a) =>
        a.fromTeamId === attacker.teamId ? a.toTeamId : a.fromTeamId
      );

    const defenderAllies = alliances
      .filter(
        (a) => a.fromTeamId === defender.teamId || a.toTeamId === defender.teamId
      )
      .map((a) =>
        a.fromTeamId === defender.teamId ? a.toTeamId : a.fromTeamId
      );

    // 70% chance allies honor commitment
    const honoredAttackerAllies = attackerAllies.filter(() => Math.random() < 0.7);
    const honoredDefenderAllies = defenderAllies.filter(() => Math.random() < 0.7);

    let attackerStrength = attacker.militaryStrength;
    let defenderStrength = defender.militaryStrength;

    for (const allyId of honoredAttackerAllies) {
      const ally = teamStates.find((s) => s.teamId === allyId);
      if (ally) attackerStrength += ally.militaryStrength * 0.5;
    }

    for (const allyId of honoredDefenderAllies) {
      const ally = teamStates.find((s) => s.teamId === allyId);
      if (ally) defenderStrength += ally.militaryStrength * 0.5;
    }

    const attackerWins = attackerStrength >= defenderStrength;
    const winnerId = attackerWins ? attacker.teamId : defender.teamId;
    const loserId = attackerWins ? defender.teamId : attacker.teamId;

    const deltas: ConflictResult["deltas"] = {};

    // Both sides take damage during conflict
    deltas[attacker.teamId] = {
      gdpGrowth: -1.0 + (attackerWins ? 1.0 : -2.5),
      unemployment: attackerWins ? 0 : 2.0,
      approvalRating: attackerWins ? 0 : -15,
      trustScore: 0,
    };

    deltas[defender.teamId] = {
      gdpGrowth: -1.0 + (attackerWins ? -2.5 : 1.0),
      unemployment: attackerWins ? 2.0 : 0,
      approvalRating: attackerWins ? -15 : 0,
      trustScore: 0,
    };

    // Trust score changes for allies
    for (const allyId of attackerAllies) {
      if (!deltas[allyId]) {
        deltas[allyId] = { gdpGrowth: 0, unemployment: 0, approvalRating: 0, trustScore: 0 };
      }
      deltas[allyId].trustScore += honoredAttackerAllies.includes(allyId) ? 4 : -6;
    }

    for (const allyId of defenderAllies) {
      if (!deltas[allyId]) {
        deltas[allyId] = { gdpGrowth: 0, unemployment: 0, approvalRating: 0, trustScore: 0 };
      }
      deltas[allyId].trustScore += honoredDefenderAllies.includes(allyId) ? 4 : -6;
    }

    results.push({ winnerId, loserId, deltas });
  }

  return results;
}
