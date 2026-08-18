#![no_std]
use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, String, Vec};

pub mod base;
pub mod interfaces;
#[cfg(test)]
mod prop_tests;
mod test;

use base::errors::AutoShareError;
use base::events;
use base::types::{AutoShareDetails, DataKey, GroupMember};
use base::validators::{
    validate_amount, validate_group_exists, validate_is_creator, validate_members_unique,
    validate_percentages,
};

#[contract]
pub struct AutoShareContract;

#[contractimpl]
impl AutoShareContract {
    pub fn create(
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

        let count = new_members.len();
        details.members = new_members;
        env.storage()
            .persistent()
            .set(&DataKey::Group(id.clone()), &details);

        events::members_updated(&env, &id, count);
        Ok(())
    }

    pub fn get(env: Env, id: BytesN<32>) -> Result<AutoShareDetails, AutoShareError> {
        validate_group_exists(&env, &id)
    }

    pub fn get_groups_by_creator(env: Env, creator: Address) -> Vec<AutoShareDetails> {
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

        let token_client = token::Client::new(&env, &details.payment_token);

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
