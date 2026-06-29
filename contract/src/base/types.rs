//! Contract data models and persistent storage keys.
#![allow(missing_docs)]

use soroban_sdk::{contracttype, Address, BytesN, String, Vec};

#[contracttype]
#[derive(Debug, PartialEq, Clone)]
/// A recipient and their configured share of a group distribution.
pub struct GroupMember {
    /// Account that receives this member's token share.
    pub address: Address,
    /// Human-readable member name.
    pub name: String,
    /// Distribution percentage in basis points, where `10_000` equals 100%.
    pub percentage: u32,
}

#[contracttype]
#[derive(Debug, PartialEq, Clone)]
/// Complete persisted configuration for an AutoShare group.
pub struct AutoShareDetails {
    /// Unique 32-byte group identifier.
    pub id: BytesN<32>,
    /// Human-readable group name.
    pub name: String,
    /// Address authorized to update the member list.
    pub creator: Address,
    /// Application-defined usage counter stored with the group.
    pub usage_count: u32,
    /// Token contract used for group distributions.
    pub payment_token: Address,
    /// Ordered recipients and their basis-point shares.
    pub members: Vec<GroupMember>,
}

#[contracttype]
/// Keys used by the contract's persistent storage.
pub enum DataKey {
    /// Maps a group identifier to its [`AutoShareDetails`].
    Group(BytesN<32>),
    /// Maps a creator address to the identifiers of groups they created.
    CreatorGroups(Address),
    /// Stores the contract admin address for administrative operations.
    Admin,
}
