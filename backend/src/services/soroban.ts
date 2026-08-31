import { rpc, Contract, xdr, TransactionBuilder } from '@stellar/stellar-sdk';
import { sorobanConfig } from '../config/soroban.js';
import { AutoShareDetails } from '../types/index.js';
import {
  addressToScVal,
  groupIdToScVal,
  i128FromScVal,
  autoShareDetailsFromScVal,
} from '../utils/scval.js';

export class SorobanSimulationError extends Error {
  public code: number;
  public variant: string;
  public restorePreamble?: unknown;

  constructor(message: string, code: number, variant: string, restorePreamble?: unknown) {
    super(message);
    this.name = 'SorobanSimulationError';
    this.code = code;
    this.variant = variant;
    this.restorePreamble = restorePreamble;
  }
}

const ERROR_MAP: Record<number, { variant: string; message: string }> = {
  1: { variant: 'GroupAlreadyExists', message: 'Group already exists. Use a unique group ID.' },
  2: { variant: 'GroupNotFound', message: 'Group not found. Verify the group ID is correct.' },
  3: {
    variant: 'Unauthorized',
    message: 'Unauthorized. Only the group creator can perform this action.',
  },
  4: {
    variant: 'InvalidPercentage',
    message: 'Invalid percentage. Member percentages must sum to 10000 basis points.',
  },
  5: {
    variant: 'InvalidAmount',
    message: 'Invalid amount. Amount must be a positive integer greater than zero.',
  },
  6: {
    variant: 'InsufficientBalance',
    message: 'Insufficient balance. Ensure the sender has enough funds to distribute.',
  },
  7: {
    variant: 'MemberNotFound',
    message: 'Member not found. Verify the member address belongs to this group.',
  },
  8: {
    variant: 'DuplicateMember',
    message: 'Duplicate member. Each member address must appear only once.',
  },
  9: {
    variant: 'EmptyMembers',
    message: 'No members found. Add at least one member before distributing.',
  },
  10: {
    variant: 'UnauthorizedAccess',
    message: 'Unauthorized access. You do not have permission to perform this action.',
  },
  11: {
    variant: 'InvalidGroupId',
    message: 'Invalid group ID. The provided group ID does not exist or is malformed.',
  },
  12: {
    variant: 'MigrationRequired',
    message: 'Migration required. Call migrate() before performing mutations.',
  },
  13: {
    variant: 'NothingToMigrate',
    message: 'Nothing to migrate. The contract schema is already current.',
  },
  14: {
    variant: 'ContractNotPaused',
    message: 'Contract not paused. Pause the contract before upgrading.',
  },
  15: {
    variant: 'AlreadyInitialized',
    message: 'Already initialized. The contract has already been set up.',
  },
  16: {
    variant: 'NothingToClaim',
    message: 'Nothing to claim. This member has no escrowed balance in this group.',
  },
  17: {
    variant: 'ScheduleAlreadyExists',
    message: 'Schedule already exists. A group can only have one active schedule.',
  },
  18: {
    variant: 'ScheduleNotDue',
    message: 'Schedule not due. The current time is before the next scheduled run.',
  },
  19: {
    variant: 'ScheduleInactive',
    message: 'Schedule inactive. The schedule has completed or was cancelled.',
  },
  20: {
    variant: 'ContractPaused',
    message: 'Contract is paused. This operation cannot be performed right now.',
  },
};

export class SorobanService {
  private server: rpc.Server;
  private contractId: string;
  private networkPassphrase: string;

  constructor() {
    const config = sorobanConfig();
    this.server = new rpc.Server(config.rpcUrl);
    this.contractId = config.contractId;
    this.networkPassphrase = config.networkPassphrase;
  }

  private mapSimulationError(simResult: rpc.Api.SimulateTransactionResponse): never {
    if (rpc.Api.isSimulationError(simResult)) {
      const match = simResult.error.match(/Error\(Contract, (\d+)\)/);
      if (match) {
        const code = parseInt(match[1], 10);
        const mapped = ERROR_MAP[code];
        if (mapped) {
          throw new SorobanSimulationError(mapped.message, code, mapped.variant);
        } else {
          throw new SorobanSimulationError(
            `Unknown contract error code: ${code}`,
            code,
            'UnknownContractError'
          );
        }
      }
      throw new SorobanSimulationError(simResult.error, -1, 'UnknownSimulationError');
    }

    if (rpc.Api.isSimulationRestore(simResult)) {
      throw new SorobanSimulationError(
        'State archiving requires restore preamble.',
        -2,
        'RestoreRequired'
      );
    }

    throw new SorobanSimulationError('Unexpected simulation failure', -1, 'UnknownSimulationError');
  }

  public async getGroup(groupIdHex: string): Promise<AutoShareDetails | null> {
    const contract = new Contract(this.contractId);
    const callArgs = [groupIdToScVal(groupIdHex)];

    const tx = new TransactionBuilder(await this.server.getAccount(this.contractId), {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call('get_group', ...callArgs))
      .setTimeout(30)
      .build();

    const simResult = await this.server.simulateTransaction(tx);

    if (!rpc.Api.isSimulationSuccess(simResult)) {
      // get_group panics or returns false/error if not found?
      // Usually reads that fail might map to errors.
      // The requirements don't state how it fails if not found, assume it might revert or return a void.
      try {
        this.mapSimulationError(simResult);
      } catch (err: unknown) {
        if (err instanceof SorobanSimulationError && err.variant === 'GroupNotFound') {
          return null;
        }
        throw err;
      }
    }

    if (rpc.Api.isSimulationSuccess(simResult) && simResult.result && simResult.result.retval) {
      const scVal = simResult.result.retval;
      if (scVal.switch() === xdr.ScValType.scvMap()) {
        return autoShareDetailsFromScVal(scVal);
      }
    }

    return null;
  }

  public async getGroupsByCreator(creatorAddress: string): Promise<string[]> {
    const contract = new Contract(this.contractId);
    const callArgs = [addressToScVal(creatorAddress)];

    const tx = new TransactionBuilder(await this.server.getAccount(creatorAddress), {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call('get_creator_groups', ...callArgs))
      .setTimeout(30)
      .build();

    const simResult = await this.server.simulateTransaction(tx);

    if (!rpc.Api.isSimulationSuccess(simResult)) {
      this.mapSimulationError(simResult);
    }

    if (rpc.Api.isSimulationSuccess(simResult) && simResult.result && simResult.result.retval) {
      const scVal = simResult.result.retval;
      if (scVal.switch() === xdr.ScValType.scvVec()) {
        const vec = scVal.vec();
        if (vec) {
          return vec.map((v: xdr.ScVal) => v.bytes().toString('hex'));
        }
      }
    }

    return [];
  }

  public async getMemberShares(groupIdHex: string, memberAddress: string): Promise<string | null> {
    const contract = new Contract(this.contractId);
    const callArgs = [groupIdToScVal(groupIdHex), addressToScVal(memberAddress)];

    const tx = new TransactionBuilder(await this.server.getAccount(memberAddress), {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call('get_member_shares', ...callArgs))
      .setTimeout(30)
      .build();

    const simResult = await this.server.simulateTransaction(tx);

    if (!rpc.Api.isSimulationSuccess(simResult)) {
      try {
        this.mapSimulationError(simResult);
      } catch (err: unknown) {
        if (err instanceof SorobanSimulationError && err.variant === 'MemberNotFound') {
          return null;
        }
        throw err;
      }
    }

    if (rpc.Api.isSimulationSuccess(simResult) && simResult.result && simResult.result.retval) {
      const scVal = simResult.result.retval;
      return i128FromScVal(scVal);
    }

    return null;
  }

  public async prepareTransaction(
    sourceAddress: string,
    method: string,
    args: xdr.ScVal[],
    feeMultiplier: number = 1.2
  ): Promise<{ xdr: string; minResourceFee: string; events: xdr.DiagnosticEvent[] }> {
    const contract = new Contract(this.contractId);
    const account = await this.server.getAccount(sourceAddress);

    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(300)
      .build();

    const simResult = await this.server.simulateTransaction(tx);

    if (!rpc.Api.isSimulationSuccess(simResult)) {
      this.mapSimulationError(simResult);
    }

    const assembledBuilder = rpc.assembleTransaction(tx, simResult);
    const assembledTx = assembledBuilder.build();

    const baseFee = parseInt(assembledTx.fee, 10);
    const boostedFee = Math.ceil(baseFee * feeMultiplier);

    const resTx = new TransactionBuilder(account, {
      fee: boostedFee.toString(),
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(300)
      .build();

    const assembledWithFee = rpc.assembleTransaction(resTx, simResult).build();

    return {
      xdr: assembledWithFee.toXDR(),
      minResourceFee: simResult.minResourceFee,
      events: simResult.events || [],
    };
  }

  public async submit(
    signedXdr: string
  ): Promise<{ hash: string; status: string; error?: string }> {
    const tx = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);

    const sendResult = await this.server.sendTransaction(tx);

    if (sendResult.status === 'ERROR') {
      const errorResultCode = sendResult.errorResult
        ? sendResult.errorResult.result().switch().name
        : 'Unknown';

      if (errorResultCode === 'txBadSeq') {
        throw new Error(
          'txBadSeq: Transaction sequence number is incorrect. Please refresh and try again. (Not retriable)'
        );
      } else if (errorResultCode === 'txInsufficientFee') {
        throw new Error('txInsufficientFee: The provided fee is too low. (Not retriable)');
      }
      throw new Error(`Submission failed: ${errorResultCode}. (Not retriable)`);
    } else if (sendResult.status === 'TRY_AGAIN_LATER') {
      throw new Error(
        'TRY_AGAIN_LATER: The network is currently busy. Please try again later. (Retriable)'
      );
    }

    const hash = sendResult.hash;

    // Poll getTransaction
    let retries = 0;
    const maxRetries = 10;
    let delay = 1000;

    while (retries < maxRetries) {
      const txResponse = await this.server.getTransaction(hash);

      if (txResponse.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return { hash, status: 'SUCCESS' };
      } else if (txResponse.status === rpc.Api.GetTransactionStatus.FAILED) {
        // Could decode inner contract error here
        return {
          hash,
          status: 'FAILED',
          error: txResponse.resultMetaXdr ? 'Contract execution failed' : 'Transaction failed',
        };
      } else if (txResponse.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
        // TRY_AGAIN_LATER equivalent in polling
        retries++;
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 10000);
      } else {
        // Unknown status
        retries++;
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 10000);
      }
    }

    throw new Error('Transaction submission timed out waiting for inclusion.');
  }
}

export const sorobanService = new SorobanService();
