use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AutoShareError {
    GroupAlreadyExists = 1,
    GroupNotFound = 2,
    Unauthorized = 3,
    InvalidPercentage = 4,
    InvalidAmount = 5,
    InsufficientBalance = 6,
    MemberNotFound = 7,
    DuplicateMember = 8,
    EmptyMembers = 9,
    // Explicit variants requested by issue #54
    UnauthorizedAccess = 10,
    InvalidGroupId = 11,
}

impl AutoShareError {
    /// Returns a short, actionable description of the error (≤ 100 characters).
    pub fn message(&self) -> &'static str {
        match self {
            AutoShareError::GroupAlreadyExists => {
                "Group already exists. Use a unique group ID."
            }
            AutoShareError::GroupNotFound => {
                "Group not found. Verify the group ID is correct."
            }
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
        }
    }
}
