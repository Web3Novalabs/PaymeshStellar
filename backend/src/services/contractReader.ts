

export interface ChainGroupMember {
  address: string;
  shareBps: number;
}

export interface ChainGroup {
  id: string;
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

export class SorobanChainReader implements ChainReader {
  constructor(private readonly rpcUrl: string, private readonly contractId: string) {
    // Suppress unused warnings since this is a stub
    void this.rpcUrl;
    void this.contractId;
  }

  async getGroup(groupId: string): Promise<ChainGroup | null> {
    void groupId;
    // In a real implementation, this would use @stellar/stellar-sdk rpc.Server
    // to query the Soroban contract storage or invoke a getter method.
    // E.g., rpcServer.getContractData(...) and parse the XDR.
    // For this issue scope, we define the interface.
    throw new Error('SorobanChainReader.getGroup is not yet implemented.');
  }
}
