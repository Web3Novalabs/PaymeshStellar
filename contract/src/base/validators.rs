//! Validation helpers used by contract entrypoints.

use crate::base::errors::AutoShareError;
use crate::base::types::{AutoShareDetails, DataKey, GroupMember};
use soroban_sdk::{Address, BytesN, Env};

/// Validates that a distribution amount is greater than zero.
///
/// # Errors
///
/// Returns [`AutoShareError::InvalidAmount`] when `amount` is zero or negative.
pub fn validate_amount(amount: i128) -> Result<(), AutoShareError> {
    if amount <= 0 {
        Err(AutoShareError::InvalidAmount)
    } else {
        Ok(())
    }
}

/// Validates non-zero percentages totaling `10_000` basis points.
///
/// # Errors
///
/// Returns [`AutoShareError::InvalidPercentage`] if any percentage is zero or
/// the total is not exactly `10_000`.
pub fn validate_percentages(members: &soroban_sdk::Vec<GroupMember>) -> Result<(), AutoShareError> {
    let mut total: u32 = 0;
    for member in members.iter() {
        if member.percentage == 0 {
            return Err(AutoShareError::InvalidPercentage);
        }
        total += member.percentage;
    }
    if total != 10000 {
        Err(AutoShareError::InvalidPercentage)
    } else {
        Ok(())
    }
}

/// Loads an existing group from persistent storage.
///
/// # Errors
///
/// Returns [`AutoShareError::GroupNotFound`] when `id` is not stored.
pub fn validate_group_exists(
    env: &Env,
    id: &BytesN<32>,
) -> Result<AutoShareDetails, AutoShareError> {
    env.storage()
        .persistent()
        .get(&DataKey::Group(id.clone()))
        .ok_or(AutoShareError::GroupNotFound)
}

/// Finds a member by address.
///
/// # Errors
///
/// Returns [`AutoShareError::MemberNotFound`] when the address is absent.
pub fn validate_member_exists(
    members: &soroban_sdk::Vec<GroupMember>,
    address: &Address,
) -> Result<GroupMember, AutoShareError> {
    for member in members.iter() {
        if member.address == *address {
            return Ok(member);
        }
    }
    Err(AutoShareError::MemberNotFound)
}

/// Checks that `caller` is the stored group creator.
///
/// # Errors
///
/// Returns [`AutoShareError::Unauthorized`] when the addresses differ.
pub fn validate_is_creator(creator: &Address, caller: &Address) -> Result<(), AutoShareError> {
    if creator == caller {
        Ok(())
    } else {
        Err(AutoShareError::Unauthorized)
    }
}

/// Validates that a member list is non-empty and has unique addresses.
///
/// # Errors
///
/// Returns [`AutoShareError::EmptyMembers`] for an empty list or
/// [`AutoShareError::DuplicateMember`] when an address occurs more than once.
pub fn validate_members_unique(
    members: &soroban_sdk::Vec<GroupMember>,
) -> Result<(), AutoShareError> {
    if members.is_empty() {
        return Err(AutoShareError::EmptyMembers);
    }

    // Lists are intentionally small, so pairwise comparison avoids temporary
    // storage and keeps the contract representation simple.
    for i in 0..members.len() {
        let current = members.get(i).unwrap();
        for j in (i + 1)..members.len() {
            let other = members.get(j).unwrap();
            if current.address == other.address {
                return Err(AutoShareError::DuplicateMember);
            }
        }
    }

    Ok(())
}
