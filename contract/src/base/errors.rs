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
}
