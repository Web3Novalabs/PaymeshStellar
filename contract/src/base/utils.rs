use crate::base::errors::AutoShareError;
use crate::base::types::GroupMember;
use soroban_sdk::{Env, Vec};

/// Calculates a member's share: total * percentage / 10000.
/// Uses checked multiplication to prevent overflow issues on large total amounts.
pub fn calculate_share(total: i128, percentage: u32) -> i128 {
    total
        .checked_mul(percentage as i128)
        .expect("overflow in calculate_share")
        / 10000
}

/// Validates that the percentages (basis points) of all members sum to exactly 10000 (100%).
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

/// Splits total by basis points with deterministic remainder handling so payouts sum exactly to total.
/// Rounds down using floor division and assigns any remaining dust to the last member.
/// Returns `AutoShareError::InvalidAmount` if the total is negative.
/// Returns `AutoShareError::InvalidPercentage` if the member percentages do not validate correctly.
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
