/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, describe, mock } from 'node:test';
import assert from 'node:assert';
import { SorobanService, SorobanSimulationError } from '../services/soroban.js';
import {
  xdr,
  Keypair,
  Networks,
  Account,
  TransactionBuilder,
  Operation,
  Asset,
} from '@stellar/stellar-sdk';

describe('SorobanService', () => {
  test('submit handles txBadSeq explicitly', async () => {
    const service = new SorobanService();

    // Mock sendTransaction
    const mockSend = mock.method(service['server'], 'sendTransaction', async () => {
      const resXdr = new xdr.TransactionResult({
        feeCharged: new xdr.Int64(100),
        ext: new xdr.TransactionResultExt(0),
        result: xdr.TransactionResultResult.txBadSeq(),
      });
      return {
        status: 'ERROR',
        hash: '1234',
        errorResult: resXdr,
        latestLedger: 100,
        latestLedgerCloseTime: 100,
      } as any;
    });

    const kp = Keypair.random();
    const dummyAccount = new Account(kp.publicKey(), '1');
    const tx = new TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({ destination: kp.publicKey(), asset: Asset.native(), amount: '10' })
      )
      .setTimeout(30)
      .build();

    await assert.rejects(() => service.submit(tx.toXDR()), /txBadSeq/);

    mockSend.mock.restore();
  });

  test('mapSimulationError maps AutoShareError codes correctly', () => {
    const service = new SorobanService();

    const simResponse: any = {
      error: 'HostError: Error(Contract, 1)',
    };

    assert.throws(
      () => {
        (service as any).mapSimulationError(simResponse);
      },
      (err: any) => {
        return (
          err instanceof SorobanSimulationError &&
          err.code === 1 &&
          err.variant === 'GroupAlreadyExists' &&
          err.message === 'Group already exists. Use a unique group ID.'
        );
      }
    );
  });

  test('mapSimulationError throws on restore preamble', () => {
    const service = new SorobanService();

    const simResponse: any = {
      _parsed: true,
      id: '1',
      latestLedger: 1,
      events: [],
      result: { retval: xdr.ScVal.scvVoid(), auth: [] },
      minResourceFee: '100',
      transactionData: {} as any,
      restorePreamble: {
        minResourceFee: '100',
        transactionData: 'foo',
      },
    };

    assert.throws(
      () => {
        (service as any).mapSimulationError(simResponse);
      },
      (err: any) => {
        return err instanceof SorobanSimulationError && err.variant === 'RestoreRequired';
      }
    );
  });
});
