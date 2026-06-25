//! Basis-point calculations and deterministic distribution helpers.

use crate::base::errors::AutoShareError;
use crate::base::types::GroupMember;
use soroban_sdk::{Env, Vec};

/// Calculates a member share as `total * percentage / 10_000`.
///
/// `percentage` is expressed in basis points, where `10_000` equals 100%.
///
/// # Panics
///
/// Panics if the intermediate multiplication overflows `i128`.
pub fn calculate_share(total: i128, percentage: u32) -> i128 {
    total
        .checked_mul(percentage as i128)
        .expect("overflow in calculate_share")
        / 10000
}

/// Validates that member percentages total exactly `10_000` basis points.
///
/// # Errors
///
/// Returns [`AutoShareError::InvalidPercentage`] if addition overflows or the
/// final total is not `10_000`.
pub fn validate_percentages(members: &Vec<GroupMember>) -> Result<(), AutoShareError> {
    let mut sum: u32 = 0;
    for member in members.iter() {
        sum = sum
            .checked_add(member.percentage)
            .ok_or(AutoShareError::InvalidPercentage)?;
    }
    if sum == 10000 {
        Ok(())
    } else {
        Err(AutoShareError::InvalidPercentage)
    }
}

/// Splits `total` using basis points and deterministic remainder handling.
///
/// Every share except the last uses floor division. The final member receives
/// the remainder so all shares sum exactly to `total`.
///
/// # Errors
///
/// Returns [`AutoShareError::InvalidAmount`] for a negative total and
/// [`AutoShareError::InvalidPercentage`] for an invalid member configuration.
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
            // The last member explicitly gets the remaining dust to ensure payouts sum exactly to the total.
            total - distributed
        } else {
            calculate_share(total, member.percentage)
        };
        shares.push_back(share);
        distributed += share;
    }

    Ok(shares)
}
