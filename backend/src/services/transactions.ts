export interface Transaction {
  id: string;
  groupId: string;
  amount: string; // in stroops (smallest unit)
  asset: string; // asset code or full asset identifier
  timestamp: Date;
  membersInvolved: string[]; // Stellar addresses
  txHash: string; // on-chain transaction hash
}

export interface TransactionFilter {
  groupId?: string;
  memberAddress?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
}

export interface TransactionResult {
  data: Transaction[];
  limit: number;
  cursor?: string;
  nextCursor?: string;
  hasMore: boolean;
}

export interface TransactionDataSource {
  getTransactions(filter: TransactionFilter): Promise<TransactionResult>;
  // For tests: add transaction
  addTransaction?(tx: Transaction): Promise<void>;
  // For tests: clear all data
  clear?(): Promise<void>;
}

/**
 * In-memory mock data source for transactions.
 * In production, this would be swapped for a real Horizon + DB integration.
 */
export class InMemoryTransactionDataSource implements TransactionDataSource {
  private transactions: Transaction[] = [];

  async getTransactions(filter: TransactionFilter): Promise<TransactionResult> {
    let filtered = [...this.transactions];

    // Apply filters
    if (filter.groupId) {
      filtered = filtered.filter((t) => t.groupId === filter.groupId);
    }

    if (filter.memberAddress) {
      filtered = filtered.filter((t) => t.membersInvolved.includes(filter.memberAddress!));
    }

    // Sort by timestamp
    const order = filter.order ?? 'desc';
    filtered.sort((a, b) => {
      const diff = a.timestamp.getTime() - b.timestamp.getTime();
      return order === 'asc' ? diff : -diff;
    });

    // Cursor-based pagination
    const limit = filter.limit ?? 10;
    let startIdx = 0;

    if (filter.cursor) {
      startIdx = filtered.findIndex((t) => t.id === filter.cursor);
      if (startIdx >= 0) {
        startIdx += 1; // Start after the cursor
      } else {
        startIdx = 0;
      }
    }

    const page = filtered.slice(startIdx, startIdx + limit + 1);
    const hasMore = page.length > limit;
    const data = page.slice(0, limit);
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

    return {
      data,
      limit,
      cursor: filter.cursor,
      nextCursor,
      hasMore,
    };
  }

  async clear(): Promise<void> {
    this.transactions = [];
  }

  /**
   * Add transactions for testing purposes
   */
  async addTransaction(tx: Transaction): Promise<void> {
    this.transactions.push(tx);
  }
}

export const transactionDataSource: InMemoryTransactionDataSource =
  new InMemoryTransactionDataSource();
