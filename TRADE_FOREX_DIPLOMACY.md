# Macro Trader — Trade, Forex & Diplomacy System Guide

> This document is a complete reference for how the export/import market, currency (forex), and diplomacy systems work in Macro Trader. It covers both what the **theory promises** and what **actually happens** in the code, including all edge cases and gaps.

---

## Table of Contents

1. [Overview — Computation Order Per Round](#1-overview--computation-order-per-round)
2. [Commodities — The 6 Tradeable Goods](#2-commodities--the-6-tradeable-goods)
3. [Trade Orders — How Teams Export and Import](#3-trade-orders--how-teams-export-and-import)
4. [World Market Pricing — How Prices Are Set](#4-world-market-pricing--how-prices-are-set)
5. [Trade Income — How Money Is Calculated](#5-trade-income--how-money-is-calculated)
6. [Trade Balance — What It Actually Measures](#6-trade-balance--what-it-actually-measures)
7. [How Trade Affects GDP](#7-how-trade-affects-gdp)
8. [How Trade Affects Inflation (Import Pass-Through)](#8-how-trade-affects-inflation-import-pass-through)
9. [Forex (Currency Index) — The Full System](#9-forex-currency-index--the-full-system)
10. [Forex Reserves — The Simpler Cousin](#10-forex-reserves--the-simpler-cousin)
11. [Round 1 Exception — Trade Is Disabled](#11-round-1-exception--trade-is-disabled)
12. [Diplomacy — All 5 Actions](#12-diplomacy--all-5-actions)
13. [Trade Deals — Theory vs Reality](#13-trade-deals--theory-vs-reality)
14. [Alliances — Theory vs Reality](#14-alliances--theory-vs-reality)
15. [Sanctions — Theory vs Reality](#15-sanctions--theory-vs-reality)
16. [Trade Wars — Theory vs Reality](#16-trade-wars--theory-vs-reality)
17. [Conflicts (Military) — Theory vs Reality](#17-conflicts-military--theory-vs-reality)
18. [Diplomacy Score — How It's Built Up](#18-diplomacy-score--how-its-built-up)
19. [Cross-Country Spillovers — Global Effects](#19-cross-country-spillovers--global-effects)
20. [How Diplomacy Affects Scoring](#20-how-diplomacy-affects-scoring)
21. [Full Scoring Breakdown](#21-full-scoring-breakdown)
22. [Country Resource Profiles](#22-country-resource-profiles)
23. [Key Numbers at a Glance](#23-key-numbers-at-a-glance)

---

## 1. Overview — Computation Order Per Round

Every round simulation runs in this strict order:

```
1.  Process diplomatic actions → create DiplomaticRelation rows in DB
2.  World Market Pricing → set commodity prices from aggregate supply/demand
3.  Trade Matching → compute each team's trade income and trade balance
4.  Fiscal Engine → revenue, debt service, available budget
5.  GDP Engine (Cobb-Douglas) → includes trade contribution
6.  Inflation Engine (Phillips Curve) → includes import pass-through
7.  Forex Engine → currency index delta
8.  Approval Engine → composite rating
9.  Cross-country effects → trade deal bonuses, sanctions damage, trade war damage, systemic risks
10. Conflict resolution → military outcomes, ally honor checks
11. Round scenario effects → Oil Shock (+2% inflation in R3), Endgame 1.5× multiplier in R4
12. Global event effects → oil crisis, pandemic, currency crisis (admin-triggered)
13. Clamp all values to defined ranges
14. Update credit ratings
15. Batch-write all round states to DB
```

---

## 2. Commodities — The 6 Tradeable Goods

| Commodity | Base Price ($/unit) | Label |
|-----------|--------------------:|-------|
| Oil | 100 | Oil & Gas |
| Metals | 80 | Metals & Minerals |
| Food | 60 | Food & Agriculture |
| Semiconductors | 150 | Semiconductors |
| Pharmaceuticals | 120 | Pharmaceuticals |
| Textiles | 40 | Textiles & Consumer Goods |

Each country has a **production** number and a **consumption** number for all 6. The net (production − consumption) determines whether they are a natural **exporter** (net > 0) or **importer** (net < 0) of that commodity.

Teams choose how many units to actually export or import each round (0–15 units each). Their natural endowment sets the strategic backdrop but does not force them to trade — a natural oil exporter can choose to not export.

---

## 3. Trade Orders — How Teams Export and Import

Teams submit trade orders during the **decision phase** (Round 2 onwards). Rules:

- Each commodity can have **one export order** and **one import order** per team per round
- Quantities range from **0 to 15 units**
- Export and import orders for the same commodity from the same team are allowed simultaneously (e.g., you can export 5 units of oil while also importing 3 units of food)
- Orders are stored with a composite unique key: `(teamId, round, commodity, direction)` — submitting again overwrites the previous order

**In Round 1**, trade is fully disabled. No orders are taken. Instead, the engine auto-computes a "natural trade" using each country's surplus production (max(0, production − consumption)) as implicit exports, and uses base prices. This gives every country their starting trade income without requiring orders.

---

## 4. World Market Pricing — How Prices Are Set

```
World_Price[commodity] = Base_Price[commodity] × (Total_Demand / Total_Supply) ^ 0.3
```

- `Total_Demand` = sum of all import orders for that commodity across all teams
- `Total_Supply` = sum of all export orders for that commodity across all teams
- The **0.3 exponent** dampens extreme price swings — prices never go fully crazy from one imbalanced round
- If `Total_Supply = 0` (nobody exports), price doubles: `Base_Price × 2` (scarcity premium)
- If `Total_Demand = 0` (nobody imports), the ratio is very low and price falls, but the dampening keeps it reasonable

**Example:** Oil base price = 100. If 3 teams export 10 units each (supply=30) and 6 teams import 5 units each (demand=30), ratio = 1.0, price = 100. If demand spikes to 50 (ratio=1.67), price = 100 × 1.67^0.3 ≈ 115. If supply collapses to 5 (ratio=10), price = 100 × 10^0.3 ≈ 200.

Prices are stored in the `TradeTransaction` table each round.

---

## 5. Trade Income — How Money Is Calculated

```
Trade_Income = Σ (export_qty × world_price) − Σ (import_qty × world_price)
```

This is the **net trade cashflow** in billions. Positive = net exporter (earns money). Negative = net importer (spends money).

Trade income feeds into the **fiscal budget**:

```
Total_Inflow = Revenue + Trade_Income (clamped to ≥0) + Borrowing
```

So a country with negative trade income does NOT get a fiscal boost from trade — the `Math.max(0, tradeIncome)` clamp prevents negative trade from reducing the budget directly (that effect shows via the deficit calculation instead).

---

## 6. Trade Balance — What It Actually Measures

The **trade balance** stored in `RoundState` is slightly different from trade income:

```
Trade_Balance = Σ (export_qty × world_price) − Σ (import_qty × world_price)
```

It looks identical to trade income but is used differently downstream:

- **Trade income** flows into the fiscal budget
- **Trade balance** feeds into: GDP (via net exports), Forex (via trade effect), Approval, and Scoring

The trade balance is measured in the same units as trade income (billions $). A positive balance = surplus = you export more value than you import. This is the number displayed on the dashboard under "Trade Balance."

---

## 7. How Trade Affects GDP

Trade enters GDP through the **Cobb-Douglas production function**:

```
GDP_Growth = Production + Trade_Effect + Rate_Effect − Tax_Drag − Debt_Penalty − Resource_Penalty
```

**Trade_Effect:**
```
Trade_Effect = β_n × (Trade_Balance / GDP) × 4.0
```

Where `β_n` is the country's **trade multiplier** (from its country profile). Countries with high β_n benefit much more from trade surpluses:

| Country | Trade Multiplier (β_n) |
|---------|----------------------:|
| China | 2.10 |
| Germany | 2.25 |
| South Korea | 2.175 |
| Mexico | 1.95 |
| Japan | 1.80 |
| Australia | 1.80 |
| India | 1.35 |
| United States | 1.05 |

Germany and South Korea get the most out of a trade surplus. The US barely benefits from trade relative to its domestic production.

**Resource Penalty:**
```
Resource_Penalty = max(0, 5 − Total_Import_Units) × 0.1%
```

If you import fewer than 5 total units across all commodities in a round, you take a GDP penalty of 0.1% per unit below 5. At zero imports, this is −0.5% GDP. This prevents countries from ignoring trade entirely in Rounds 2–4.

---

## 8. How Trade Affects Inflation (Import Pass-Through)

Imports drive import inflation through a 10% pass-through rate:

```
Import_Fraction = Total_Import_Units / (GDP × 0.01)
Import_Inflation = 10% × Import_Price_Change
```

This is relatively small and only activates when import prices change significantly (which depends on world price movements). In practice this effect is modest unless many teams are competing to import the same scarce commodity.

The **full inflation formula** is:

```
π = 0.6 × π_prev + 0.4 × 2.0
  + 0.25 × (gdpGrowth − potentialGrowth)
  − 1.5 × μ_n × (r − rNeutral) / (1 + 0.2 × debtRatio)
  + 0.10 × importPriceChange
```

Clamped to: `max(−1.0, π)`

---

## 9. Forex (Currency Index) — The Full System

The **currency index** starts at 100 for all countries. It moves each round by a delta (dFX):

```
dFX = χ × (r − r_world_avg)
    − ψ × (π − π_world_avg)
    + θ × (trade_balance / GDP_norm)
    − κ × capital_outflow_risk
```

Where the constants are:
- **χ = 0.6** — interest rate differential coefficient
- **ψ = 0.4** — inflation differential coefficient
- **θ = 0.3** — trade balance coefficient
- **κ = 5** per unit of capital_outflow_risk

Breaking down each term:

### Interest Rate Differential (χ)
```
= 0.6 × (your_rate − world_average_rate)
```
If you raise rates above the global average, capital flows in and your currency strengthens. If you cut rates below average, capital leaves and currency weakens. The world average is the mean of all teams' interest rates this round.

**Example:** You set 8% when world avg is 5%. dFX from this term = 0.6 × 3 = +1.8 points.

### Inflation Differential (ψ)
```
= −0.4 × (your_inflation − world_average_inflation)
```
If your inflation is above the global average, purchasing power erodes and currency weakens. The effect is subtracted.

**Example:** You have 10% inflation, world avg is 4%. dFX from this term = −0.4 × 6 = −2.4 points.

### Trade Balance Effect (θ)
```
= 0.3 × (trade_balance / max(GDP × 0.01, 1))
```
A trade surplus (positive balance) strengthens your currency. A deficit weakens it.

### Capital Outflow Risk (Sanctions)
```
= −5 × capital_outflow_risk
```
If you are **under sanctions** from any other country, `capital_outflow_risk = 0.5`, so you lose **−2.5 points** on your currency index from this term alone, every round those sanctions remain active.

### Forex Reserves — The Simpler Mechanic
Forex reserves are updated with a simple threshold rule each round:

```
if currencyIndex > 100: forexReserves += 5
if currencyIndex < 80:  forexReserves -= 10
else:                   forexReserves unchanged
```

No formula — it's a binary trigger. Currency strength above baseline builds reserves slowly (+5/round). Severe weakness (below 80) depletes reserves fast (−10/round). This can drain a country into a forex crisis if their currency collapses.

### Currency Index Clamps
```
min: 40    max: 160
```

### What happens in crossCountry.ts (additional forex effects):
- If a country's inflation exceeds 10%: immediate **−15 points** to their currency index (in addition to the regular formula)

---

## 10. Forex Reserves — The Simpler Cousin

Forex reserves are tracked separately from the currency index. They represent the stockpile of foreign currency. Rules:

- Start at each country's `startingForex` value (ranges from $80B for Nigeria to $400B for the US)
- Gain **+5B per round** when currency index > 100
- Lose **−10B per round** when currency index < 80
- No change when currency index is between 80–100
- Clamped to: `min=0, max=500`

**Special country power-ups that affect forex:**
- Switzerland: +40 reserves when Swiss Banking Secrecy power-up is used
- UK: +50 reserves when City of London power-up is used

Forex reserves do NOT feed back into GDP or inflation in the current engine — they are a display/score metric only.

---

## 11. Round 1 Exception — Trade Is Disabled

Round 1 (`Foundation`) has `tradeEnabled: false`. This means:

- No export/import orders are accepted or processed
- World Market Pricing does not run
- Instead, each country's natural resource surplus (production − consumption for each commodity) is used as implicit exports at **base prices** (not market prices)
- `myImports` is an empty object `{}`
- A dummy `{_baseline: 5}` is passed to the GDP formula to avoid the resource penalty hitting everyone in Round 1

This means in Round 1, trade balance reflects your country's natural endowment at fixed base prices. It is purely informational and doesn't represent active decisions.

---

## 12. Diplomacy — All 5 Actions

Every round (from Round 2 onwards), each team can choose **one diplomatic action** targeting one other nation:

| Action | Available From | Category |
|--------|---------------|----------|
| None | Always | Neutral |
| Trade Deal | Round 2 | Cooperative |
| Alliance | Round 2 | Cooperative |
| Sanctions | Round 3 | Aggressive |
| Trade War | Round 3 | Aggressive |
| Military Conflict | Round 3 | Aggressive |

Actions are stored as `DiplomaticRelation` rows in the DB. They are **permanent and cumulative** — once a trade deal exists, it continues to apply every subsequent round. New actions in later rounds stack on top of old ones.

There is currently **no mechanism to cancel or remove** a diplomatic relation once created. No "peace treaty" or "end sanctions" action exists in the code.

---

## 13. Trade Deals — Theory vs Reality

**Theory:** Both nations benefit from increased trade, with each gaining GDP growth.

**What actually happens:**

1. When Team A declares a trade deal with Team B, a `DiplomaticRelation` row is created with `type = "trade_deal"`, `fromTeamId = A`, `toTeamId = B`

2. In `crossCountry.ts`, every active trade deal gives **both nations +0.5% GDP growth**:
   ```
   Trade deal active → from_team: +0.5% GDP growth
                     → to_team:   +0.5% GDP growth
   ```

3. This applies **every round** the relation remains active. A deal formed in Round 2 gives +0.5% in R2, +0.5% in R3, +0.5% in R4 — **cumulative advantage** that compounds.

4. In the `calculateDiplomacyDelta` function, each new trade deal formed this round also gives the initiating team **+2 diplomacy score points**.

5. If Team B is later sanctioned by Team C, and Team A has a trade deal with Team B, Team A loses **−15% of their trade income** as collateral damage.

**Gap between theory and reality:** The theory says trade deals enhance the bilateral trade volume and commodity flows. In reality, the actual commodity exports/imports are separate from the diplomatic action — the deal just adds a flat +0.5% GDP bonus. Teams can have a trade deal AND still trade zero commodities with each other. These are two independent systems.

---

## 14. Alliances — Theory vs Reality

**Theory:** Military alliances provide mutual defense, deterrence, and diplomatic standing.

**What actually happens:**

1. Alliance creates a `DiplomaticRelation` row with `type = "alliance"`

2. In `calculateDiplomacyDelta`, forming an alliance gives the initiating team **+3 diplomacy score points**

3. The alliance has **no effect** on GDP, inflation, or trade — it only matters in the conflict resolution system

4. When a conflict occurs, allies of the attacker and defender are looked up:
   - Each ally has a **70% random chance** of honoring the alliance
   - If honored: ally contributes **50% of their military strength** to the side they support
   - If NOT honored: ally loses **−6 trust score points**
   - If honored: ally gains **+4 trust score points**

5. Trust score is tracked in `RoundState` but does not currently feed into scoring or approval (it's a display metric)

**Gap:** The theory implies alliances provide deterrence (less likely to be attacked). In the engine, there is no deterrence mechanic. Any team can still initiate a conflict against any other team regardless of their alliances. The alliance only activates during conflict resolution and only with 70% probability.

---

## 15. Sanctions — Theory vs Reality

**Theory:** Sanctions isolate a target economically, hurting their trade and investment while the sender signals disapproval.

**What actually happens:**

The sanctions effect is split across two systems:

**Immediate forex effect (engine.ts, step 7):**
```
If any active sanctions target you → capital_outflow_risk = 0.5
→ Currency Index delta: −0.5 × 5 = −2.5 points per round
```
This is the only per-team sanctions effect calculated during the main simulation loop.

**Cross-country batch effects (crossCountry.ts, applied after all teams run):**
```
Target receives:
  → GDP growth: −1.0%
  → Trade income: −30%

Sender pays:
  → GDP growth: −0.3%
```

**Collateral effect:**
```
Any team with a trade deal to the sanctions target:
  → Trade income: −15%
```

**How they accumulate:** Sanctions are permanent once created. A country sanctioned in Round 3 suffers all these penalties in Round 3 AND Round 4 (both rounds). Multiple countries can sanction the same target — each additional sanctioner adds another round of −1.0% GDP, −30% trade income, −2.5 currency index.

**Gap:** There is no "sanctions lifted" mechanism. The initiating team also takes a −4 diplomacy score penalty when they initiate sanctions (`calculateDiplomacyDelta`). The theory suggests sanctions could coerce behavior changes, but the engine has no conditional mechanism for this — once imposed, effects run permanently.

---

## 16. Trade Wars — Theory vs Reality

**Theory:** Trade wars hurt both sides through tariffs and retaliation, with larger economies absorbing the damage better.

**What actually happens (crossCountry.ts):**

```
Both nations: GDP growth −0.8%, Inflation +0.5%

Exception: the larger-GDP nation takes 30% less GDP damage:
  Larger economy: −0.8 × 0.7 = −0.56% GDP
  Smaller economy: −0.8% GDP
```

This applies **every round** the trade war relation remains active. A trade war declared in Round 2 that persists to Round 4 costs both sides 3× the above amounts total.

The trade war also does NOT block actual commodity trade orders. Teams in a trade war can still export and import from each other freely — the war is just a debuff, not a trade embargo.

**Gap:** The theory implies trade wars redirect supply chains and change commodity flows. In reality, it is a flat GDP/inflation penalty that has no interaction with the actual trade order system.

---

## 17. Conflicts (Military) — Theory vs Reality

**Theory:** Military conflicts determine which nation "wins" geopolitically, with victors gaining influence and losers suffering economic damage.

**What actually happens:**

Conflict resolution runs in `conflicts.ts` after all other simulation steps:

**Step 1 — Determine strength:**
```
Attacker strength = attacker.militaryStrength
                  + Σ (honored_attacker_ally.militaryStrength × 0.5)

Defender strength = defender.militaryStrength
                  + Σ (honored_defender_ally.militaryStrength × 0.5)

Each ally: 70% random chance of honoring commitment
```

**Step 2 — Determine winner:**
```
if attacker_strength >= defender_strength → Attacker wins
else → Defender wins
```

**Step 3 — Apply deltas:**

For the **attacker** (if they win):
```
GDP growth: −1.0 + 1.0 = 0.0% (net zero GDP effect)
Unemployment: 0
Approval: 0
```

For the **attacker** (if they lose):
```
GDP growth: −1.0 + (−2.5) = −3.5%
Unemployment: +2.0%
Approval: −15
```

For the **defender** (if attacker wins — defender loses):
```
GDP growth: −1.0 + (−2.5) = −3.5%
Unemployment: +2.0%
Approval: −15
```

For the **defender** (if defender wins):
```
GDP growth: −1.0 + 1.0 = 0.0%
Unemployment: 0
Approval: 0
```

For **allies** that honored their commitment: `TrustScore +4`
For **allies** that broke their commitment: `TrustScore −6`

**Credit rating:** Losing a conflict causes a **+1 step downgrade** to credit rating (e.g., A → BBB).

**Available from:** Round 3 only (`conflictsEnabled: true`)

**Gap:** The theory suggests conflicts have long-lasting geopolitical consequences. In the engine, conflicts only apply their deltas for the round they are resolved. There is no ongoing occupation penalty, war reparations, or forced economic restructuring. A country that loses a conflict in Round 3 starts Round 4 fresh (aside from the credit rating downgrade and any accumulated debt from the damage).

---

## 18. Diplomacy Score — How It's Built Up

The diplomacy score is a **running total** that accumulates across rounds.

**Per-round additions (calculateDiplomacyDelta):**
```
New trade deal formed:      +2 points
New alliance formed:        +3 points
Sanctions initiated:        −4 points
Alliance broken:            −8 points (currently not triggered in engine)
```

Note: Only **new** actions in the current round give diplomacy points (existing relations from previous rounds do not add points again). The score accumulates over the game.

**Example path:**
- Round 2: Form 2 trade deals → +4, form 1 alliance → +3. Score: +7
- Round 3: Impose sanctions on 1 country → −4. Score: +3
- Round 4: Form 1 more deal → +2. Final score: +5

---

## 19. Cross-Country Spillovers — Global Effects

These effects apply to ALL teams simultaneously after individual simulations complete:

### 1. Trade Deal Bonus (applies every round)
Every active trade deal: both parties get **+0.5% GDP growth**

### 2. Sanctions Damage
Target: **−1.0% GDP, −30% trade income**
Sender: **−0.3% GDP**

### 3. Trade War Damage
Both parties: **−0.8% GDP** (larger GDP side: −0.56%), **+0.5% inflation**

### 4. Low Interest Rate Bubble (systemic risk)
**Condition:** 3 or more nations have interest rate < 4%
**Effect:** 30% random chance → ALL nations lose **−1.5% GDP**

This is the only random/probabilistic effect in the entire engine. It simulates a global credit bubble and sudden unwinding. The randomness makes it unpredictable — three low-rate countries is enough to trigger it.

### 5. Hyperinflation Currency Crash
**Condition:** Any nation's inflation > 10%
**Effect:** That nation's currency index immediately loses **−15 points**

This is on top of the regular forex formula calculation.

### 6. Global Recession Contagion
**Condition:** Average GDP growth across all teams < 1%
**Effect:** ALL nations lose **50% of their trade income**

This is a devastating feedback loop: if enough teams run bad economic policies simultaneously, it can trigger this and halve everyone's trade earnings in the same round.

### 7. Sanctions Collateral
**Condition:** Country A sanctions Country B, Country C has a trade deal with Country B
**Effect:** Country C loses **15% of their trade income**

Being allied with a sanctioned nation costs you directly.

---

## 20. How Diplomacy Affects Scoring

Diplomacy feeds into scoring in two ways:

### Direct Score (15 points)
The `diplomaticScore` component compares teams relatively:

```
Best diplomat gets: 15 points
Worst diplomat gets: 15 × 20% = 3 points (floor)
Others: linear interpolation between 3 and 15
```

The **final** diplomacy score (from the last completed round) is used — not a cumulative average.

### Via Trade Balance Score (20 points)
The trade/forex score is:
```
tradeScore = −avgCurrencyDeviation × 0.6 + avgTradeBalance × 0.4
```

Trade deals improve trade income (via the flat +0.5% GDP that grows your economy, which grows your taxable base, which grows your budget). But they don't directly change your `tradeBalance` number — only your commodity orders do that.

### Approval Rating (display only, not scored directly)
The approval formula includes diplomacy:
```
Diplomacy_Component = 10 × min(1, diplomacyScore / 50)
```

Full diplomacy contribution to approval: 10 points out of 100. To get full marks here you need a diplomacy score ≥ 50 (which requires ~25 trade deals or a mix of deals/alliances over 4 rounds — effectively impossible for most teams).

---

## 21. Full Scoring Breakdown

Total: **100 points** across all completed rounds.

| Component | Weight | What's Measured | Method |
|-----------|-------:|----------------|--------|
| Cumulative GDP Growth | 25 pts | Sum of all GDP growth % across rounds | Relative ranking |
| Inflation Stability | 25 pts | How close to 2–4% range each round | Absolute (2–4% = max 25) |
| Fiscal Discipline | 15 pts | Average deficit % of GDP | Relative ranking (lower = better) |
| Trade & Forex | 20 pts | 60% currency stability + 40% trade balance average | Relative ranking |
| Diplomacy Grade | 15 pts | Final round diplomacy score | Relative ranking |

**Inflation scoring detail:**
- 2–4%: Full 25 points
- Distance 0–2 from range: −2.0 per point of distance
- Distance 2–6 from range: −2.5 per point
- Distance >6 from range: −1.5 per point
- Floor: 5 points minimum

**Relative ranking detail (for GDP, Fiscal, Trade, Diplomacy):**
- Best team: full points
- Worst team: 20% of full points (floor)
- Others: linearly interpolated

---

## 22. Country Resource Profiles

Net trade positions (production minus consumption). Positive = natural exporter, Negative = natural importer.

| Country | Oil | Metals | Food | Semis | Pharma | Textiles |
|---------|----:|-------:|-----:|------:|-------:|---------:|
| India | −5 | +1 | +1 | −4 | +2 | +2 |
| USA | +1 | −2 | +3 | −2 | +1 | −5 |
| China | −5 | −1 | −2 | −4 | 0 | +5 |
| Germany | −5 | −4 | +1 | −1 | +4 | −1 |
| Japan | −5 | −5 | −1 | +2 | +2 | −2 |
| Brazil | +2 | +5 | +4 | −3 | −2 | −2 |
| UK | −2 | −3 | −1 | −2 | +4 | −2 |
| Russia | +6 | +3 | +1 | −4 | −3 | −4 |
| South Korea | −5 | −5 | −1 | +6 | +1 | −1 |
| Saudi Arabia | +7 | −1 | −3 | −2 | −2 | −2 |
| Nigeria | +4 | +1 | −3 | −2 | −3 | −3 |
| Australia | +2 | +7 | +6 | −1 | +2 | −1 |
| Turkey | −5 | 0 | +1 | −2 | −1 | +3 |
| Switzerland | −2 | −1 | +1 | +1 | +8 | +1 |
| Mexico | +1 | +1 | −1 | −2 | −2 | +2 |

**Key supply/demand dynamics:**
- **Oil sellers:** Russia (+6), Saudi Arabia (+7), Nigeria (+4) — these countries profit enormously when many teams need to import oil
- **Oil buyers:** China, Germany, Japan, India, South Korea, Turkey all need −5 oil — enormous import demand for oil
- **Semiconductor sellers:** South Korea (+6) is the dominant supplier — the world's chip hub. If Korea exports aggressively, semiconductor prices drop; if Korea withholds, prices skyrocket
- **Food sellers:** Brazil (+4), Australia (+6), USA (+3) — they benefit when food demand is high
- **Pharma:** Switzerland (+8), UK (+4), Germany (+4) — major pharma exporters

---

## 23. Key Numbers at a Glance

| Parameter | Value | Notes |
|-----------|------:|-------|
| Commodity price exponent | 0.3 | Dampens price swings |
| Trade deal GDP bonus | +0.5% | Per deal per round, both sides |
| Sanctions GDP penalty (target) | −1.0% | Per sanction per round |
| Sanctions trade penalty (target) | −30% | Of trade income |
| Sanctions GDP cost (sender) | −0.3% | You also suffer |
| Collateral trade loss | −15% | If your deal partner is sanctioned |
| Trade war GDP penalty | −0.8% | (larger GDP: −0.56%) |
| Trade war inflation | +0.5% | Both sides |
| Conflict GDP (loser) | −3.5% | Combined loss |
| Conflict GDP (winner) | 0.0% | Effectively neutral |
| Currency loss under sanctions | −2.5 pts | Per round |
| Hyperinflation currency crash | −15 pts | Inflation > 10% |
| Low rate bubble risk | 30% chance | If 3+ nations below 4% |
| Global recession trigger | avg < 1% | Halves all trade income |
| Forex reserves gain | +5B | If currency > 100 |
| Forex reserves loss | −10B | If currency < 80 |
| Interest rate coefficient (χ) | 0.6 | On forex |
| Inflation coefficient (ψ) | 0.4 | On forex |
| Trade balance coefficient (θ) | 0.3 | On forex |
| Diplomacy: trade deal | +2 | Score points |
| Diplomacy: alliance | +3 | Score points |
| Diplomacy: sanctions | −4 | Score points |
| Ally military contribution | 50% | Of ally's military strength |
| Ally honor rate | 70% | Random per conflict |
| Alliance broken trust penalty | −6 | Trust score |
| Alliance honored trust bonus | +4 | Trust score |
| Resource import floor | 5 units | Below this → 0.1% GDP penalty each |
| GDP inertia smoothing | 30% | Previous round carries forward |
| Inflation anchoring | 60%/40% | 60% inertia + 40% target pull |
| Inflation floor | −1.0% | Mild deflation is permitted |
| Currency index min/max | 40 / 160 | Hard clamps |
| GDP growth min/max | −5% / +10% | Hard clamps |
| Inflation min/max | 0% / 20% | Hard clamps |
