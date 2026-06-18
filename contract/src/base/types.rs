use soroban_sdk::{contracttype, Address, BytesN, String, Vec};

#[contracttype]
#[derive(Debug, PartialEq, Clone)]
pub struct GroupMember {
    pub address: Address,
    pub name: String,
    pub percentage: u32, // basis points: 10000 = 100%
}

#[contracttype]
#[derive(Debug, PartialEq, Clone)]
pub struct AutoShareDetails {
    pub id: BytesN<32>,
    pub name: String,
    pub creator: Address,
    pub usage_count: u32,
    pub payment_token: Address,
    pub members: Vec<GroupMember>,
}

#[contracttype]
pub enum DataKey {
    Group(BytesN<32>),
    CreatorGroups(Address),
}
