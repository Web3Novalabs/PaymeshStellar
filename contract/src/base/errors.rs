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
}
