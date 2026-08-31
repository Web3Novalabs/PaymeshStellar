//! Abstract interface for AutoShare contract clients and implementations.

use soroban_sdk::{Address, BytesN, Env, String, Vec};

use crate::base::errors::AutoShareError;
use crate::base::types::{
    AutoShareDetails, GroupMember, MigrationProgress, RebalancePolicy, Schedule,
};

/// Operations exposed by an AutoShare-compatible contract.
pub trait AutoShareTrait {
    /// One-time contract initialization.
    ///
    /// Sets the admin, stamps the schema version, and initializes the paused
    /// flag to `false`. Returns [`AutoShareError::AlreadyInitialized`] on
    /// repeated calls.
    fn init(env: Env, admin: Address) -> Result<(), AutoShareError>;

    /// Proposes a new admin for the two-step handover.
    ///
    /// Admin-gated.
    fn propose_admin(env: Env, caller: Address, new_admin: Address) -> Result<(), AutoShareError>;

    /// Accepts the admin proposal, completing the handover.
    ///
    /// Only the pending admin may call this.
    fn accept_admin(env: Env, caller: Address) -> Result<(), AutoShareError>;

    /// Cancels an outstanding admin proposal.
    ///
    /// Admin-gated.
    fn cancel_admin_proposal(env: Env, caller: Address) -> Result<(), AutoShareError>;

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
        expected_version: u32,
    ) -> Result<(), AutoShareError>;

    /// Adds a new member to the group, redistributing basis points according to `policy`.
    fn add_member(
        env: Env,
        id: BytesN<32>,
        caller: Address,
        member: GroupMember,
        policy: RebalancePolicy,
        expected_version: u32,
    ) -> Result<(), AutoShareError>;

    /// Removes a member from the group, redistributing their basis points according to `policy`.
    fn remove_member(
        env: Env,
        id: BytesN<32>,
        caller: Address,
        address: Address,
        policy: RebalancePolicy,
        expected_version: u32,
    ) -> Result<(), AutoShareError>;

    /// Updates a member's percentage, redistributing the delta according to `policy`.
    fn set_member_percentage(
        env: Env,
        id: BytesN<32>,
        caller: Address,
        address: Address,
        new_bps: u32,
        policy: RebalancePolicy,
        expected_version: u32,
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

    /// Replaces the contract WASM with a new version.
    ///
    /// Admin-gated. The contract **must** be paused before upgrading. Emits
    /// an `("autoshare", "upgraded")` event on success.
    fn upgrade(env: Env, caller: Address, new_wasm_hash: BytesN<32>) -> Result<(), AutoShareError>;

    /// Migrates up to `limit` groups from the old schema to the current one.
    ///
    /// Admin-gated. Returns [`MigrationProgress`] with the number of groups
    /// migrated, remaining, and whether the job is done. When done, stamps the
    /// schema version to [`crate::base::types::CURRENT_SCHEMA_VERSION`].
    fn migrate(env: Env, caller: Address, limit: u32) -> Result<MigrationProgress, AutoShareError>;

    /// Returns the contract's stored schema version (0 if never initialized).
    fn schema_version(env: Env) -> u32;

    /// Pauses the contract. Admin-gated.
    fn pause(env: Env, caller: Address) -> Result<(), AutoShareError>;

    /// Unpauses the contract. Admin-gated.
    fn unpause(env: Env, caller: Address) -> Result<(), AutoShareError>;
    /// Takes custody of `amount` and credits it to the group's current members.
    ///
    /// The escrow counterpart to [`Self::distribute`]: one transfer in, and each
    /// member withdraws later via [`Self::claim`]. Credits are a snapshot of the
    /// member set at deposit time.
    fn deposit(env: Env, id: BytesN<32>, from: Address, amount: i128)
        -> Result<(), AutoShareError>;

    /// Pays a member's full accrued escrow balance out to themselves.
    ///
    /// Returns the amount transferred.
    fn claim(env: Env, id: BytesN<32>, member: Address) -> Result<i128, AutoShareError>;

    /// Pays a member's full accrued escrow balance out to another address.
    ///
    /// Returns the amount transferred. Only `member` authorizes the call.
    fn claim_to(
        env: Env,
        id: BytesN<32>,
        member: Address,
        to: Address,
    ) -> Result<i128, AutoShareError>;

    /// Returns the amount `member` may currently claim from the group.
    fn claimable_balance(env: Env, id: BytesN<32>, member: Address) -> i128;

    /// Returns the total amount held in escrow for the group.
    fn total_escrowed(env: Env, id: BytesN<32>) -> i128;

    /// Creates an automated token distribution schedule.
    ///
    /// The `caller` must be the group creator. A group may only have one schedule.
    fn create_schedule(
        env: Env,
        id: BytesN<32>,
        caller: Address,
        interval_secs: u64,
        first_run_at: u64,
        runs: u32,
        amount: i128,
    ) -> Result<(), AutoShareError>;

    /// Executes a due automated token distribution schedule.
    ///
    /// This is a permissionless keeper call. Returns an error if not due or inactive.
    fn execute_schedule(env: Env, id: BytesN<32>, caller: Address) -> Result<(), AutoShareError>;

    /// Cancels an active schedule.
    ///
    /// The `caller` must be the group creator.
    fn cancel_schedule(env: Env, id: BytesN<32>, caller: Address) -> Result<(), AutoShareError>;

    /// Returns the schedule for a group, if any.
    fn get_schedule(env: Env, id: BytesN<32>) -> Result<Schedule, AutoShareError>;
}
