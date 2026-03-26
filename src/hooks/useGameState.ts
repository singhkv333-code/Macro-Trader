"use client";

import { useState, useEffect, useCallback } from "react";

interface GameState {
  id: string;
  currentRound: number;
  phase: string;
  globalEvent: string | null;
  oilPriceIndex: number;
  isLeaderboardVisible: boolean;
}

interface TeamData {
  id: string;
  name: string;
  color: string;
  flagEmoji: string;
  isActive: boolean;
  roundStates: RoundState[];
  decisions: DecisionData[];
}

interface RoundState {
  id: string;
  teamId: string;
  round: number;
  gdpGrowth: number;
  gdp: number;
  inflation: number;
  unemployment: number;
  fiscalDeficit: number;
  currencyIndex: number;
  forexReserves: number;
  militaryStrength: number;
  approvalRating: number;
  tradeIncome: number;
  taxRevenue: number;
  creditRating: string;
  trustScore: number;
}

interface NewsEvent {
  id: string;
  round: number;
  headline: string;
  type: string;
  createdAt: string;
}

interface DiplomaticRelation {
  id: string;
  fromTeamId: string;
  toTeamId: string;
  type: string;
  round: number;
  active: boolean;
}

interface DecisionData {
  id: string;
  round: number;
  tradeOpenness: number;
  diplomaticAction: string;
  diplomaticTarget: string | null;
  usePowerUp: boolean;
  submittedAt: string;
}

interface TeamScore {
  teamId: string;
  total: number;
  breakdown: Record<string, number>;
}

export function useGameState(pollInterval = 5000) {
  const [game, setGame] = useState<GameState | null>(null);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [news, setNews] = useState<NewsEvent[]>([]);
  const [relations, setRelations] = useState<DiplomaticRelation[]>([]);
  const [scores, setScores] = useState<TeamScore[]>([]);
  const [previousScores, setPreviousScores] = useState<TeamScore[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/game/state");
      if (res.ok) {
        const data = await res.json();
        setGame(data.game);
        setTeams(data.teams);
        setNews(data.news);
        setRelations(data.relations);
        setScores(data.scores ?? []);
        setPreviousScores(data.previousScores ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch game state:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, pollInterval);
    return () => clearInterval(interval);
  }, [fetchState, pollInterval]);

  return { game, teams, news, relations, scores, previousScores, loading, refetch: fetchState };
}

export type {
  DecisionData,
  DiplomaticRelation,
  GameState,
  NewsEvent,
  RoundState,
  TeamData,
  TeamScore,
};
