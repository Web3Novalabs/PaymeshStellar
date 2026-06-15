#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Vec};

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

        let mut total: u32 = 0;
        for m in new_members.iter() {
            total += m.percentage;
        }
        if total != 10000 {
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
}
