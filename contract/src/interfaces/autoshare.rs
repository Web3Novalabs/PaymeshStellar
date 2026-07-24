//! Abstract interface for AutoShare contract clients and implementations.

use soroban_sdk::{Address, BytesN, Env, String, Vec};

use crate::base::errors::AutoShareError;
use crate::base::types::{AutoShareDetails, GroupMember};

/// Operations exposed by an AutoShare-compatible contract.
pub trait AutoShareTrait {
    /// Creates an empty group and indexes it by creator.
    ///
    /// The creator must authorize the call. Returns
    /// [`AutoShareError::GroupAlreadyExists`] if `id` is already in use.
    fn create(
        env: Env,
        id: BytesN<32>,
        name: String,
        creator: Address,
        usage_count: u32,
        payment_token: Address,
    ) -> Result<(), AutoShareError>;

    /// Replaces a group's complete member configuration.
    ///
    /// The caller must authorize the call and be the group creator. Returns
    /// validation errors for missing groups, invalid percentages, duplicates,
    /// empty lists, or unauthorized callers.
    fn update_members(
        env: Env,
        id: BytesN<32>,
        caller: Address,
        new_members: Vec<GroupMember>,
    ) -> Result<(), AutoShareError>;

    /// Returns a group or [`AutoShareError::GroupNotFound`].
    fn get(env: Env, id: BytesN<32>) -> Result<AutoShareDetails, AutoShareError>;

    /// Returns all stored groups indexed to `creator`.
    fn get_groups_by_creator(env: Env, creator: Address) -> Vec<AutoShareDetails>;

    /// Distributes a positive token amount using the group's configured shares.
    ///
    /// The funding address must authorize the call. Returns validation errors
    /// for invalid amounts, missing groups, empty member lists, or insufficient
    /// token balance.
    fn distribute(
        env: Env,
        id: BytesN<32>,
        from: Address,
        amount: i128,
    ) -> Result<(), AutoShareError>;

    /// Returns the amounts each member would receive without transferring tokens.
    ///
    /// Uses the same rounding and remainder allocation as [`Self::distribute`].
    fn get_member_shares(env: Env, group_id: BytesN<32>, total_amount: i128) -> Vec<i128>;

    /// Returns `total * percentage / 10_000` for arbitrary preview inputs.
    fn get_calculated_share(env: Env, total: i128, percentage: u32) -> i128;

    /// Returns the sum of a group's member percentages in basis points.
    fn get_total_percentage(env: Env, group_id: BytesN<32>) -> u32;
}
