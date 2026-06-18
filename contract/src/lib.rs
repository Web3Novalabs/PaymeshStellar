#![no_std]
use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, String, Vec};

pub mod base;
pub mod interfaces;
mod test;

use base::errors::AutoShareError;
use base::events;
use base::types::{AutoShareDetails, DataKey, GroupMember};
use base::validators::{
    validate_amount, validate_group_exists, validate_is_creator, validate_member_exists,
    validate_members_unique, validate_percentages,
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
        caller: Address,
        group_id: BytesN<32>,
        total_amount: i128,
    ) -> Result<(), AutoShareError> {
        caller.require_auth();

        validate_amount(total_amount)?;

        let details = validate_group_exists(&env, &group_id)?;

        let token_client = token::Client::new(&env, &details.payment_token);

        let contract_address = env.current_contract_address();
        let balance = token_client.balance(&caller);
        if balance < total_amount {
            return Err(AutoShareError::InsufficientBalance);
        }

        // Transfer full amount from caller to contract first
        token_client.transfer(&caller, &contract_address, &total_amount);

        let mut distributed: i128 = 0;
        let member_count = details.members.len();

        for (i, member) in details.members.iter().enumerate() {
            let share = if i as u32 == member_count - 1 {
                // Last member gets the remainder to handle rounding dust
                total_amount - distributed
            } else {
                total_amount * (member.percentage as i128) / 10000
            };
            token_client.transfer(&contract_address, &member.address, &share);
            distributed += share;
        }

        events::distribution_processed(&env, &group_id, total_amount);
        Ok(())
    }
}
