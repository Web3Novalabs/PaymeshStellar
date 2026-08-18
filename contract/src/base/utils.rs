use crate::base::errors::AutoShareError;
use crate::base::types::GroupMember;
use soroban_sdk::{Env, Vec};

// ── Overflow boundary documentation ──────────────────────────────────────────
//
// `calculate_share` computes  total * percentage / 10_000  using i128 arithmetic.
// The intermediate product `total * percentage` must not exceed i128::MAX.
//
//   i128::MAX  =  170_141_183_460_469_231_731_687_303_715_884_105_727
//   MAX_SAFE   =  i128::MAX / 10_000
//              =   17_014_118_346_046_923_173_168_730_371_588_410
//
// Any `total` strictly greater than MAX_SAFE (with percentage = 10_000) will
// overflow the multiplication.  Values up to and including MAX_SAFE are safe.
//
// This boundary is tested in `test_calculate_share_overflow_boundary` below.

/// Maximum `total` value for which `total * 10_000` does not overflow `i128`.
pub const MAX_SAFE_TOTAL: i128 = i128::MAX / 10_000;

/// Calculates a member's share: `total * percentage / 10_000`.
///
/// Uses checked multiplication to detect overflow without panicking.
///
/// # Errors
///
/// Returns [`AutoShareError::InvalidAmount`] if `total * percentage` would
/// overflow `i128`.  Callers should treat this as a request for an amount that
/// is too large for the on-chain integer representation.
pub fn calculate_share(total: i128, percentage: u32) -> Result<i128, AutoShareError> {
    let product = total
        .checked_mul(percentage as i128)
        .ok_or(AutoShareError::InvalidAmount)?;
    Ok(product / 10_000)
}

/// Canonical single source of truth for percentage validation.
///
/// Validates that:
/// - every member's individual percentage is non-zero (basis-point value must be ≥ 1), and
/// - all percentages sum to exactly 10 000 (representing 100 %).
///
/// Uses `checked_add` so a crafted list whose raw sum would wrap `u32::MAX`
/// returns [`AutoShareError::InvalidPercentage`] rather than trapping.
///
/// # Errors
///
/// Returns [`AutoShareError::InvalidPercentage`] if any member has a zero
/// percentage, if the sum overflows, or if the sum is not exactly 10 000.
pub fn validate_percentages(members: &Vec<GroupMember>) -> Result<(), AutoShareError> {
    let mut sum: u32 = 0;
    for member in members.iter() {
        if member.percentage == 0 {
            return Err(AutoShareError::InvalidPercentage);
        }
        sum = sum
            .checked_add(member.percentage)
            .ok_or(AutoShareError::InvalidPercentage)?;
    }
    if sum == 10_000 {
        Ok(())
    } else {
        Err(AutoShareError::InvalidPercentage)
    }
}

/// Splits `total` by basis points with deterministic remainder handling so
/// payouts sum exactly to `total`.
///
/// Rounds down (floor division) for every non-final member.  Any remaining
/// dust — up to `(member_count − 1)` units — is assigned to the last member.
///
/// # Errors
///
/// - [`AutoShareError::InvalidAmount`] if `total` is negative, or if the
///   intermediate multiplication `total * percentage` overflows `i128`.
/// - [`AutoShareError::InvalidPercentage`] if the member percentages do not
///   validate (see [`validate_percentages`]).
pub fn distribute_amounts(
    env: &Env,
    total: i128,
    members: &Vec<GroupMember>,
) -> Result<Vec<i128>, AutoShareError> {
    if total < 0 {
        return Err(AutoShareError::InvalidAmount);
    }

    validate_percentages(members)?;

    let mut distributed: i128 = 0;
    let mut shares = Vec::new(env);
    let len = members.len();

    for i in 0..len {
        let member = members.get(i).unwrap();
        let share = if i == len - 1 {
            // The last member gets the remaining dust so payouts sum exactly to total.
            total - distributed
        } else {
            calculate_share(total, member.percentage)?
        };
        shares.push_back(share);
        distributed += share;
    }

    Ok(shares)
}
