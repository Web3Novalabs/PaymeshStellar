//! Contract data models and persistent storage keys.
#![allow(missing_docs)]

use soroban_sdk::{contracttype, Address, BytesN, String, Vec};

/// Current schema version. Bumped on every storage-layout change.
/// v1 = implicit pre-versioning layout (no `version` field on groups).
/// v2 = adds `version: u32` to `AutoShareDetails`.
/// v3 = adds `group_version: u32` to `AutoShareDetails` for optimistic concurrency.
pub const CURRENT_SCHEMA_VERSION: u32 = 3;

#[contracttype]
#[derive(Debug, PartialEq, Clone)]
/// Defines how basis points are reallocated when a member's share changes.
pub enum RebalancePolicy {
    /// Dilute or concentrate every existing member pro rata based on their current shares.
    Proportional,
    /// Take the full amount from, or give the full amount to, one named member.
    FromMember(Address),
    ToMember(Address),
}

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
/// Legacy v1 group layout **without** a `version` field.
///
/// Used exclusively during migration to deserialize records written by the
/// pre-versioning contract code.
pub struct AutoShareDetailsV1 {
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
#[derive(Debug, PartialEq, Clone)]
/// Legacy v2 group layout with `version` but without `group_version`.
///
/// Used during migration to v3.
pub struct AutoShareDetailsV2 {
    pub id: BytesN<32>,
    pub name: String,
    pub creator: Address,
    pub usage_count: u32,
    pub payment_token: Address,
    pub members: Vec<GroupMember>,
    pub version: u32,
}

#[contracttype]
#[derive(Debug, PartialEq, Clone)]
/// Complete persisted configuration for an AutoShare group (v3+).
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
    /// Schema version this record was written with.
    pub version: u32,
    /// Optimistic concurrency version, bumped on every mutation.
    pub group_version: u32,
}

#[contracttype]
#[derive(Debug, PartialEq, Clone)]
/// Result of a single `migrate` batch call.
pub struct MigrationProgress {
    /// Number of groups migrated in this batch.
    pub migrated: u32,
    /// Number of groups still awaiting migration.
    pub remaining: u32,
    /// `true` when all groups have been migrated.
    pub done: bool,
}

#[contracttype]
/// Keys used by the contract's persistent and instance storage.
pub enum DataKey {
    /// Maps a group identifier to its [`AutoShareDetails`].
    Group(BytesN<32>),
    /// Maps a creator address to the identifiers of groups they created.
    CreatorGroups(Address),
    /// Stores the contract admin address for administrative operations.
    Admin,
    /// Current schema version (instance storage, read on nearly every call).
    SchemaVersion,
    /// Global ordered list of all group IDs (persistent storage).
    ///
    /// Each entry is a `BytesN<32>` (32 bytes). At ~2,000 groups the Vec
    /// approaches Soroban's 64 KB persistent-entry limit. For deployments
    /// expecting more groups, paginate into `AllGroupsPage(u32)` buckets.
    AllGroups,
    /// Cursor index into [`DataKey::AllGroups`] for resumable batched migration
    /// (instance storage). Removed once migration completes.
    MigrationCursor,
    /// Whether the contract is paused (instance storage).
    Paused,
    /// Maps `(group id, member address)` to that member's unclaimed escrow balance.
    ///
    /// Credited by `deposit` and removed by `claim`. Keying on the address rather
    /// than on a member-list position is what gives escrow its snapshot
    /// semantics: replacing a group's members never moves credited funds.
    Claimable(BytesN<32>, Address),
    /// Maps a group identifier to the total escrow balance held for it.
    ///
    /// Always equal to the sum of that group's [`DataKey::Claimable`] entries.
    Escrowed(BytesN<32>),
}
