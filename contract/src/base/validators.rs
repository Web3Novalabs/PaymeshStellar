use crate::base::errors::AutoShareError;
use crate::base::types::{AutoShareDetails, DataKey, GroupMember};
use soroban_sdk::{Address, BytesN, Env};

/// Validates that an amount is greater than zero
pub fn validate_amount(amount: i128) -> Result<(), AutoShareError> {
    if amount <= 0 {
        Err(AutoShareError::InvalidAmount)
    } else {
        Ok(())
    }
}

/// Validates that members' percentages sum to 10000 (100% in basis points)
/// and that no member has zero percentage
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

/// Validates that a group exists in storage and returns it
pub fn validate_group_exists(
    env: &Env,
    id: &BytesN<32>,
) -> Result<AutoShareDetails, AutoShareError> {
    env.storage()
        .persistent()
        .get(&DataKey::Group(id.clone()))
        .ok_or(AutoShareError::GroupNotFound)
}

/// Validates that a member exists in the members list
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

/// Validates that the caller is the creator
pub fn validate_is_creator(creator: &Address, caller: &Address) -> Result<(), AutoShareError> {
    if creator == caller {
        Ok(())
    } else {
        Err(AutoShareError::Unauthorized)
    }
}

/// Validates that members list is not empty and contains no duplicates
pub fn validate_members_unique(
    members: &soroban_sdk::Vec<GroupMember>,
) -> Result<(), AutoShareError> {
    if members.is_empty() {
        return Err(AutoShareError::EmptyMembers);
    }

    // Check for duplicates
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
