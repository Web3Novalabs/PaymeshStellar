//! Errors returned by AutoShare contract operations.
#![allow(missing_docs)]

use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
/// Stable contract error codes exposed to callers.
pub enum AutoShareError {
    /// A group already exists under the requested identifier.
    GroupAlreadyExists = 1,
    /// No group exists under the requested identifier.
    GroupNotFound = 2,
    /// The caller is not authorized to perform the operation.
    Unauthorized = 3,
    /// Member percentages are zero, overflow, or do not total `10_000` basis points.
    InvalidPercentage = 4,
    /// A distribution amount is not positive.
    InvalidAmount = 5,
    /// The funding account does not hold enough of the group's payment token.
    InsufficientBalance = 6,
    /// The requested address is not a member of the group.
    MemberNotFound = 7,
    /// Two or more configured members use the same address.
    DuplicateMember = 8,
    /// A member-dependent operation was requested for an empty member list.
    EmptyMembers = 9,
    // Explicit variants requested by issue #54
    UnauthorizedAccess = 10,
    InvalidGroupId = 11,
    /// The contract schema is outdated; call `migrate` before mutating state.
    MigrationRequired = 12,
    /// `migrate` was called but the schema is already at the current version.
    NothingToMigrate = 13,
    /// `upgrade` was called while the contract is not paused.
    ContractNotPaused = 14,
    /// The contract has already been initialized.
    AlreadyInitialized = 15,
    /// The member has no escrow balance left to claim for this group.
    ///
    /// Appended at 16: 12 through 15 were taken by the upgradeability work, and
    /// discriminants are ABI, so nothing already deployed may be renumbered.
    NothingToClaim = 16,
}

impl AutoShareError {
    /// Returns a short, actionable description of the error (≤ 100 characters).
    pub fn message(&self) -> &'static str {
        match self {
            AutoShareError::GroupAlreadyExists => "Group already exists. Use a unique group ID.",
            AutoShareError::GroupNotFound => "Group not found. Verify the group ID is correct.",
            AutoShareError::Unauthorized => {
                "Unauthorized. Only the group creator can perform this action."
            }
            AutoShareError::InvalidPercentage => {
                "Invalid percentage. Member percentages must sum to 10000 basis points."
            }
            AutoShareError::InvalidAmount => {
                "Invalid amount. Amount must be a positive integer greater than zero."
            }
            AutoShareError::InsufficientBalance => {
                "Insufficient balance. Ensure the sender has enough funds to distribute."
            }
            AutoShareError::MemberNotFound => {
                "Member not found. Verify the member address belongs to this group."
            }
            AutoShareError::DuplicateMember => {
                "Duplicate member. Each member address must appear only once."
            }
            AutoShareError::EmptyMembers => {
                "No members found. Add at least one member before distributing."
            }
            AutoShareError::UnauthorizedAccess => {
                "Unauthorized access. You do not have permission to perform this action."
            }
            AutoShareError::InvalidGroupId => {
                "Invalid group ID. The provided group ID does not exist or is malformed."
            }
            AutoShareError::MigrationRequired => {
                "Migration required. Call migrate() before performing mutations."
            }
            AutoShareError::NothingToMigrate => {
                "Nothing to migrate. The contract schema is already current."
            }
            AutoShareError::ContractNotPaused => {
                "Contract not paused. Pause the contract before upgrading."
            }
            AutoShareError::AlreadyInitialized => {
                "Already initialized. The contract has already been set up."
            }
            AutoShareError::NothingToClaim => {
                "Nothing to claim. This member has no escrowed balance in this group."
            }
        }
    }
}
