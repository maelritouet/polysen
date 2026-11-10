import { newPool, quoteBuy, quoteSell, type Side } from "./amm";
import {
  balanceOf,
  canSpend,
  CREATOR_BONUS,
  dailyDropAmount,
  isTradingReason,
  MARKET_SEED,
  STARTING_GRANT,
  type LedgerEntry,
} from "./ledger";
import { D, type Coins, type Dec } from "./money";
import { cancelRefunds, resolvePayouts, type MarketBook, type Position, type Transfer } from "./settlement";

/**
 * An in-memory stand-in for the server, used by the property tests.
 * It applies the same core rules the real server functions will, with the
 * same all-or-nothing behaviour: an action either fully happens or throws
 * and changes nothing.
 */

type Status = "open" | "resolved" | "cancelled";

interface SimMarket {
  book: MarketBook;
  status: Status;
}

/** A resolution as it happened: the book just before, and what was paid. */
export interface ResolutionRecord {
  marketId: string;
  outcome: Side;
  before: MarketBook;
  transfers: Transfer[];
}

export class Simulation {
  private readonly ledger: LedgerEntry[] = [];
  private readonly markets = new Map<string, SimMarket>();
  private readonly dropClaimed = new Set<string>();
  private readonly resolutionLog: ResolutionRecord[] = [];
  private minted = 0n;

  /** `grant` can be lowered in tests so players run out of coins more often. */
  constructor(players: readonly string[], grant: Coins = STARTING_GRANT) {
    for (const p of players) this.mint({ memberId: p, amount: grant, reason: "grant" });
  }

  // ---- reads ----

  balance(memberId: string): Coins {
    return balanceOf(this.ledger, memberId);
  }

  marketIds(): string[] {
    return [...this.markets.keys()];
  }

  openMarketIds(): string[] {
    return this.marketIds().filter((id) => this.market(id).status === "open");
  }

  settledMarketIds(): string[] {
    return this.marketIds().filter((id) => this.market(id).status !== "open");
  }

  book(marketId: string): MarketBook {
    return this.market(marketId).book;
  }

  sharesHeld(memberId: string, marketId: string, side: Side): Dec {
    const p = this.market(marketId).book.positions.get(memberId);
    if (!p) return D(0);
    return side === "YES" ? p.yes : p.no;
  }

  resolutions(): readonly ResolutionRecord[] {
    return this.resolutionLog;
  }

  /** Coins created so far: grants, drops and creator bonuses. */
  totalMinted(): Coins {
    return this.minted;
  }

  /** Sum of a market's own rows (seed, trades, settlement). Bonuses are minted, so excluded. */
  marketNet(marketId: string): Coins {
    let total = 0n;
    for (const e of this.ledger) {
      if (e.marketId === marketId && e.reason !== "creator_bonus") total += e.amount;
    }
    return total;
  }

  /** What all players, as traders, got out of a market minus what they put in. */
  playersNetFromMarket(marketId: string): Coins {
    let total = 0n;
    for (const e of this.ledger) {
      if (e.marketId === marketId && isTradingReason(e.reason)) total += e.amount;
    }
    return total;
  }

  // ---- actions ----

  createMarket(creatorId: string): string {
    if (!canSpend(this.balance(creatorId), MARKET_SEED)) throw new Error("Not enough coins to launch a market");
    const id = `m${this.markets.size + 1}`;
    this.markets.set(id, {
      status: "open",
      book: { pool: newPool(MARKET_SEED), seed: MARKET_SEED, creatorId, positions: new Map() },
    });
    this.ledger.push({ memberId: creatorId, amount: -MARKET_SEED, reason: "seed", marketId: id });
    return id;
  }

  buy(memberId: string, marketId: string, side: Side, amount: Coins): void {
    const m = this.openMarket(marketId);
    if (!canSpend(this.balance(memberId), amount)) throw new Error("Not enough coins");
    const q = quoteBuy(m.book.pool, side, amount);

    const old = m.book.positions.get(memberId);
    const pos = old ?? { yes: D(0), no: D(0), invested: 0n };
    const next: Position = {
      yes: side === "YES" ? pos.yes.plus(q.shares) : pos.yes,
      no: side === "NO" ? pos.no.plus(q.shares) : pos.no,
      invested: pos.invested + amount,
    };
    const firstBet = !old && memberId !== m.book.creatorId;

    // Commit.
    m.book = { ...m.book, pool: q.pool, positions: new Map(m.book.positions).set(memberId, next) };
    this.ledger.push({ memberId, amount: -amount, reason: "bet", marketId });
    if (firstBet) {
      this.mint({ memberId: m.book.creatorId, amount: CREATOR_BONUS, reason: "creator_bonus", marketId });
    }
  }

  sell(memberId: string, marketId: string, side: Side, shares: Dec): void {
    const m = this.openMarket(marketId);
    const pos = m.book.positions.get(memberId);
    const held = !pos ? D(0) : side === "YES" ? pos.yes : pos.no;
    if (!shares.gt(0) || shares.gt(held)) throw new Error("You don't hold these shares");
    const q = quoteSell(m.book.pool, side, shares);

    const next: Position = {
      yes: side === "YES" ? pos!.yes.minus(shares) : pos!.yes,
      no: side === "NO" ? pos!.no.minus(shares) : pos!.no,
      invested: pos!.invested - q.proceeds,
    };

    // Commit.
    m.book = { ...m.book, pool: q.pool, positions: new Map(m.book.positions).set(memberId, next) };
    this.ledger.push({ memberId, amount: q.proceeds, reason: "sale", marketId });
  }

  /** The simulation is one single day: each member can claim once. */
  claimDrop(memberId: string): void {
    if (this.dropClaimed.has(memberId)) throw new Error("Already claimed today");
    this.dropClaimed.add(memberId);
    this.mint({ memberId, amount: dailyDropAmount(1), reason: "drop" });
  }

  resolve(marketId: string, outcome: Side): void {
    const m = this.openMarket(marketId);
    const transfers = resolvePayouts(m.book, outcome);
    this.resolutionLog.push({ marketId, outcome, before: m.book, transfers });
    this.settle(marketId, m, transfers, "resolved");
  }

  cancel(marketId: string): void {
    const m = this.openMarket(marketId);
    const balances = new Map<string, Coins>();
    for (const id of m.book.positions.keys()) balances.set(id, this.balance(id));
    const transfers = cancelRefunds(m.book, balances);
    this.settle(marketId, m, transfers, "cancelled");
  }

  // ---- internals ----

  private settle(marketId: string, m: SimMarket, transfers: Transfer[], status: Status): void {
    m.status = status;
    for (const t of transfers) {
      if (t.amount !== 0n) this.ledger.push({ ...t, marketId });
    }
  }

  private mint(entry: LedgerEntry): void {
    this.minted += entry.amount;
    this.ledger.push(entry);
  }

  private market(marketId: string): SimMarket {
    const m = this.markets.get(marketId);
    if (!m) throw new Error(`Unknown market ${marketId}`);
    return m;
  }

  private openMarket(marketId: string): SimMarket {
    const m = this.market(marketId);
    if (m.status !== "open") throw new Error("This market is closed");
    return m;
  }
}
