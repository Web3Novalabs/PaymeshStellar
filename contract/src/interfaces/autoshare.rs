//! Abstract interface for AutoShare contract clients and implementations.

use soroban_sdk::{Address, BytesN, Env, String, Vec};

use crate::base::errors::AutoShareError;
use crate::base::types::{AutoShareDetails, GroupMember};

/// Operations exposed by an AutoShare-compatible contract.
pub trait AutoShareTrait {
    /// One-time contract initialization.
    ///
    /// Sets the admin, stamps the schema version, and initializes the paused
    /// flag to `false`. Returns [`AutoShareError::AlreadyInitialized`] on
    /// repeated calls.
    fn init(env: Env, admin: Address) -> Result<(), AutoShareError>;

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

    fn update_members(
        env: Env,
        id: BytesN<32>,
        caller: Address,
        new_members: Vec<GroupMember>,
    ) -> Result<(), AutoShareError>;

    fn get(env: Env, id: BytesN<32>) -> Result<AutoShareDetails, AutoShareError>;

    /// Returns all stored groups indexed to `creator`.
    fn get_groups_by_creator(env: Env, creator: Address) -> Vec<AutoShareDetails>;

    fn distribute(
        env: Env,
        id: BytesN<32>,
        from: Address,
        amount: i128,
    ) -> Result<(), AutoShareError>;

    /// Pure view: returns the share amounts each member of a group would receive
    /// for `total_amount`, applying the same rounding logic as `distribute`.
    /// Does NOT transfer any tokens.
    ///
    /// # Errors
    ///
    /// - [`AutoShareError::GroupNotFound`] if `group_id` does not exist.
    /// - [`AutoShareError::InvalidAmount`] if `total_amount` is negative or
    ///   causes an overflow in the intermediate multiplication.
    /// - [`AutoShareError::InvalidPercentage`] if stored member data is invalid.
    fn get_member_shares(
        env: Env,
        group_id: BytesN<32>,
        total_amount: i128,
    ) -> Result<Vec<i128>, AutoShareError>;

    /// Pure view: returns `total * percentage / 10_000` for arbitrary inputs.
    ///
    /// # Errors
    ///
    /// Returns [`AutoShareError::InvalidAmount`] if `total * percentage` overflows
    /// `i128`.
    fn get_calculated_share(env: Env, total: i128, percentage: u32)
        -> Result<i128, AutoShareError>;

    /// Pure view: returns the total percentage (basis points) of all members in
    /// a group.  A healthy group always returns 10 000.
    ///
    /// # Errors
    ///
    /// Returns [`AutoShareError::GroupNotFound`] if `group_id` does not exist.
    fn get_total_percentage(env: Env, group_id: BytesN<32>) -> Result<u32, AutoShareError>;
}
