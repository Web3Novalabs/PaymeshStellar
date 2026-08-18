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
