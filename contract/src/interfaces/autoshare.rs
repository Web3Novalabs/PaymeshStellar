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

    fn distribute(env: Env, id: BytesN<32>, from: Address, amount: i128);

    /// Pure view: returns the share amounts each member of a group would receive
    /// for `total_amount`, applying the same rounding logic as `distribute`.
    /// Does NOT transfer any tokens.
    fn get_member_shares(env: Env, group_id: BytesN<32>, total_amount: i128) -> Vec<i128>;

    /// Pure view: returns `total * percentage / 10_000` for arbitrary inputs.
    fn get_calculated_share(env: Env, total: i128, percentage: u32) -> i128;

    /// Pure view: returns the total percentage (basis points) of all members in a group.
    fn get_total_percentage(env: Env, group_id: BytesN<32>) -> u32;
}
