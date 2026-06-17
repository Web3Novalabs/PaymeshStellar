use soroban_sdk::{Address, BytesN, Env, String, Vec};

use crate::base::types::{AutoShareDetails, GroupMember};

pub trait AutoShareTrait {
    fn create(
        env: Env,
        id: BytesN<32>,
        name: String,
        creator: Address,
        usage_count: u32,
        payment_token: Address,
    );

    fn update_members(env: Env, id: BytesN<32>, caller: Address, new_members: Vec<GroupMember>);

    fn get(env: Env, id: BytesN<32>) -> AutoShareDetails;

    fn get_groups_by_creator(env: Env, creator: Address) -> Vec<AutoShareDetails>;

    fn distribute(env: Env, caller: Address, group_id: BytesN<32>, total_amount: i128);
}
