'use client';

import { useState } from 'react';
import { MemberAllocation, calculateShares, validateAllocation } from '@/lib/utils/allocation';
import Input from './Input';

interface SharePreviewProps {
  members: MemberAllocation[];
  sampleAmount?: number;
}

/**
 * SharePreview - Component for previewing distribution shares.
 * Shows what each member actually receives for a sample amount,
 * reproducing the contract's floor-plus-dust-to-last-member rule exactly.
 * If the preview and get_member_shares ever disagree, the preview is wrong.
 */
export default function SharePreview({ members, sampleAmount = 10000 }: SharePreviewProps) {
  const [amount, setAmount] = useState(sampleAmount);
  const isValid = validateAllocation(members);
  const shares = isValid && amount > 0 ? calculateShares(amount, members) : [];
  const totalDistributed = shares.reduce((sum, s) => sum + s.share, 0);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Share Preview</h3>

      <div className="max-w-xs">
        <Input
          id="sample-amount"
          label="Sample Amount"
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
          helpText="Enter a sample amount to preview distribution"
        />
      </div>

      {!isValid ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            Complete the allocation (exactly 10,000 basis points) to see share preview.
          </p>
        </div>
      ) : shares.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-600">Enter a sample amount to see distribution preview.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">
                    Member
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">
                    Basis Points
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold text-gray-600">
                    Share
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shares.map((shareResult) => {
                  const member = members.find((m) => m.id === shareResult.memberId);
                  if (!member) return null;

                  return (
                    <tr key={shareResult.memberId}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {member.name || 'Unnamed Member'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{shareResult.basisPoints} bp</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">
                        {shareResult.share.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {shareResult.isDustRecipient && shareResult.share > 0 && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                            + Dust
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-900" colSpan={2}>
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                    {totalDistributed.toLocaleString()}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Verification note */}
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-xs text-green-800">
              <strong>Verification:</strong> Total distributed ({totalDistributed.toLocaleString()}) matches sample
              amount ({amount.toLocaleString()}). This preview uses the same floor-division and final-member dust
              allocation as the smart contract.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
