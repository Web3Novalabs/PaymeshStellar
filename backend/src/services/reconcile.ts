import { query, pool } from '../db/index.js';
import { groupsService, Group } from './groups.js';
import { ChainReader, ChainGroup } from './contractReader.js';
import { percentToBps, bpsToPercent } from '../utils/math.js';
import pino from 'pino';

const logger = pino();

export type DriftVariant =
  | { type: 'MissingOnChain' }
  | { type: 'MissingOffChain' }
  | { type: 'FieldMismatch'; field: string; onchain: any; offchain: any }
  | {
      type: 'MemberSetMismatch';
      added: string[]; // addresses on chain not in postgres
      removed: string[]; // addresses in postgres not on chain
      changed: Array<{ address: string; onchainBps: number; offchainBps: number }>;
    };

export interface GroupDriftReport {
  groupId: string;
  offchainGroup: Group | null;
  onchainGroup: ChainGroup | null;
  drifts: DriftVariant[];
}

export interface ReconciliationReport {
  startTime: Date;
  endTime: Date;
  groupsScanned: number;
  driftCounts: Record<string, number>;
  reports: Omit<GroupDriftReport, 'offchainGroup' | 'onchainGroup'>[];
}

export interface ReconciliationHealth {
  lastRunTime: Date | null;
  currentDriftCount: number;
}

export class ReconciliationService {
  private health: ReconciliationHealth = {
    lastRunTime: null,
    currentDriftCount: 0,
  };

  constructor(private readonly chainReader: ChainReader) {}

  getHealth(): ReconciliationHealth {
    return this.health;
  }

  /**
   * Reconciles a single group to detect drifts.
   */
  async reconcileGroup(onchainGroupId: string): Promise<GroupDriftReport | null> {
    const drifts: DriftVariant[] = [];
    
    // 1. Load from Postgres
    const offchainGroup = await groupsService.getByGroupId(onchainGroupId);
    
    // 2. Load from Chain
    let onchainGroup: ChainGroup | null = null;
    try {
      onchainGroup = await this.chainReader.getGroup(onchainGroupId);
    } catch (error) {
      // Transport error aborts everything.
      throw new Error(`Transport error during chain read for group ${onchainGroupId}: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!offchainGroup && !onchainGroup) {
      return null;
    }

    if (offchainGroup && !onchainGroup) {
      drifts.push({ type: 'MissingOnChain' });
    } else if (!offchainGroup && onchainGroup) {
      drifts.push({ type: 'MissingOffChain' });
    } else if (offchainGroup && onchainGroup) {
      // Both exist, diff fields
      if (offchainGroup.creator !== onchainGroup.creator) {
        drifts.push({ type: 'FieldMismatch', field: 'creator', onchain: onchainGroup.creator, offchain: offchainGroup.creator });
      }
      if (offchainGroup.paymentToken !== onchainGroup.token) {
        drifts.push({ type: 'FieldMismatch', field: 'paymentToken', onchain: onchainGroup.token, offchain: offchainGroup.paymentToken });
      }

      // Diff members
      const offchainMembersMap = new Map<string, number>();
      for (const m of offchainGroup.members) {
        offchainMembersMap.set(m.address, percentToBps(m.percentage));
      }

      const onchainMembersMap = new Map<string, number>();
      for (const m of onchainGroup.members) {
        onchainMembersMap.set(m.address, m.shareBps);
      }

      const added: string[] = [];
      const removed: string[] = [];
      const changed: Array<{ address: string; onchainBps: number; offchainBps: number }> = [];

      for (const [addr, onBps] of onchainMembersMap.entries()) {
        if (!offchainMembersMap.has(addr)) {
          added.push(addr);
        } else {
          const offBps = offchainMembersMap.get(addr)!;
          if (onBps !== offBps) {
            changed.push({ address: addr, onchainBps: onBps, offchainBps: offBps });
          }
        }
      }

      for (const addr of offchainMembersMap.keys()) {
        if (!onchainMembersMap.has(addr)) {
          removed.push(addr);
        }
      }

      if (added.length > 0 || removed.length > 0 || changed.length > 0) {
        drifts.push({
          type: 'MemberSetMismatch',
          added,
          removed,
          changed,
        });
      }
    }

    if (drifts.length > 0) {
      drifts.forEach(d => logger.warn({ groupId: onchainGroupId, drift: d }, 'Drift detected'));
      return { groupId: onchainGroupId, offchainGroup, onchainGroup, drifts };
    }

    return null; // clean
  }

  /**
   * Reconciles all groups. If repair is true, it performs a single DB transaction
   * applying chain-as-source-of-truth fixes.
   */
  async reconcileAll(repair: boolean = false): Promise<ReconciliationReport> {
    const startTime = new Date();
    let groupsScanned = 0;
    const driftCounts: Record<string, number> = {
      MissingOnChain: 0,
      MissingOffChain: 0,
      FieldMismatch: 0,
      MemberSetMismatch: 0,
    };
    
    // Scan Phase - No Writes
    const rawReports: GroupDriftReport[] = [];

    const limit = 50;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { groups } = await groupsService.list({ limit, offset });
      if (groups.length === 0) {
        hasMore = false;
        break;
      }

      for (const group of groups) {
        groupsScanned++;
        const report = await this.reconcileGroup(group.groupId);
        if (report) {
          rawReports.push(report);
        }
      }
      offset += limit;
    }

    // Process counts
    const cleanedReports = rawReports.map(r => {
      r.drifts.forEach(d => {
        driftCounts[d.type] = (driftCounts[d.type] || 0) + 1;
      });
      return { groupId: r.groupId, drifts: r.drifts };
    });

    // Repair Phase (only if repair=true and drifts found)
    if (repair && rawReports.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (const report of rawReports) {
          const { offchainGroup, onchainGroup, drifts } = report;
          
          if (drifts.some(d => d.type === 'MissingOnChain')) {
            // Delete offchain
            if (offchainGroup) {
              await client.query(`DELETE FROM groups WHERE id = $1`, [offchainGroup.id]);
            }
          } else if (drifts.some(d => d.type === 'MissingOffChain')) {
            // Create offchain from onchain
            if (onchainGroup) {
              // Ensure user
              const userRes = await client.query(
                `INSERT INTO users (wallet_address, name) VALUES ($1, $1) 
                 ON CONFLICT (wallet_address) DO UPDATE SET wallet_address = EXCLUDED.wallet_address RETURNING id`,
                [onchainGroup.creator]
              );
              const creatorId = userRes.rows[0].id;

              const groupRes = await client.query(
                `INSERT INTO groups (creator_id, name, token, onchain_group_id) VALUES ($1, $2, $3, $4) RETURNING id`,
                [creatorId, onchainGroup.id, onchainGroup.token, onchainGroup.id]
              );
              const groupId = groupRes.rows[0].id;

              for (const member of onchainGroup.members) {
                await client.query(
                  `INSERT INTO members (group_id, member_address, percentage) VALUES ($1, $2, $3)`,
                  [groupId, member.address, parseFloat(bpsToPercent(member.shareBps))]
                );
              }
            }
          } else if (offchainGroup && onchainGroup) {
            // Field mismatch
            if (drifts.some(d => d.type === 'FieldMismatch')) {
              await client.query(
                `UPDATE groups SET token = $1 WHERE id = $2`,
                [onchainGroup.token, offchainGroup.id]
              );
            }
            
            // MemberSet mismatch
            if (drifts.some(d => d.type === 'MemberSetMismatch')) {
              await client.query(`DELETE FROM members WHERE group_id = $1`, [offchainGroup.id]);
              for (const member of onchainGroup.members) {
                await client.query(
                  `INSERT INTO members (group_id, member_address, percentage) VALUES ($1, $2, $3)`,
                  [offchainGroup.id, member.address, parseFloat(bpsToPercent(member.shareBps))]
                );
              }
            }
          }
        }
        await client.query('COMMIT');
        
        // After repair, reset drifts as they were repaired
        // Issue says: "Repair is idempotent: the second run reports zero drift."
        // We still return the pre-repair report for logging, but record it.
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const endTime = new Date();
    
    // Audit trail
    await query(
      `INSERT INTO reconciliation_runs (start_time, end_time, groups_scanned, drift_counts, report)
       VALUES ($1, $2, $3, $4, $5)`,
      [startTime, endTime, groupsScanned, JSON.stringify(driftCounts), JSON.stringify(cleanedReports)]
    );

    // Update health stats
    this.health.lastRunTime = endTime;
    this.health.currentDriftCount = Object.values(driftCounts).reduce((a, b) => a + b, 0);

    return {
      startTime,
      endTime,
      groupsScanned,
      driftCounts,
      reports: cleanedReports,
    };
  }
}

import { SorobanChainReader } from './contractReader.js';
export const reconciliationService = new ReconciliationService(
  new SorobanChainReader(process.env.SOROBAN_RPC_URL || 'https://rpc-testnet.stellar.org', process.env.CONTRACT_ID || '')
);

