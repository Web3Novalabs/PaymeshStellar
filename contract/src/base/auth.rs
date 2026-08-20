//! Authorization and validation helpers used by contract entrypoints.

use crate::base::errors::AutoShareError;
use crate::base::types::{AutoShareDetails, AutoShareDetailsV1, DataKey, GroupMember};
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
        total = total
            .checked_add(member.percentage)
            .ok_or(AutoShareError::InvalidPercentage)?;
    }
    if total != 10000 {
        Err(AutoShareError::InvalidPercentage)
    } else {
        Ok(())
    }
}

/// Loads an existing group from persistent storage, supporting both v2 and v1 formats.
///
/// # Errors
///
/// Returns [`AutoShareError::GroupNotFound`] when `id` is not stored.
pub fn validate_group_exists(
    env: &Env,
    id: &BytesN<32>,
) -> Result<AutoShareDetails, AutoShareError> {
    use soroban_sdk::{Map, TryFromVal, Val};

    let key = DataKey::Group(id.clone());
    if let Some(val) = env.storage().persistent().get::<DataKey, Val>(&key) {
        if let Ok(map) = Map::<Val, Val>::try_from_val(env, &val) {
            if map.len() == 6 {
                if let Ok(v1) = AutoShareDetailsV1::try_from_val(env, &val) {
                    return Ok(AutoShareDetails {
                        id: v1.id,
                        name: v1.name,
                        creator: v1.creator,
                        usage_count: v1.usage_count,
                        payment_token: v1.payment_token,
                        members: v1.members,
                        version: 1,
                    });
                }
            } else if map.len() == 7 {
                if let Ok(details) = AutoShareDetails::try_from_val(env, &val) {
                    return Ok(details);
                }
            }
        }
    }
    Err(AutoShareError::GroupNotFound)
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

// ── New authorization helpers ─────────────────────────────────────────────

/// Requires that `caller` is the group creator and has authorized the call.
///
/// This combines `caller.require_auth()` with a creator check. It is the
/// preferred gate for operations that only the group creator may perform
/// (e.g. `update_members`).
///
/// # Errors
///
/// Returns [`AutoShareError::Unauthorized`] if `caller` is not the creator.
pub fn require_group_creator(
    _env: &Env,
    details: &AutoShareDetails,
    caller: &Address,
) -> Result<(), AutoShareError> {
    caller.require_auth();
    validate_is_creator(&details.creator, caller)
}

/// Requires that `caller` is a member of the group and has authorized the call.
///
/// # Errors
///
/// Returns [`AutoShareError::Unauthorized`] if auth fails, or
/// [`AutoShareError::MemberNotFound`] if `caller` is not in `details.members`.
pub fn require_group_member(
    _env: &Env,
    details: &AutoShareDetails,
    caller: &Address,
) -> Result<(), AutoShareError> {
    caller.require_auth();
    validate_member_exists(&details.members, caller).map(|_| ())
}

/// Requires that `caller` is the contract admin.
///
/// The admin address is stored under [`DataKey::Admin`].
///
/// # Errors
///
/// Returns [`AutoShareError::NotInitialized`] when no admin has been set or
/// [`AutoShareError::Unauthorized`] when `caller` is not the admin.
pub fn require_admin(env: &Env, caller: &Address) -> Result<(), AutoShareError> {
    caller.require_auth();

    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .or_else(|| env.storage().persistent().get(&DataKey::Admin))
        .ok_or(AutoShareError::NotInitialized)?;

    if admin == *caller {
        Ok(())
    } else {
        Err(AutoShareError::Unauthorized)
    }
}

/// Pure predicate that checks whether `address` is a member of `details`.
///
/// Returns `true` if `address` appears in `details.members`, `false` otherwise.
pub fn is_member(details: &AutoShareDetails, address: &Address) -> bool {
    details.members.iter().any(|m| m.address == *address)
}

/// Checks that the on-chain schema version matches [`crate::base::types::CURRENT_SCHEMA_VERSION`].
///
/// # Errors
///
/// Returns [`AutoShareError::MigrationRequired`] when the stored version is
/// absent or does not equal the compiled constant.
pub fn require_migration_current(env: &Env) -> Result<(), AutoShareError> {
    use crate::base::types::CURRENT_SCHEMA_VERSION;

    let stored: u32 = env
        .storage()
        .instance()
        .get(&DataKey::SchemaVersion)
        .unwrap_or(0);

    if stored == CURRENT_SCHEMA_VERSION {
        Ok(())
    } else {
        Err(AutoShareError::MigrationRequired)
    }
}

/// Checks that the contract is currently paused.
///
/// # Errors
///
/// Returns [`AutoShareError::ContractNotPaused`] when the contract is not
/// paused or the `Paused` flag has never been set.
pub fn require_paused(env: &Env) -> Result<(), AutoShareError> {
    let paused: bool = env
        .storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false);

    if paused {
        Ok(())
    } else {
        Err(AutoShareError::ContractNotPaused)
    }
}

/// Checks that the contract is not paused.
///
/// # Errors
///
/// Returns [`AutoShareError::ContractPaused`] when the contract is paused.
pub fn require_not_paused(env: &Env) -> Result<(), AutoShareError> {
    let paused: bool = env
        .storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false);

    if paused {
        Err(AutoShareError::ContractPaused)
    } else {
        Ok(())
    }
}
