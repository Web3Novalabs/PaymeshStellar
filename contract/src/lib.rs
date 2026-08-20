//! AutoShare Soroban contract.
//!
//! The contract stores payment-sharing groups, lets each group's creator manage
//! its members, and distributes a token amount according to member percentages.
//! Percentages are expressed in basis points, where `10_000` equals 100%.

#![no_std]
#![deny(missing_docs)]

use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, String, Vec};

/// Shared data types, errors, events, validation, and distribution utilities.
pub mod base;
/// Public contract interface definitions.
pub mod interfaces;
#[cfg(test)]
mod prop_tests;
#[cfg(test)]
mod test;
#[cfg(test)]
mod test_schedule;

use base::auth::{
    require_admin, require_group_creator, require_migration_current, require_not_paused,
    require_paused, validate_amount, validate_group_exists, validate_members_unique,
    validate_percentages,
};
use base::errors::AutoShareError;
use base::events;
use base::types::{
    AutoShareDetails, AutoShareDetailsV1, DataKey, GroupMember, MigrationProgress, Schedule,
    CURRENT_SCHEMA_VERSION, MAX_CATCHUP,
};
use interfaces::autoshare::AutoShareTrait;

mod contract_impl {
    #![allow(missing_docs)]

    use super::*;

    #[contract]
    /// Persistent payment-sharing group contract.
    pub struct AutoShareContract;

    #[contractimpl]
    impl AutoShareTrait for AutoShareContract {
        /// Initializes the contract with an admin and stamps the initial schema version.
        ///
        /// # Parameters
        ///
        /// - `env`: Soroban execution environment.
        /// - `admin`: Address granted administrator privileges.
        ///
        /// # Errors
        ///
        /// Returns [`AutoShareError::AlreadyInitialized`] if already initialized.
        fn init(env: Env, admin: Address) -> Result<(), AutoShareError> {
            if env.storage().instance().has(&DataKey::Admin) {
                return Err(AutoShareError::AlreadyInitialized);
            }

            env.storage().instance().set(&DataKey::Admin, &admin);
            env.storage()
                .instance()
                .set(&DataKey::SchemaVersion, &CURRENT_SCHEMA_VERSION);
            env.storage().instance().set(&DataKey::Paused, &false);

            Ok(())
        }

        /// Creates an empty AutoShare group.
        ///
        /// The `creator` must authorize the call. The group is stored under `id`,
        /// indexed under the creator's address, and added to the global group index.
        ///
        /// # Parameters
        ///
        /// - `env`: Soroban execution environment.
        /// - `id`: Unique 32-byte group identifier.
        /// - `name`: Human-readable group name.
        /// - `creator`: Address authorized to update the group's members.
        /// - `usage_count`: Application-defined usage metadata stored with the group.
        /// - `payment_token`: Token contract used by `distribute`.
        ///
        /// # Errors
        ///
        /// Returns [`AutoShareError::MigrationRequired`] when an upgrade migration is pending,
        /// or [`AutoShareError::GroupAlreadyExists`] when `id` is already stored.
        ///
        /// # Panics
        ///
        /// Soroban aborts the invocation if `creator` does not authorize the call.
        fn create(
            env: Env,
            id: BytesN<32>,
            name: String,
            creator: Address,
            usage_count: u32,
            payment_token: Address,
        ) -> Result<(), AutoShareError> {
            require_migration_current(&env)?;
            creator.require_auth();

            if env.storage().persistent().has(&DataKey::Group(id.clone())) {
                return Err(AutoShareError::GroupAlreadyExists);
            }

            let details = AutoShareDetails {
                id: id.clone(),
                name: name.clone(),
                creator: creator.clone(),
                usage_count,
                payment_token,
                members: Vec::new(&env),
                version: CURRENT_SCHEMA_VERSION,
            };

            env.storage()
                .persistent()
                .set(&DataKey::Group(id.clone()), &details);

            let key = DataKey::CreatorGroups(creator.clone());
            let mut ids: Vec<BytesN<32>> = env
                .storage()
                .persistent()
                .get(&key)
                .unwrap_or(Vec::new(&env));
            ids.push_back(id.clone());
            env.storage().persistent().set(&key, &ids);

            // Maintain global group index for enumeration and migrations
            let all_groups_key = DataKey::AllGroups;
            let mut all_ids: Vec<BytesN<32>> = env
                .storage()
                .persistent()
                .get(&all_groups_key)
                .unwrap_or(Vec::new(&env));
            all_ids.push_back(id.clone());
            env.storage().persistent().set(&all_groups_key, &all_ids);

            events::group_created(&env, &id, &creator);
            Ok(())
        }

        /// Replaces all members of an existing group.
        ///
        /// The `caller` must authorize the invocation and must be the stored group
        /// creator. Member addresses must be unique, the list must be non-empty, and
        /// percentages must be non-zero and total exactly `10_000` basis points.
        ///
        /// # Parameters
        ///
        /// - `env`: Soroban execution environment.
        /// - `id`: Identifier of the group to update.
        /// - `caller`: Address requesting the update.
        /// - `new_members`: Complete replacement member list.
        ///
        /// # Errors
        ///
        /// Returns [`AutoShareError::MigrationRequired`], [`AutoShareError::GroupNotFound`],
        /// [`AutoShareError::Unauthorized`], [`AutoShareError::EmptyMembers`],
        /// [`AutoShareError::DuplicateMember`], or
        /// [`AutoShareError::InvalidPercentage`] when validation fails.
        ///
        /// # Panics
        ///
        /// Soroban aborts the invocation if `caller` does not authorize the call.
        fn update_members(
            env: Env,
            id: BytesN<32>,
            caller: Address,
            new_members: Vec<GroupMember>,
        ) -> Result<(), AutoShareError> {
            require_migration_current(&env)?;

            let mut details = validate_group_exists(&env, &id)?;

            require_group_creator(&env, &details, &caller)?;
            validate_members_unique(&new_members)?;
            validate_percentages(&new_members)?;

            let count = new_members.len();
            details.members = new_members;
            details.version = CURRENT_SCHEMA_VERSION;
            env.storage()
                .persistent()
                .set(&DataKey::Group(id.clone()), &details);

            events::members_updated(&env, &id, count);
            Ok(())
        }

        /// Returns the stored details for a group.
        ///
        /// # Errors
        ///
        /// Returns [`AutoShareError::GroupNotFound`] when `id` is not stored.
        fn get(env: Env, id: BytesN<32>) -> Result<AutoShareDetails, AutoShareError> {
            validate_group_exists(&env, &id)
        }

        /// Returns every currently stored group created by `creator`.
        ///
        /// Missing group records referenced by the creator index are skipped. This
        /// function does not require authentication.
        fn get_groups_by_creator(env: Env, creator: Address) -> Vec<AutoShareDetails> {
            let key = DataKey::CreatorGroups(creator);
            let ids: Vec<BytesN<32>> = env
                .storage()
                .persistent()
                .get(&key)
                .unwrap_or(Vec::new(&env));

            let mut result: Vec<AutoShareDetails> = Vec::new(&env);
            for id in ids.iter() {
                if let Ok(details) = validate_group_exists(&env, &id) {
                    result.push_back(details);
                }
            }
            result
        }

        /// Transfers `amount` of the group's payment token among its members.
        ///
        /// The `from` address must authorize the call. Each member receives their
        /// basis-point share; integer division dust is assigned to the final member
        /// so the transferred shares sum exactly to `amount`.
        ///
        /// # Parameters
        ///
        /// - `env`: Soroban execution environment.
        /// - `id`: Identifier of the group whose split should be used.
        /// - `from`: Token holder funding the distribution.
        /// - `amount`: Positive token amount to distribute.
        ///
        /// # Errors
        ///
        /// Returns [`AutoShareError::MigrationRequired`], [`AutoShareError::InvalidAmount`],
        /// [`AutoShareError::GroupNotFound`], [`AutoShareError::EmptyMembers`], or
        /// [`AutoShareError::InsufficientBalance`] when validation fails.
        ///
        /// # Panics
        ///
        /// Soroban aborts if `from` does not authorize the call or if the token
        /// contract rejects a transfer. Internal distribution failures also abort
        /// because stored groups are expected to have been validated on update.
        fn distribute(
            env: Env,
            id: BytesN<32>,
            from: Address,
            amount: i128,
        ) -> Result<(), AutoShareError> {
            require_migration_current(&env)?;
            from.require_auth();

            validate_amount(amount)?;

            let details = validate_group_exists(&env, &id)?;

            if details.members.is_empty() {
                return Err(AutoShareError::EmptyMembers);
            }

            let token_client = token::Client::new(&env, &details.payment_token);

            let balance = token_client.balance(&from);
            if balance < amount {
                return Err(AutoShareError::InsufficientBalance);
            }

            let shares = base::utils::distribute_amounts(&env, amount, &details.members)
                .expect("failed to distribute amounts");

            for (i, member) in details.members.iter().enumerate() {
                let share = shares.get(i as u32).unwrap();
                // Skip zero-value transfers: they move no tokens but still cost
                // resource fees as a cross-contract call.
                if share > 0 {
                    token_client.transfer(&from, &member.address, &share);
                }
            }

            events::distributed(&env, &id, &from, amount);
            Ok(())
        }

        /// Returns the share each group member would receive for `total_amount`.
        ///
        /// This read-only preview uses the same floor-division and final-member dust
        /// allocation as `distribute`. No tokens are transferred.
        ///
        /// # Panics
        ///
        /// Panics when `group_id` is not stored or its persisted member percentages
        /// are invalid.
        fn get_member_shares(env: Env, group_id: BytesN<32>, total_amount: i128) -> Vec<i128> {
            let details = validate_group_exists(&env, &group_id).expect("group not found");

            base::utils::distribute_amounts(&env, total_amount, &details.members)
                .expect("invalid group configuration")
        }

        /// Calculates `total * percentage / 10_000` for an arbitrary preview.
        ///
        /// `percentage` is expressed in basis points, where `10_000` equals 100%.
        ///
        /// # Panics
        ///
        /// Panics if multiplying `total` by `percentage` overflows `i128`.
        fn get_calculated_share(_env: Env, total: i128, percentage: u32) -> i128 {
            // `calculate_share` returns a typed error now, but this entrypoint's
            // trait signature is still `-> i128`, so an out-of-range preview
            // aborts exactly as the doc comment above says. Widening it to
            // `Result<i128, AutoShareError>` is an ABI change and is left to
            // whoever owns that refactor.
            base::utils::calculate_share(total, percentage).expect("overflow in calculate_share")
        }

        /// Returns the sum of all member percentages for a group.
        ///
        /// The result is in basis points. A valid configured group returns `10_000`.
        ///
        /// # Panics
        ///
        /// Panics when `group_id` is not stored.
        fn get_total_percentage(env: Env, group_id: BytesN<32>) -> u32 {
            let details = validate_group_exists(&env, &group_id).expect("group not found");

            let mut sum: u32 = 0;
            for member in details.members.iter() {
                sum = sum.saturating_add(member.percentage);
            }
            sum
        }

        /// Upgrades the contract WASM executable to a new hash.
        ///
        /// The caller must be the contract admin, and the contract must be paused.
        ///
        /// # Parameters
        ///
        /// - `env`: Soroban execution environment.
        /// - `caller`: Admin address authorizing the upgrade.
        /// - `new_wasm_hash`: 32-byte hash of the newly installed WASM.
        ///
        /// # Errors
        ///
        /// Returns [`AutoShareError::Unauthorized`] if `caller` is not admin,
        /// or [`AutoShareError::ContractNotPaused`] if the contract is active.
        fn upgrade(
            env: Env,
            caller: Address,
            new_wasm_hash: BytesN<32>,
        ) -> Result<(), AutoShareError> {
            require_admin(&env, &caller)?;
            require_paused(&env)?;

            env.deployer()
                .update_current_contract_wasm(new_wasm_hash.clone());
            events::upgraded(&env, &new_wasm_hash);
            Ok(())
        }

        /// Performs batched migration of stored groups to [`CURRENT_SCHEMA_VERSION`].
        ///
        /// The caller must be the contract admin. Processes up to `limit` groups
        /// per call using a persisted cursor.
        ///
        /// # Parameters
        ///
        /// - `env`: Soroban execution environment.
        /// - `caller`: Admin address authorizing the migration.
        /// - `limit`: Maximum number of groups to migrate in this transaction.
        ///
        /// # Errors
        ///
        /// Returns [`AutoShareError::Unauthorized`] if `caller` is not admin,
        /// or [`AutoShareError::NothingToMigrate`] if already at the current schema version.
        fn migrate(
            env: Env,
            caller: Address,
            limit: u32,
        ) -> Result<MigrationProgress, AutoShareError> {
            require_admin(&env, &caller)?;

            let current_schema: u32 = env
                .storage()
                .instance()
                .get(&DataKey::SchemaVersion)
                .unwrap_or(0);

            if current_schema == CURRENT_SCHEMA_VERSION {
                return Err(AutoShareError::NothingToMigrate);
            }

            let all_ids: Vec<BytesN<32>> = env
                .storage()
                .persistent()
                .get(&DataKey::AllGroups)
                .unwrap_or(Vec::new(&env));

            let total_groups = all_ids.len();
            let cursor: u32 = env
                .storage()
                .instance()
                .get(&DataKey::MigrationCursor)
                .unwrap_or(0);

            if total_groups == 0 || cursor >= total_groups {
                env.storage()
                    .instance()
                    .set(&DataKey::SchemaVersion, &CURRENT_SCHEMA_VERSION);
                env.storage().instance().remove(&DataKey::MigrationCursor);
                events::migrated(&env, 0, 0);
                return Ok(MigrationProgress {
                    migrated: 0,
                    remaining: 0,
                    done: true,
                });
            }

            let end = (cursor + limit).min(total_groups);
            let mut count: u32 = 0;

            use soroban_sdk::{Map, TryFromVal, Val};

            for i in cursor..end {
                let id = all_ids.get(i).unwrap();
                let key = DataKey::Group(id.clone());

                if let Some(val) = env.storage().persistent().get::<DataKey, Val>(&key) {
                    if let Ok(map) = Map::<Val, Val>::try_from_val(&env, &val) {
                        if map.len() == 6 {
                            if let Ok(v1) = AutoShareDetailsV1::try_from_val(&env, &val) {
                                let v2 = AutoShareDetails {
                                    id: v1.id,
                                    name: v1.name,
                                    creator: v1.creator,
                                    usage_count: v1.usage_count,
                                    payment_token: v1.payment_token,
                                    members: v1.members,
                                    version: CURRENT_SCHEMA_VERSION,
                                };
                                env.storage().persistent().set(&key, &v2);
                            }
                        } else if map.len() == 7 {
                            if let Ok(mut v2) = AutoShareDetails::try_from_val(&env, &val) {
                                if v2.version != CURRENT_SCHEMA_VERSION {
                                    v2.version = CURRENT_SCHEMA_VERSION;
                                    env.storage().persistent().set(&key, &v2);
                                }
                            }
                        }
                    }
                }
                count += 1;
            }

            let new_cursor = end;
            let remaining = total_groups - new_cursor;
            let done = remaining == 0;

            if done {
                env.storage()
                    .instance()
                    .set(&DataKey::SchemaVersion, &CURRENT_SCHEMA_VERSION);
                env.storage().instance().remove(&DataKey::MigrationCursor);
            } else {
                env.storage()
                    .instance()
                    .set(&DataKey::MigrationCursor, &new_cursor);
            }

            events::migrated(&env, count, remaining);

            Ok(MigrationProgress {
                migrated: count,
                remaining,
                done,
            })
        }

        /// Returns the current schema version stamped in contract instance storage.
        fn schema_version(env: Env) -> u32 {
            env.storage()
                .instance()
                .get(&DataKey::SchemaVersion)
                .unwrap_or(0)
        }

        /// Pauses the contract, allowing administrative maintenance and upgrades.
        ///
        /// # Errors
        ///
        /// Returns [`AutoShareError::Unauthorized`] if `caller` is not admin.
        fn pause(env: Env, caller: Address) -> Result<(), AutoShareError> {
            require_admin(&env, &caller)?;
            env.storage().instance().set(&DataKey::Paused, &true);
            events::paused(&env);
            Ok(())
        }

        /// Unpauses the contract, resuming normal operation.
        ///
        /// # Errors
        ///
        /// Returns [`AutoShareError::Unauthorized`] if `caller` is not admin.
        fn unpause(env: Env, caller: Address) -> Result<(), AutoShareError> {
            require_admin(&env, &caller)?;
            env.storage().instance().set(&DataKey::Paused, &false);
            events::unpaused(&env);
            Ok(())
        }

        /// Takes custody of `amount` and credits it across the group's members.
        ///
        /// The pull-payment counterpart to [`Self::distribute`]. The tokens move
        /// in a single transfer from `from` to this contract, and each member is
        /// credited their basis-point share using the same floor-plus-dust math
        /// as `distribute`, so no stroops are lost across repeated deposits.
        ///
        /// Credits are a **snapshot** of the member set at deposit time. A later
        /// `update_members` never moves an already-credited balance, and a member
        /// removed from the group keeps whatever they had accrued.
        ///
        /// Every write extends the touched entry's TTL — see
        /// [`base::escrow`] for the policy and its rent cost.
        ///
        /// # Parameters
        ///
        /// - `env`: Soroban execution environment.
        /// - `id`: Identifier of the group to credit.
        /// - `from`: Token holder funding the escrow.
        /// - `amount`: Positive token amount to take into custody.
        ///
        /// # Errors
        ///
        /// Returns [`AutoShareError::InvalidAmount`],
        /// [`AutoShareError::GroupNotFound`], [`AutoShareError::EmptyMembers`],
        /// [`AutoShareError::InsufficientBalance`], or
        /// [`AutoShareError::InvalidPercentage`]. No tokens move unless every
        /// validation passes.
        ///
        /// # Panics
        ///
        /// Soroban aborts if `from` does not authorize the call or if the token
        /// contract rejects the transfer.
        fn deposit(
            env: Env,
            id: BytesN<32>,
            from: Address,
            amount: i128,
        ) -> Result<(), AutoShareError> {
            base::escrow::deposit(&env, &id, &from, amount)
        }

        /// Pays `member`'s full accrued escrow balance out to themselves.
        ///
        /// Returns the amount transferred. The member's entry is cleared before
        /// the token transfer, so a reentrant token contract observes a zero
        /// balance and cannot be paid twice.
        ///
        /// # Errors
        ///
        /// Returns [`AutoShareError::GroupNotFound`],
        /// [`AutoShareError::NothingToClaim`] when a current member has no
        /// balance left (a second claim included), or
        /// [`AutoShareError::MemberNotFound`] when the address holds no balance
        /// and is not a member. Neither error moves tokens.
        ///
        /// # Panics
        ///
        /// Soroban aborts if `member` does not authorize the call.
        fn claim(env: Env, id: BytesN<32>, member: Address) -> Result<i128, AutoShareError> {
            base::escrow::claim(&env, &id, &member)
        }

        /// Pays `member`'s full accrued escrow balance out to `to`.
        ///
        /// Identical to [`Self::claim`] except for the destination. Only
        /// `member` authorizes the call; `to` is an arbitrary payout address.
        ///
        /// # Errors
        ///
        /// See [`Self::claim`].
        ///
        /// # Panics
        ///
        /// Soroban aborts if `member` does not authorize the call.
        fn claim_to(
            env: Env,
            id: BytesN<32>,
            member: Address,
            to: Address,
        ) -> Result<i128, AutoShareError> {
            base::escrow::claim_to(&env, &id, &member, &to)
        }

        /// Returns the amount `member` may currently claim from group `id`.
        ///
        /// Returns `0` for an unknown group, an uncredited address, or a member
        /// who has already claimed.
        fn claimable_balance(env: Env, id: BytesN<32>, member: Address) -> i128 {
            base::escrow::claimable_balance(&env, &id, &member)
        }

        /// Returns the total amount held in escrow for group `id`.
        ///
        /// Always equal to the sum of the group's outstanding claimable balances.
        fn total_escrowed(env: Env, id: BytesN<32>) -> i128 {
            base::escrow::total_escrowed(&env, &id)
        }

        fn create_schedule(
            env: Env,
            id: BytesN<32>,
            caller: Address,
            interval_secs: u64,
            first_run_at: u64,
            runs: u32,
            amount: i128,
        ) -> Result<(), AutoShareError> {
            require_not_paused(&env)?;
            require_migration_current(&env)?;

            let details = validate_group_exists(&env, &id)?;
            require_group_creator(&env, &details, &caller)?;

            if interval_secs == 0 || runs == 0 {
                panic!("interval and runs must be positive");
            }
            if first_run_at < env.ledger().timestamp() {
                panic!("first_run_at must be in the future");
            }
            validate_amount(amount)?;

            let key = DataKey::Schedule(id.clone());
            if env.storage().persistent().has(&key) {
                return Err(AutoShareError::ScheduleAlreadyExists);
            }

            let schedule = Schedule {
                interval_secs,
                next_run_at: first_run_at,
                remaining_runs: runs,
                amount,
                funder: caller.clone(),
                active: true,
            };

            env.storage().persistent().set(&key, &schedule);
            events::schedule_created(&env, &id, &caller);
            Ok(())
        }

        fn execute_schedule(
            env: Env,
            id: BytesN<32>,
            caller: Address,
        ) -> Result<(), AutoShareError> {
            require_not_paused(&env)?;
            require_migration_current(&env)?;

            caller.require_auth(); // Keeper

            let key = DataKey::Schedule(id.clone());
            let mut schedule: Schedule = env
                .storage()
                .persistent()
                .get(&key)
                .expect("schedule not found");

            if !schedule.active {
                return Err(AutoShareError::ScheduleInactive);
            }

            let now = env.ledger().timestamp();
            if now < schedule.next_run_at {
                return Err(AutoShareError::ScheduleNotDue);
            }

            schedule.funder.require_auth();

            let details = validate_group_exists(&env, &id).expect("group not found");

            if details.members.is_empty() {
                return Err(AutoShareError::EmptyMembers);
            }

            let runs_due = ((now - schedule.next_run_at) / schedule.interval_secs) as u32 + 1;
            let runs_to_execute = runs_due.min(MAX_CATCHUP).min(schedule.remaining_runs);

            let token_client = token::Client::new(&env, &details.payment_token);
            let total_amount = schedule
                .amount
                .checked_mul(runs_to_execute as i128)
                .expect("amount overflow");

            if token_client.balance(&schedule.funder) < total_amount {
                return Err(AutoShareError::InsufficientBalance);
            }

            for _ in 0..runs_to_execute {
                let shares =
                    base::utils::distribute_amounts(&env, schedule.amount, &details.members)
                        .expect("failed to distribute amounts");

                for (i, member) in details.members.iter().enumerate() {
                    let share = shares.get(i as u32).unwrap();
                    if share > 0 {
                        token_client.transfer(&schedule.funder, &member.address, &share);
                    }
                }

                events::schedule_executed(&env, &id, schedule.remaining_runs);
                schedule.remaining_runs -= 1;
            }

            let intervals_passed = (now - schedule.next_run_at) / schedule.interval_secs;
            schedule.next_run_at += (intervals_passed + 1) * schedule.interval_secs;

            if schedule.remaining_runs == 0 {
                schedule.active = false;
                events::schedule_completed(&env, &id);
            }

            env.storage().persistent().set(&key, &schedule);
            Ok(())
        }

        fn cancel_schedule(
            env: Env,
            id: BytesN<32>,
            caller: Address,
        ) -> Result<(), AutoShareError> {
            require_not_paused(&env)?;
            require_migration_current(&env)?;

            let details = validate_group_exists(&env, &id)?;
            require_group_creator(&env, &details, &caller)?;

            let key = DataKey::Schedule(id.clone());
            let mut schedule: Schedule = env
                .storage()
                .persistent()
                .get(&key)
                .expect("schedule not found");

            schedule.active = false;
            env.storage().persistent().set(&key, &schedule);
            events::schedule_cancelled(&env, &id);

            Ok(())
        }

        fn get_schedule(env: Env, id: BytesN<32>) -> Result<Schedule, AutoShareError> {
            let key = DataKey::Schedule(id);
            env.storage()
                .persistent()
                .get(&key)
                .ok_or(AutoShareError::GroupNotFound)
        }
    }
}

/// Deployable AutoShare Soroban contract.
pub use contract_impl::AutoShareContract;
/// Generated client for invoking [`AutoShareContract`].
pub use contract_impl::AutoShareContractClient;
