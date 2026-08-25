//! Event publishers for contract state changes and token distributions.

use soroban_sdk::{Address, BytesN, Env};

/// Publishes an `("autoshare", "created")` event.
///
/// Topics are `"autoshare"` and `"created"`. The payload is `(id, creator)`.
pub fn group_created(env: &Env, id: &BytesN<32>, creator: &Address) {
    env.events()
        .publish(("autoshare", "created"), (id.clone(), creator.clone()));
}

/// Publishes an `("autoshare", "members_updated")` event.
///
/// Topics are `"autoshare"` and `"members_updated"`. The payload is
/// `(id, member_count)`.
pub fn members_updated(env: &Env, id: &BytesN<32>, member_count: u32) {
    env.events()
        .publish(("autoshare", "members_updated"), (id.clone(), member_count));
}

/// Publishes an `("autoshare", "member_added")` event.
pub fn member_added(env: &Env, id: &BytesN<32>, address: &Address, old_bps: u32, new_bps: u32) {
    env.events().publish(
        ("autoshare", "member_added"),
        (id.clone(), address.clone(), old_bps, new_bps),
    );
}

/// Publishes an `("autoshare", "member_removed")` event.
pub fn member_removed(env: &Env, id: &BytesN<32>, address: &Address, old_bps: u32, new_bps: u32) {
    env.events().publish(
        ("autoshare", "member_removed"),
        (id.clone(), address.clone(), old_bps, new_bps),
    );
}

/// Publishes an `("autoshare", "member_percentage_updated")` event.
pub fn member_percentage_updated(
    env: &Env,
    id: &BytesN<32>,
    address: &Address,
    old_bps: u32,
    new_bps: u32,
) {
    env.events().publish(
        ("autoshare", "member_percentage_updated"),
        (id.clone(), address.clone(), old_bps, new_bps),
    );
}

/// Publishes an `("autoshare", "distributed")` event.
///
/// Topics are `"autoshare"` and `"distributed"`. The payload is
/// `(id, from, amount)`.
pub fn distributed(env: &Env, id: &BytesN<32>, from: &Address, amount: i128) {
    env.events().publish(
        ("autoshare", "distributed"),
        (id.clone(), from.clone(), amount),
    );
}

/// Publishes an `("autoshare", "upgraded")` event.
///
/// Topics are `"autoshare"` and `"upgraded"`. The payload is the new WASM hash.
pub fn upgraded(env: &Env, new_wasm_hash: &BytesN<32>) {
    env.events()
        .publish(("autoshare", "upgraded"), new_wasm_hash.clone());
}

/// Publishes an `("autoshare", "migrated")` event.
///
/// Topics are `"autoshare"` and `"migrated"`. The payload is
/// `(migrated_count, remaining_count)`.
pub fn migrated(env: &Env, migrated_count: u32, remaining_count: u32) {
    env.events()
        .publish(("autoshare", "migrated"), (migrated_count, remaining_count));
}

/// Publishes an `("autoshare", "paused")` event.
pub fn paused(env: &Env) {
    env.events().publish(("autoshare", "paused"), ());
}

/// Publishes an `("autoshare", "unpaused")` event.
pub fn unpaused(env: &Env) {
    env.events().publish(("autoshare", "unpaused"), ());
}

/// Publishes an `("autoshare", "initialized")` event.
pub fn initialized(env: &Env, admin: &Address) {
    env.events()
        .publish(("autoshare", "initialized"), admin.clone());
}

/// Publishes an `("autoshare", "admin_proposed")` event.
pub fn admin_proposed(env: &Env, new_admin: &Address) {
    env.events()
        .publish(("autoshare", "admin_proposed"), new_admin.clone());
}

/// Publishes an `("autoshare", "admin_transferred")` event.
pub fn admin_transferred(env: &Env, old_admin: &Address, new_admin: &Address) {
    env.events().publish(
        ("autoshare", "admin_transferred"),
        (old_admin.clone(), new_admin.clone()),
    );
}

/// Publishes an `("autoshare", "escrow_deposited")` event.
///
/// Topics are `"autoshare"` and `"escrow_deposited"`. The payload is
/// `(id, from, amount)`, where `amount` is the total taken into custody.
pub fn escrow_deposited(env: &Env, id: &BytesN<32>, from: &Address, amount: i128) {
    env.events().publish(
        ("autoshare", "escrow_deposited"),
        (id.clone(), from.clone(), amount),
    );
}

/// Publishes an `("autoshare", "escrow_claimed")` event.
///
/// Topics are `"autoshare"` and `"escrow_claimed"`. The payload is
/// `(id, member, to, amount)`, where `member` is the credited address and `to`
/// is the address the tokens were sent to.
pub fn escrow_claimed(env: &Env, id: &BytesN<32>, member: &Address, to: &Address, amount: i128) {
    env.events().publish(
        ("autoshare", "escrow_claimed"),
        (id.clone(), member.clone(), to.clone(), amount),
    );
}

/// Publishes an `("autoshare", "schedule_created")` event.
///
/// Topics are `"autoshare"` and `"schedule_created"`. The payload is `(id, funder)`.
pub fn schedule_created(env: &Env, id: &BytesN<32>, funder: &Address) {
    env.events().publish(
        ("autoshare", "schedule_created"),
        (id.clone(), funder.clone()),
    );
}

/// Publishes an `("autoshare", "schedule_executed")` event.
///
/// Topics are `"autoshare"` and `"schedule_executed"`. The payload is `(id, run_index)`.
pub fn schedule_executed(env: &Env, id: &BytesN<32>, run_index: u32) {
    env.events()
        .publish(("autoshare", "schedule_executed"), (id.clone(), run_index));
}

/// Publishes an `("autoshare", "schedule_cancelled")` event.
///
/// Topics are `"autoshare"` and `"schedule_cancelled"`. The payload is the group `id`.
pub fn schedule_cancelled(env: &Env, id: &BytesN<32>) {
    env.events()
        .publish(("autoshare", "schedule_cancelled"), id.clone());
}

/// Publishes an `("autoshare", "schedule_completed")` event.
///
/// Topics are `"autoshare"` and `"schedule_completed"`. The payload is the group `id`.
pub fn schedule_completed(env: &Env, id: &BytesN<32>) {
    env.events()
        .publish(("autoshare", "schedule_completed"), id.clone());
}
