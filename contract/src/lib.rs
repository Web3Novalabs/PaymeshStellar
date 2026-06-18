#![no_std]
use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, String, Vec};

pub mod base;
pub mod interfaces;
mod test;

use base::events;
use base::types::{AutoShareDetails, DataKey, GroupMember};

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
    ) {
        creator.require_auth();

        if env.storage().persistent().has(&DataKey::Group(id.clone())) {
            panic!("group already exists");
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
    }

    pub fn update_members(
        env: Env,
        id: BytesN<32>,
        caller: Address,
        new_members: Vec<GroupMember>,
    ) {
        caller.require_auth();

        let key = DataKey::Group(id.clone());
        let mut details: AutoShareDetails = env
            .storage()
            .persistent()
            .get(&key)
            .expect("group not found");

        if details.creator != caller {
            panic!("only the creator can update members");
        }
        if base::utils::validate_percentages(&new_members).is_err() {
            panic!("percentages must sum to 10000");
        }

        let count = new_members.len();
        details.members = new_members;
        env.storage().persistent().set(&key, &details);

        events::members_updated(&env, &id, count);
    }

    pub fn get(env: Env, id: BytesN<32>) -> AutoShareDetails {
        env.storage()
            .persistent()
            .get(&DataKey::Group(id))
            .expect("group not found")
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

    pub fn distribute(env: Env, caller: Address, group_id: BytesN<32>, total_amount: i128) {
        caller.require_auth();

        if total_amount <= 0 {
            panic!("amount must be greater than zero");
        }

        let details: AutoShareDetails = env
            .storage()
            .persistent()
            .get(&DataKey::Group(group_id.clone()))
            .expect("group not found");

        let token_client = token::Client::new(&env, &details.payment_token);

        let contract_address = env.current_contract_address();
        let balance = token_client.balance(&caller);
        if balance < total_amount {
            panic!("insufficient balance");
        }

        // Transfer full amount from caller to contract first
        token_client.transfer(&caller, &contract_address, &total_amount);
        let shares = base::utils::distribute_amounts(&env, total_amount, &details.members)
            .expect("failed to distribute amounts");

        for (i, member) in details.members.iter().enumerate() {
            let share = shares.get(i as u32).unwrap();
            token_client.transfer(&contract_address, &member.address, &share);
        }

        events::distribution_processed(&env, &group_id, total_amount);
    }

    /// Returns the computed share each member would receive for `total_amount`,
    /// using the same floor-division + last-member-dust logic as `distribute`.
    /// This is a pure read: no tokens are moved.
    pub fn get_member_shares(env: Env, group_id: BytesN<32>, total_amount: i128) -> Vec<i128> {
        let details: AutoShareDetails = env
            .storage()
            .persistent()
            .get(&DataKey::Group(group_id))
            .expect("group not found");

        base::utils::distribute_amounts(&env, total_amount, &details.members)
            .expect("invalid group configuration")
    }

    /// Returns `total * percentage / 10_000` for any arbitrary inputs.
    /// Useful for ad-hoc share preview before calling distribute.
    pub fn get_calculated_share(_env: Env, total: i128, percentage: u32) -> i128 {
        base::utils::calculate_share(total, percentage)
    }

    /// Returns the sum of all member percentages (in basis points) for a group.
    /// A healthy group should always return 10000.
    pub fn get_total_percentage(env: Env, group_id: BytesN<32>) -> u32 {
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
