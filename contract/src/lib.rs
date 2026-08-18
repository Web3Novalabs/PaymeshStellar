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
mod test;

use base::auth::{
    require_admin, require_group_creator, require_migration_current, require_paused,
    validate_amount, validate_group_exists, validate_members_unique, validate_percentages,
};
use base::errors::AutoShareError;
use base::events;
use base::types::{
    AutoShareDetails, AutoShareDetailsV1, DataKey, GroupMember, MigrationProgress,
    CURRENT_SCHEMA_VERSION,
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

    pub fn update_members(
        env: Env,
        id: BytesN<32>,
        caller: Address,
        new_members: Vec<GroupMember>,
    ) -> Result<(), AutoShareError> {
        caller.require_auth();

        let mut details = validate_group_exists(&env, &id)?;

        validate_is_creator(&details.creator, &caller)?;
        validate_members_unique(&new_members)?;
        validate_percentages(&new_members)?;

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

    pub fn distribute(
        env: Env,
        id: BytesN<32>,
        from: Address,
        amount: i128,
    ) -> Result<(), AutoShareError> {
        from.require_auth();

        validate_amount(amount)?;

        let details = validate_group_exists(&env, &id)?;

        if details.members.is_empty() {
            return Err(AutoShareError::EmptyMembers);
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

        let balance = token_client.balance(&from);
        if balance < amount {
            return Err(AutoShareError::InsufficientBalance);
        }

        let shares = base::utils::distribute_amounts(&env, amount, &details.members)?;

        for (i, member) in details.members.iter().enumerate() {
            let share = shares.get(i as u32).unwrap();
            token_client.transfer(&from, &member.address, &share);
        }

        events::distributed(&env, &id, &from, amount);
        Ok(())
    }

    /// Returns the computed share each member would receive for `total_amount`,
    /// using the same floor-division + last-member-dust logic as `distribute`.
    /// This is a pure read: no tokens are moved.
    ///
    /// # Errors
    ///
    /// - [`AutoShareError::GroupNotFound`] if `group_id` does not exist.
    /// - [`AutoShareError::InvalidAmount`] if `total_amount` is negative or would
    ///   cause an arithmetic overflow.
    /// - [`AutoShareError::InvalidPercentage`] if the stored member configuration
    ///   is invalid (should not occur for a well-formed group).
    pub fn get_member_shares(
        env: Env,
        group_id: BytesN<32>,
        total_amount: i128,
    ) -> Result<Vec<i128>, AutoShareError> {
        let details = validate_group_exists(&env, &group_id)?;
        base::utils::distribute_amounts(&env, total_amount, &details.members)
    }

    /// Returns `total * percentage / 10_000` for any arbitrary inputs.
    /// Useful for ad-hoc share preview before calling `distribute`.
    ///
    /// # Errors
    ///
    /// Returns [`AutoShareError::InvalidAmount`] if the intermediate product
    /// `total * percentage` would overflow `i128`.
    pub fn get_calculated_share(
        _env: Env,
        total: i128,
        percentage: u32,
    ) -> Result<i128, AutoShareError> {
        base::utils::calculate_share(total, percentage)
    }

    /// Returns the sum of all member percentages (in basis points) for a group.
    /// A healthy group should always return 10 000.
    ///
    /// # Errors
    ///
    /// Returns [`AutoShareError::GroupNotFound`] if `group_id` does not exist.
    pub fn get_total_percentage(env: Env, group_id: BytesN<32>) -> Result<u32, AutoShareError> {
        let details = validate_group_exists(&env, &group_id)?;

        let mut sum: u32 = 0;
        for member in details.members.iter() {
            sum = sum.saturating_add(member.percentage);
        }
        Ok(sum)
    }
}

/// Deployable AutoShare Soroban contract.
pub use contract_impl::AutoShareContract;
/// Generated client for invoking [`AutoShareContract`].
pub use contract_impl::AutoShareContractClient;
