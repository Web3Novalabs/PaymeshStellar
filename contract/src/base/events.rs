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
