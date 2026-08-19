//! Pull-payment escrow: deposit once, let every member withdraw on their own schedule.
//!
//! `distribute` pushes tokens to every member inside a single invocation, which
//! makes the payer fund N cross-contract transfers and lets one unusable member
//! trustline abort an entire payroll run. The escrow flow inverts that:
//! [`deposit`] takes custody of the full amount in **one** transfer and records
//! what each member is owed, and [`claim_to`] pays a single member out when they
//! ask for it.
//!
//! # Snapshot semantics
//!
//! A deposit credits the member set *as of that deposit*. Balances live under
//! [`DataKey::Claimable`], keyed by `(group id, member address)` rather than by a
//! position in the group's member list, so a later [`crate::AutoShareContract`]
//! `update_members` call never moves funds that were already credited. Members
//! removed from a group keep whatever they had accrued and can still claim it.
//!
//! # Accounting invariant
//!
//! For every group, the sum of all claimable balances equals
//! [`total_escrowed`]. [`deposit`] adds the deposited amount to both sides at
//! once and [`claim_to`] subtracts the claimed amount from both, so the two can
//! only ever move together. [`sum_claimable`] and [`accounting_holds`] let tests
//! assert it directly against a known member set.
//!
//! # TTL policy
//!
//! Escrow entries are persistent, so an unclaimed balance would be archived once
//! its TTL ran out — a member claiming eleven months after a deposit must not
//! find their entry gone. Every write therefore extends the entry it touched,
//! plus the group record the claim path has to read and the contract's own
//! instance entry, to [`ESCROW_TTL_EXTEND_TO`] whenever the remaining TTL has
//! fallen below [`ESCROW_TTL_THRESHOLD`]. The instance matters as much as the
//! data: an archived instance cannot be invoked at all, so a live balance behind
//! a dead instance is still unreachable.
//!
//! The cost of that policy is rent: extending an entry to 120 days is charged to
//! whoever submits the transaction that triggers it, which here is the depositor
//! (one bump per credited member, plus the group total and the group record) or
//! the claimer (the group total and the group record). The threshold is set at
//! 30 days so a group that sees regular activity re-bumps at most once a month
//! instead of on every single call, while a group left completely idle still has
//! a four-month window in which any member can come back and claim without an
//! external `RestoreFootprint` operation.

use soroban_sdk::{token, Address, BytesN, Env, Vec};

use crate::base::auth::{is_member, validate_amount, validate_group_exists};
use crate::base::errors::AutoShareError;
use crate::base::events;
use crate::base::types::{AutoShareDetails, DataKey};
use crate::base::utils::distribute_amounts;

/// Ledgers closed in roughly one day at Stellar's ~5 second close rate.
pub const LEDGERS_PER_DAY: u32 = 17_280;

/// Remaining-TTL threshold below which an escrow entry is extended again.
///
/// Thirty days. Writes that find more TTL than this left do not pay to extend.
pub const ESCROW_TTL_THRESHOLD: u32 = 30 * LEDGERS_PER_DAY;

/// TTL an escrow entry is extended to when it falls below the threshold.
///
/// One hundred and twenty days, which is the window a member has to claim after
/// the last write touching their group before the entry can be archived.
pub const ESCROW_TTL_EXTEND_TO: u32 = 120 * LEDGERS_PER_DAY;

/// Extends a persistent entry using the escrow TTL policy.
fn bump(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, ESCROW_TTL_THRESHOLD, ESCROW_TTL_EXTEND_TO);
}

/// Extends the contract's own instance entry using the escrow TTL policy.
///
/// Live escrow data is worthless if the contract instance itself is archived —
/// an archived instance means the contract cannot be invoked at all, so nobody
/// could reach their balance. Every escrow write bumps it alongside the data.
fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(ESCROW_TTL_THRESHOLD, ESCROW_TTL_EXTEND_TO);
}

/// Returns the amount `member` may currently claim from group `id`.
///
/// Returns `0` for an address that was never credited, for a member whose share
/// rounded to zero, and for a member who has already claimed.
pub fn claimable_balance(env: &Env, id: &BytesN<32>, member: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Claimable(id.clone(), member.clone()))
        .unwrap_or(0)
}

/// Returns the total amount this contract still holds on behalf of group `id`.
pub fn total_escrowed(env: &Env, id: &BytesN<32>) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Escrowed(id.clone()))
        .unwrap_or(0)
}

/// Sums the claimable balances credited to `members` under group `id`.
///
/// Soroban cannot enumerate storage keys, so the caller supplies the address set
/// to total. Pass every address that has ever been a member of the group — any
/// address omitted is simply not counted.
pub fn sum_claimable(env: &Env, id: &BytesN<32>, members: &Vec<Address>) -> i128 {
    let mut sum: i128 = 0;
    for member in members.iter() {
        sum += claimable_balance(env, id, &member);
    }
    sum
}

/// Checks the escrow accounting invariant for a known member set.
///
/// Returns `true` when the balances credited to `members` sum exactly to
/// [`total_escrowed`] for the same group. See the module-level
/// "Accounting invariant" section.
pub fn accounting_holds(env: &Env, id: &BytesN<32>, members: &Vec<Address>) -> bool {
    sum_claimable(env, id, members) == total_escrowed(env, id)
}

/// Takes custody of `amount` and credits it across the group's current members.
///
/// The tokens move in a single transfer from `from` to this contract's address.
/// Each member is then credited using the same basis-point floor-division and
/// final-member dust allocation as
/// [`distribute_amounts`](crate::base::utils::distribute_amounts), so repeated
/// deposits never leak stroops.
///
/// Nothing is transferred unless every validation passes, so a group with no
/// members never causes the contract to take custody of tokens.
///
/// # Errors
///
/// Returns [`AutoShareError::InvalidAmount`] for a non-positive `amount`,
/// [`AutoShareError::GroupNotFound`] for an unknown group,
/// [`AutoShareError::EmptyMembers`] for a group with no members,
/// [`AutoShareError::InsufficientBalance`] when `from` cannot cover `amount`,
/// or [`AutoShareError::InvalidPercentage`] when the stored member percentages
/// do not total `10_000` basis points.
///
/// # Panics
///
/// Soroban aborts the invocation if `from` does not authorize the call or if the
/// token contract rejects the transfer. Panics if a credited balance would
/// overflow `i128`.
pub fn deposit(
    env: &Env,
    id: &BytesN<32>,
    from: &Address,
    amount: i128,
) -> Result<(), AutoShareError> {
    from.require_auth();

    validate_amount(amount)?;

    let details = validate_group_exists(env, id)?;

    // Checked before any transfer so a memberless group cannot leave tokens
    // stranded in the contract with nobody able to claim them.
    if details.members.is_empty() {
        return Err(AutoShareError::EmptyMembers);
    }

    let token_client = token::Client::new(env, &details.payment_token);
    if token_client.balance(from) < amount {
        return Err(AutoShareError::InsufficientBalance);
    }

    // Computed before taking custody: an invalid stored configuration must fail
    // the whole call rather than leave an uncreditable balance behind.
    let shares = distribute_amounts(env, amount, &details.members)?;

    token_client.transfer(from, &env.current_contract_address(), &amount);

    for (i, member) in details.members.iter().enumerate() {
        let share = shares.get(i as u32).unwrap();
        // A share that floors to zero adds no balance, so skip the write rather
        // than create an entry that costs rent and pays out nothing.
        if share == 0 {
            continue;
        }

        let key = DataKey::Claimable(id.clone(), member.address.clone());
        let credited = claimable_balance(env, id, &member.address)
            .checked_add(share)
            .expect("overflow crediting claimable balance");
        env.storage().persistent().set(&key, &credited);
        bump(env, &key);
    }

    let escrow_key = DataKey::Escrowed(id.clone());
    let escrowed = total_escrowed(env, id)
        .checked_add(amount)
        .expect("overflow crediting escrowed total");
    env.storage().persistent().set(&escrow_key, &escrowed);
    bump(env, &escrow_key);

    // The claim path has to read the group record and invoke this contract, so
    // both must outlive the funds.
    bump(env, &DataKey::Group(id.clone()));
    bump_instance(env);

    events::escrow_deposited(env, id, from, amount);
    Ok(())
}

/// Pays `member`'s full accrued balance for group `id` out to `to`.
///
/// `member` must authorize the call; `to` is only a destination and does not.
/// Returns the amount transferred.
///
/// State is settled before the token transfer: the member's entry is removed and
/// the group total decremented **first**, so a malicious or reentrant token
/// contract that calls back into this contract during `transfer` observes a zero
/// claimable balance and cannot be paid twice.
///
/// # Errors
///
/// Returns [`AutoShareError::GroupNotFound`] for an unknown group,
/// [`AutoShareError::NothingToClaim`] when a current member has no balance left
/// (including a second call after a successful claim), or
/// [`AutoShareError::MemberNotFound`] when the address holds no balance and is
/// not a member of the group. Neither error moves any tokens.
///
/// # Panics
///
/// Soroban aborts the invocation if `member` does not authorize the call or if
/// the token contract rejects the transfer.
pub fn claim_to(
    env: &Env,
    id: &BytesN<32>,
    member: &Address,
    to: &Address,
) -> Result<i128, AutoShareError> {
    member.require_auth();

    let details = validate_group_exists(env, id)?;

    // Effects first — see [`settle_claim`].
    let balance = settle_claim(env, id, member, &details)?;

    // ── interaction ─────────────────────────────────────────────────
    token::Client::new(env, &details.payment_token).transfer(
        &env.current_contract_address(),
        to,
        &balance,
    );

    events::escrow_claimed(env, id, member, to, balance);
    Ok(balance)
}

/// Applies the state changes of a claim and returns the amount now payable.
///
/// This is the "effects" half of [`claim_to`], split out so the write ordering is
/// directly observable: it clears the member's [`DataKey::Claimable`] entry and
/// decrements [`DataKey::Escrowed`] **without moving any tokens**. `claim_to` runs
/// it to completion before it calls the token contract, which is what stops a
/// reentrant token from being paid twice — by the time `transfer` runs there is no
/// balance left to claim. (Soroban also rejects reentry into a contract already on
/// the call stack, so this ordering is a second line of defence rather than the
/// only one.)
///
/// Callers are responsible for authorization; [`claim_to`] requires the member's
/// auth before calling this.
///
/// # Errors
///
/// Returns [`AutoShareError::NothingToClaim`] when a current member has no balance
/// left, or [`AutoShareError::MemberNotFound`] when the address holds no balance
/// and is not a member of the group. Both leave storage untouched.
pub fn settle_claim(
    env: &Env,
    id: &BytesN<32>,
    member: &Address,
    details: &AutoShareDetails,
) -> Result<i128, AutoShareError> {
    let key = DataKey::Claimable(id.clone(), member.clone());
    let balance = claimable_balance(env, id, member);

    if balance <= 0 {
        // A current member simply has nothing owed; anyone else was never part of
        // this group's payouts at all.
        return if is_member(details, member) {
            Err(AutoShareError::NothingToClaim)
        } else {
            Err(AutoShareError::MemberNotFound)
        };
    }

    env.storage().persistent().remove(&key);

    let escrow_key = DataKey::Escrowed(id.clone());
    let remaining = total_escrowed(env, id) - balance;
    if remaining > 0 {
        env.storage().persistent().set(&escrow_key, &remaining);
        bump(env, &escrow_key);
    } else {
        env.storage().persistent().remove(&escrow_key);
    }

    bump(env, &DataKey::Group(id.clone()));
    bump_instance(env);

    Ok(balance)
}

/// Pays `member`'s full accrued balance for group `id` out to `member`.
///
/// Convenience wrapper over [`claim_to`] with `to` set to `member`.
///
/// # Errors
///
/// See [`claim_to`].
pub fn claim(env: &Env, id: &BytesN<32>, member: &Address) -> Result<i128, AutoShareError> {
    claim_to(env, id, member, member)
}
