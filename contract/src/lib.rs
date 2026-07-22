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
mod test;

use base::auth::{
    require_group_creator, validate_amount, validate_group_exists, validate_members_unique,
    validate_percentages,
};
use base::errors::AutoShareError;
use base::events;
use base::types::{AutoShareDetails, DataKey, GroupMember};
use interfaces::autoshare::AutoShareTrait;

mod contract_impl {
    #![allow(missing_docs)]

    use super::*;

    #[contract]
    /// Persistent payment-sharing group contract.
    pub struct AutoShareContract;

    #[contractimpl]
    impl AutoShareTrait for AutoShareContract {
        /// Creates an empty AutoShare group.
        ///
        /// The `creator` must authorize the call. The group is stored under `id`
        /// and indexed under the creator's address.
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
        /// Returns [`AutoShareError::GroupAlreadyExists`] when `id` is already stored.
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
        /// Returns [`AutoShareError::GroupNotFound`],
        /// [`AutoShareError::Unauthorized`], [`AutoShareError::EmptyMembers`],
        /// [`AutoShareError::DuplicateMember`], or
        /// [`AutoShareError::InvalidPercentage`] when the corresponding validation
        /// fails.
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
            let mut details = validate_group_exists(&env, &id)?;

            require_group_creator(&env, &details, &caller)?;
            validate_members_unique(&new_members)?;
            validate_percentages(&new_members)?;

            let count = new_members.len();
            details.members = new_members;
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
                if let Some(details) = env.storage().persistent().get(&DataKey::Group(id)) {
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
        /// Returns [`AutoShareError::InvalidAmount`],
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
                token_client.transfer(&from, &member.address, &share);
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
            let details: AutoShareDetails = env
                .storage()
                .persistent()
                .get(&DataKey::Group(group_id))
                .expect("group not found");

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
            base::utils::calculate_share(total, percentage)
        }

        /// Returns the sum of all member percentages for a group.
        ///
        /// The result is in basis points. A valid configured group returns `10_000`.
        ///
        /// # Panics
        ///
        /// Panics when `group_id` is not stored.
        fn get_total_percentage(env: Env, group_id: BytesN<32>) -> u32 {
            let details: AutoShareDetails = env
                .storage()
                .persistent()
                .get(&DataKey::Group(group_id))
                .expect("group not found");

            let mut sum: u32 = 0;
            for member in details.members.iter() {
                sum = sum.saturating_add(member.percentage);
            }
            sum
        }
    }
}

/// Deployable AutoShare Soroban contract.
pub use contract_impl::AutoShareContract;
/// Generated client for invoking [`AutoShareContract`].
pub use contract_impl::AutoShareContractClient;
