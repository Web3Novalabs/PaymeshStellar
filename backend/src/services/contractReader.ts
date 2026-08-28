import { SorobanEventsClient, RpcSorobanEventsClient } from './sorobanRpcClient.js';
import { decodeGroupDetails, ScValDecodeError } from './scval.js';

export interface ChainGroupMember {
  address: string;
  shareBps: number;
}

export interface ChainGroup {
  id: string;
  name: string;
  creator: string;
  token: string;
  members: ChainGroupMember[];
}

export interface ChainReader {
  /**
   * Fetches the on-chain representation of a group.
   * Returns null if the group does not exist on-chain.
   */
  getGroup(groupId: string): Promise<ChainGroup | null>;
}

/**
 * Reads a group's full state straight out of contract persistent storage
 * (DataKey::Group(id)) via getLedgerEntries — no simulated invocation and no
 * funded account required, since this is a plain storage read rather than a
 * contract function call.
 */
export class SorobanChainReader implements ChainReader {
  private readonly contractId: string;
  private readonly client: SorobanEventsClient;

  constructor(rpcUrl: string, contractId: string, client?: SorobanEventsClient) {
    this.contractId = contractId;
    this.client = client ?? new RpcSorobanEventsClient(rpcUrl);
  }

  async getGroup(groupId: string): Promise<ChainGroup | null> {
    const idHex = groupId.startsWith('0x') ? groupId.slice(2) : groupId;
    const raw = await this.client.getGroupLedgerEntry(this.contractId, idHex);
    if (!raw) return null;

    let details;
    try {
      details = decodeGroupDetails(raw);
    } catch (err) {
      if (err instanceof ScValDecodeError) {
        throw new Error(`Failed to decode on-chain group ${idHex}: ${err.message}`, { cause: err });
      }
      throw err;
    }

    return {
      id: details.idHex,
      name: details.name,
      creator: details.creator,
      token: details.paymentToken,
      members: details.members.map((m) => ({ address: m.address, shareBps: m.percentageBps })),
    };
  }
}
