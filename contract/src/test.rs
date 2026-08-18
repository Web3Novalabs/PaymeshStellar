#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Events;
use soroban_sdk::{
    testutils::Address as _, vec, Address, BytesN, Env, IntoVal, String, TryIntoVal,
};
fn setup_env() -> (Env, AutoShareContractClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    let creator = Address::generate(&env);
    let token = Address::generate(&env);
    (env, client, creator, token)
}

// ────── create tests ──────────────────────────────────────────────────────

#[test]
fn test_create_and_get() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[1u8; 32]);
    let name = String::from_str(&env, "Payroll Team A");

    client.create(&id, &name, &creator, &3, &token);
    let details = client.get(&id);
    assert_eq!(details.name, name);
    assert_eq!(details.creator, creator);
    assert_eq!(details.usage_count, 3);
    assert_eq!(details.members.len(), 0);
}

#[test]
fn test_create_duplicate_group() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[1u8; 32]);
    let name = String::from_str(&env, "Payroll Team A");

    client.create(&id, &name, &creator, &3, &token);
    // second create with the same id must return GroupAlreadyExists
    let result = client.try_create(&id, &name, &creator, &3, &token);
    assert_eq!(
        result,
        Err(Ok(AutoShareError::GroupAlreadyExists)),
        "expected GroupAlreadyExists on duplicate create"
    );
    // original group must remain intact
    let details = client.get(&id);
    assert_eq!(details.name, name);
}

// ────── update_members tests ───────────────────────────────────────────────

#[test]
fn test_update_members() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[2u8; 32]);

    client.create(&id, &String::from_str(&env, "Team B"), &creator, &1, &token);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    let members = vec![
        &env,
        GroupMember {
            address: alice.clone(),
            name: String::from_str(&env, "Alice"),
            percentage: 6000, // 60%
        },
        GroupMember {
            address: bob.clone(),
            name: String::from_str(&env, "Bob"),
            percentage: 4000, // 40%
        },
    ];

    client.update_members(&id, &creator, &members);
    let details = client.get(&id);
    assert_eq!(details.members.len(), 2);
    assert_eq!(details.members.get(0).unwrap().percentage, 6000);
    assert_eq!(details.members.get(1).unwrap().percentage, 4000);
}

#[test]
fn test_update_members_invalid_percentage_too_low() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[3u8; 32]);

    client.create(&id, &String::from_str(&env, "Team C"), &creator, &1, &token);
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 5000,
        },
    ];

    // sum is 5000, not 10000 — must return InvalidPercentage
    let result = client.try_update_members(&id, &creator, &members);
    assert_eq!(
        result,
        Err(Ok(AutoShareError::InvalidPercentage)),
        "expected InvalidPercentage when sum != 10000"
    );
    // members must remain empty (update was rejected)
    let details = client.get(&id);
    assert_eq!(details.members.len(), 0);
}

#[test]
fn test_update_members_unauthorized() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[4u8; 32]);

    client.create(&id, &String::from_str(&env, "Team D"), &creator, &1, &token);

    let other_user = Address::generate(&env);
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 10000,
        },
    ];

    // caller is not the creator — must return Unauthorized
    let result = client.try_update_members(&id, &other_user, &members);
    assert_eq!(
        result,
        Err(Ok(AutoShareError::Unauthorized)),
        "expected Unauthorized when caller != creator"
    );
    // members must remain empty (update was rejected)
    let details = client.get(&id);
    assert_eq!(details.members.len(), 0);
}

#[test]
fn test_update_members_group_not_found() {
    let (env, client, creator, token) = setup_env();
    let missing_id = BytesN::from_array(&env, &[99u8; 32]);

    // Use the contract client's try_ variant so the call runs inside the
    // contract execution context (required for env.storage() access).
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 10000,
        },
    ];
    let result = client.try_update_members(&missing_id, &creator, &members);
    assert_eq!(
        result,
        Err(Ok(AutoShareError::GroupNotFound)),
        "expected GroupNotFound when group does not exist"
    );
    // suppress unused variable warnings
    let _ = token;
}

#[test]
fn test_update_members_duplicate_member() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[5u8; 32]);

    client.create(&id, &String::from_str(&env, "Team E"), &creator, &1, &token);

    let alice = Address::generate(&env);

    let members = vec![
        &env,
        GroupMember {
            address: alice.clone(),
            name: String::from_str(&env, "Alice"),
            percentage: 5000,
        },
        GroupMember {
            address: alice.clone(),
            name: String::from_str(&env, "Alice Again"),
            percentage: 5000,
        },
    ];

    // same address appears twice — must return DuplicateMember
    let result = client.try_update_members(&id, &creator, &members);
    assert_eq!(
        result,
        Err(Ok(AutoShareError::DuplicateMember)),
        "expected DuplicateMember for repeated address"
    );
    // members must remain empty (update was rejected)
    let details = client.get(&id);
    assert_eq!(details.members.len(), 0);
}

#[test]
fn test_update_members_empty() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[6u8; 32]);

    client.create(&id, &String::from_str(&env, "Team F"), &creator, &1, &token);

    let members: soroban_sdk::Vec<GroupMember> = soroban_sdk::Vec::new(&env);

    // empty list — must return EmptyMembers
    let result = client.try_update_members(&id, &creator, &members);
    assert_eq!(
        result,
        Err(Ok(AutoShareError::EmptyMembers)),
        "expected EmptyMembers for an empty member list"
    );
    // members must remain empty (update was rejected)
    let details = client.get(&id);
    assert_eq!(details.members.len(), 0);
}

#[test]
fn test_update_members_with_zero_percentage() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[7u8; 32]);

    client.create(&id, &String::from_str(&env, "Team G"), &creator, &1, &token);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    let members = vec![
        &env,
        GroupMember {
            address: alice,
            name: String::from_str(&env, "Alice"),
            percentage: 10000,
        },
        GroupMember {
            address: bob,
            name: String::from_str(&env, "Bob"),
            percentage: 0, // Zero percentage should fail
        },
    ];

    // zero percentage on any member — must return InvalidPercentage
    let result = client.try_update_members(&id, &creator, &members);
    assert_eq!(
        result,
        Err(Ok(AutoShareError::InvalidPercentage)),
        "expected InvalidPercentage when a member has percentage == 0"
    );
    // members must remain empty (update was rejected)
    let details = client.get(&id);
    assert_eq!(details.members.len(), 0);
}

#[test]
fn test_get_groups_by_creator() {
    let (env, client, creator, token) = setup_env();

    let id1 = BytesN::from_array(&env, &[8u8; 32]);
    let id2 = BytesN::from_array(&env, &[9u8; 32]);

    client.create(
        &id1,
        &String::from_str(&env, "Group 1"),
        &creator,
        &1,
        &token,
    );
    client.create(
        &id2,
        &String::from_str(&env, "Group 2"),
        &creator,
        &2,
        &token,
    );

    let groups = client.get_groups_by_creator(&creator);
    assert_eq!(groups.len(), 2);
}

// ────── distribute tests ───────────────────────────────────────────────────

fn setup_group_with_members(
    env: &Env,
    client: &AutoShareContractClient,
    creator: &Address,
    token: &Address,
    id_byte: u8,
    percentages: &[u32],
) -> (BytesN<32>, Vec<Address>) {
    let id = BytesN::from_array(env, &[id_byte; 32]);
    client.create(
        &id,
        &String::from_str(env, "Test Group"),
        creator,
        &1,
        token,
    );

    let mut members = soroban_sdk::Vec::new(env);
    let mut addresses = soroban_sdk::Vec::new(env);
    for &pct in percentages {
        let addr = Address::generate(env);
        addresses.push_back(addr.clone());
        members.push_back(GroupMember {
            address: addr,
            name: String::from_str(env, "Member"),
            percentage: pct,
        });
    }

    client.update_members(&id, creator, &members);
    (id, addresses)
}

#[test]
fn test_distribute_two_members() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &1000);

    let (id, members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 10, &[6000, 4000]);

    let from_balance_before =
        soroban_sdk::token::Client::new(&env, &token_address).balance(&creator);

    client.distribute(&id, &creator, &1000);

    // Capture events immediately after distribute(), before any further
    // contract calls (e.g. balance checks) can reset the event buffer.
    let events = env.events().all();
    assert_eq!(events.len(), 3); // created, members_updated, distributed
    let distributed_event = events.get(2).unwrap();

    let expected_topics: soroban_sdk::Vec<soroban_sdk::Val> = soroban_sdk::vec![
        &env,
        String::from_str(&env, "autoshare").into_val(&env),
        String::from_str(&env, "distributed").into_val(&env),
    ];
    assert_eq!(distributed_event.1, expected_topics);

    let actual_data: (BytesN<32>, Address, i128) = distributed_event.2.try_into_val(&env).unwrap();
    assert_eq!(actual_data, (id.clone(), creator.clone(), 1000i128));

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(token_client.balance(&members.get(0).unwrap()), 600);
    assert_eq!(token_client.balance(&members.get(1).unwrap()), 400);
    assert_eq!(600 + 400, 1000);

    let from_balance_after = token_client.balance(&creator);
    assert_eq!(from_balance_before - from_balance_after, 1000);
}

#[test]
fn test_distribute_rounding_dust_to_last_member() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &100);

    // 33% + 33% + 34% — total must be 10000 bp
    let (id, members) = setup_group_with_members(
        &env,
        &client,
        &creator,
        &token_address,
        11,
        &[3300, 3300, 3400],
    );

    client.distribute(&id, &creator, &100);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    let a = token_client.balance(&members.get(0).unwrap());
    let b = token_client.balance(&members.get(1).unwrap());
    let c = token_client.balance(&members.get(2).unwrap());

    // All amounts must add up to exactly 100
    assert_eq!(a + b + c, 100);
}

#[test]
fn test_distribute_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let id = BytesN::from_array(&env, &[20u8; 32]);
    client.create(
        &id,
        &String::from_str(&env, "G"),
        &creator,
        &1,
        &token_address,
    );

    let result = client.try_distribute(&id, &creator, &0);
    assert!(result.is_err());
}

#[test]
fn test_distribute_negative_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let id = BytesN::from_array(&env, &[21u8; 32]);
    client.create(
        &id,
        &String::from_str(&env, "G"),
        &creator,
        &1,
        &token_address,
    );

    let result = client.try_distribute(&id, &creator, &-100);
    assert!(result.is_err());
}

#[test]
fn test_distribute_group_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let id = BytesN::from_array(&env, &[99u8; 32]);

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let result = client.try_distribute(&id, &creator, &1000);
    assert!(result.is_err());
}

#[test]
fn test_distribute_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &1000);

    let percentages = [10000u32; 1].to_vec();
    let (id, members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 25, &percentages);

    let result = client.try_distribute(&id, &creator, &10000);
    assert!(result.is_err());

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(token_client.balance(&members.get(0).unwrap()), 0);
}

#[test]
fn test_distribute_empty_members() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let id = BytesN::from_array(&env, &[22u8; 32]);
    client.create(
        &id,
        &String::from_str(&env, "G"),
        &creator,
        &1,
        &token_address,
    );

    // Don't add any members - group has empty members list
    let result = client.try_distribute(&id, &creator, &1000);
    assert!(result.is_err());
}

#[test]
#[should_panic]
fn test_distribute_requires_auth() {
    let env = Env::default();
    // Do NOT mock_all_auths - this tests actual auth requirement

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &1000);

    let (id, _members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 28, &[6000, 4000]);

    // Unauthorized calls panic in Soroban's auth host rather than returning Err,
    // so we assert on the panic itself instead of unwrapping a Result.
    // This call panics because auth was never mocked/authorized.
    // #[should_panic] on the test asserts that this panic is expected.
    client.distribute(&id, &creator, &1000);
}

#[test]
fn test_distribute_single_member() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &12345);

    let (id, members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 23, &[10000]);

    client.distribute(&id, &creator, &12345);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(token_client.balance(&members.get(0).unwrap()), 12345);
}

#[test]
fn test_distribute_three_members_uneven_split() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &1000);

    // 10%, 20%, 70%
    let (id, members) = setup_group_with_members(
        &env,
        &client,
        &creator,
        &token_address,
        24,
        &[1000, 2000, 7000],
    );

    client.distribute(&id, &creator, &1000);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(token_client.balance(&members.get(0).unwrap()), 100);
    assert_eq!(token_client.balance(&members.get(1).unwrap()), 200);
    assert_eq!(token_client.balance(&members.get(2).unwrap()), 700);
    assert_eq!(100 + 200 + 700, 1000);
}

#[test]
fn test_distribute_many_members() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &100000);

    // 10 members, each 10%
    let percentages = [1000u32; 10].to_vec();
    let (id, members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 25, &percentages);

    client.distribute(&id, &creator, &100000);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    let mut total = 0;
    for i in 0..10 {
        let balance = token_client.balance(&members.get(i).unwrap());
        assert_eq!(balance, 10000);
        total += balance;
    }
    assert_eq!(total, 100000);
}

#[test]
fn test_distribute_large_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    let large_amount: i128 = 1_000_000_000_000_000_000;
    token_admin.mint(&creator, &large_amount);

    let (id, members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 26, &[6000, 4000]);

    client.distribute(&id, &creator, &large_amount);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(
        token_client.balance(&members.get(0).unwrap()),
        600_000_000_000_000_000
    );
    assert_eq!(
        token_client.balance(&members.get(1).unwrap()),
        400_000_000_000_000_000
    );
}

#[test]
fn test_distribute_minimum_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &1);

    let (id, members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 27, &[5000, 5000]);

    client.distribute(&id, &creator, &1);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    // Last member gets the dust
    assert_eq!(token_client.balance(&members.get(0).unwrap()), 0);
    assert_eq!(token_client.balance(&members.get(1).unwrap()), 1);
}

// ────── validator-specific tests ───────────────────────────────────────────

#[test]
fn test_validate_amount_zero() {
    let _env = Env::default();
    let result = base::validators::validate_amount(0);
    assert_eq!(result, Err(AutoShareError::InvalidAmount));
}

#[test]
fn test_validate_amount_negative() {
    let _env = Env::default();
    let result = base::validators::validate_amount(-1000);
    assert_eq!(result, Err(AutoShareError::InvalidAmount));
}

#[test]
fn test_validate_amount_positive() {
    let result = base::validators::validate_amount(100);
    assert!(result.is_ok());
}

#[test]
fn test_validate_percentages_valid() {
    let env = Env::default();
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 6000,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Bob"),
            percentage: 4000,
        },
    ];

    let result = base::validators::validate_percentages(&members);
    assert!(result.is_ok());
}

#[test]
fn test_validate_percentages_invalid_sum() {
    let env = Env::default();
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 5000,
        },
    ];

    let result = base::validators::validate_percentages(&members);
    assert_eq!(result, Err(AutoShareError::InvalidPercentage));
}

#[test]
fn test_validate_percentages_zero_member() {
    let env = Env::default();
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 10000,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Bob"),
            percentage: 0,
        },
    ];

    let result = base::validators::validate_percentages(&members);
    assert_eq!(result, Err(AutoShareError::InvalidPercentage));
}

#[test]
fn test_validate_members_unique_duplicates() {
    let env = Env::default();
    let alice = Address::generate(&env);

    let members = vec![
        &env,
        GroupMember {
            address: alice.clone(),
            name: String::from_str(&env, "Alice"),
            percentage: 5000,
        },
        GroupMember {
            address: alice,
            name: String::from_str(&env, "Alice Again"),
            percentage: 5000,
        },
    ];

    let result = base::validators::validate_members_unique(&members);
    assert_eq!(result, Err(AutoShareError::DuplicateMember));
}

#[test]
fn test_validate_members_unique_empty() {
    let env = Env::default();
    let members: soroban_sdk::Vec<GroupMember> = soroban_sdk::Vec::new(&env);

    let result = base::validators::validate_members_unique(&members);
    assert_eq!(result, Err(AutoShareError::EmptyMembers));
}

#[test]
fn test_validate_members_unique_valid() {
    let env = Env::default();
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 6000,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Bob"),
            percentage: 4000,
        },
    ];

    let result = base::validators::validate_members_unique(&members);
    assert!(result.is_ok());
}

#[test]
fn test_validate_is_creator_valid() {
    let env = Env::default();
    let creator = Address::generate(&env);
    let result = base::validators::validate_is_creator(&creator, &creator);
    assert!(result.is_ok());
}

#[test]
fn test_validate_is_creator_unauthorized() {
    let env = Env::default();
    let creator = Address::generate(&env);
    let caller = Address::generate(&env);
    let result = base::validators::validate_is_creator(&creator, &caller);
    assert_eq!(result, Err(AutoShareError::Unauthorized));
}

#[test]
fn test_validate_group_exists() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[50u8; 32]);

    client.create(&id, &String::from_str(&env, "Test"), &creator, &1, &token);

    // Verify through the contract client: get() internally calls validate_group_exists.
    // It must return the group without trapping.
    let details = client.get(&id);
    assert_eq!(details.creator, creator);
}

#[test]
fn test_validate_group_exists_not_found() {
    let (env, client, creator, token) = setup_env();
    let missing_id = BytesN::from_array(&env, &[99u8; 32]);

    // Use the contract client's try_get so the call runs inside the contract
    // execution context. Must return GroupNotFound, not trap.
    let result = client.try_get(&missing_id);
    assert_eq!(
        result,
        Err(Ok(AutoShareError::GroupNotFound)),
        "expected GroupNotFound for a non-existent group id"
    );
    // suppress unused variable warnings
    let _ = (creator, token);
}

#[test]
fn test_validate_member_exists() {
    let env = Env::default();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    let members = vec![
        &env,
        GroupMember {
            address: alice.clone(),
            name: String::from_str(&env, "Alice"),
            percentage: 6000,
        },
        GroupMember {
            address: bob.clone(),
            name: String::from_str(&env, "Bob"),
            percentage: 4000,
        },
    ];

    let result = base::validators::validate_member_exists(&members, &alice);
    assert!(result.is_ok());
    assert_eq!(result.unwrap().name, String::from_str(&env, "Alice"));
}

#[test]
fn test_validate_member_exists_not_found() {
    let env = Env::default();
    let alice = Address::generate(&env);
    let charlie = Address::generate(&env);

    let members = vec![
        &env,
        GroupMember {
            address: alice,
            name: String::from_str(&env, "Alice"),
            percentage: 10000,
        },
    ];

    let result = base::validators::validate_member_exists(&members, &charlie);
    assert_eq!(result, Err(AutoShareError::MemberNotFound));
}

// ── percentage utility tests ───────────────────────────────────────────────

#[test]
fn test_calculate_share_normal() {
    let share = base::utils::calculate_share(1000, 2500).unwrap();
    assert_eq!(share, 250);
}

#[test]
fn test_calculate_share_zero() {
    let share = base::utils::calculate_share(1000, 0).unwrap();
    assert_eq!(share, 0);
}

#[test]
fn test_calculate_share_full() {
    let share = base::utils::calculate_share(1000, 10000).unwrap();
    assert_eq!(share, 1000);
}

#[test]
fn test_validate_percentages_ok() {
    let env = Env::default();
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 6000,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Bob"),
            percentage: 4000,
        },
    ];
    let res = base::utils::validate_percentages(&members);
    assert!(res.is_ok());
}

#[test]
fn test_validate_percentages_too_low() {
    let env = Env::default();
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 5000,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Bob"),
            percentage: 4999,
        },
    ];
    let res = base::utils::validate_percentages(&members);
    assert_eq!(res, Err(base::errors::AutoShareError::InvalidPercentage));
}

#[test]
fn test_validate_percentages_too_high() {
    let env = Env::default();
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 5000,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Bob"),
            percentage: 5001,
        },
    ];
    let res = base::utils::validate_percentages(&members);
    assert_eq!(res, Err(base::errors::AutoShareError::InvalidPercentage));
}

#[test]
fn test_validate_percentages_zero() {
    let env = Env::default();
    let members = soroban_sdk::Vec::new(&env);
    let res = base::utils::validate_percentages(&members);
    assert_eq!(res, Err(base::errors::AutoShareError::InvalidPercentage));
}

#[test]
fn test_distribute_amounts_even() {
    let env = Env::default();
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 5000,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Bob"),
            percentage: 5000,
        },
    ];
    let res = base::utils::distribute_amounts(&env, 1000, &members).unwrap();
    assert_eq!(res.len(), 2);
    assert_eq!(res.get(0).unwrap(), 500);
    assert_eq!(res.get(1).unwrap(), 500);
}

#[test]
fn test_distribute_amounts_indivisible() {
    let env = Env::default();
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 3333,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Bob"),
            percentage: 3333,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Charlie"),
            percentage: 3334,
        },
    ];
    let res = base::utils::distribute_amounts(&env, 100, &members).unwrap();
    assert_eq!(res.len(), 3);
    let a = res.get(0).unwrap();
    let b = res.get(1).unwrap();
    let c = res.get(2).unwrap();
    assert_eq!(a, 33);
    assert_eq!(b, 33);
    assert_eq!(c, 34); // gets the remaining dust
    assert_eq!(a + b + c, 100);
}

#[test]
fn test_distribute_amounts_single() {
    let env = Env::default();
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 10000,
        },
    ];
    let res = base::utils::distribute_amounts(&env, 12345, &members).unwrap();
    assert_eq!(res.len(), 1);
    assert_eq!(res.get(0).unwrap(), 12345);
}

#[test]
fn test_distribute_amounts_many() {
    let env = Env::default();
    let mut members = soroban_sdk::Vec::new(&env);
    for _ in 0..10 {
        members.push_back(GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Member"),
            percentage: 1000,
        });
    }
    let res = base::utils::distribute_amounts(&env, 100000, &members).unwrap();
    assert_eq!(res.len(), 10);
    let mut sum = 0;
    for val in res.iter() {
        sum += val;
        assert_eq!(val, 10000);
    }
    assert_eq!(sum, 100000);
}

#[test]
fn test_distribute_amounts_large() {
    let env = Env::default();
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 6000,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Bob"),
            percentage: 4000,
        },
    ];
    // A large i128 total amount (e.g. 10^30)
    let total: i128 = 1_000_000_000_000_000_000_000_000_000_000i128;
    let res = base::utils::distribute_amounts(&env, total, &members).unwrap();
    assert_eq!(res.len(), 2);
    let a = res.get(0).unwrap();
    let b = res.get(1).unwrap();
    assert_eq!(a, 600_000_000_000_000_000_000_000_000_000i128);
    assert_eq!(b, 400_000_000_000_000_000_000_000_000_000i128);
    assert_eq!(a + b, total);
}

#[test]
fn test_distribute_amounts_negative() {
    let env = Env::default();
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 10000,
        },
    ];
    let res = base::utils::distribute_amounts(&env, -100, &members);
    assert_eq!(res, Err(base::errors::AutoShareError::InvalidAmount));
}

#[test]
fn test_distribute_amounts_one() {
    let env = Env::default();
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 5000,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Bob"),
            percentage: 5000,
        },
    ];
    let res = base::utils::distribute_amounts(&env, 1, &members).unwrap();
    assert_eq!(res.len(), 2);
    assert_eq!(res.get(0).unwrap(), 0);
    assert_eq!(res.get(1).unwrap(), 1); // gets the remaining dust unit
}

#[test]
fn test_distribute_amounts_zero() {
    let env = Env::default();
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 5000,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Bob"),
            percentage: 5000,
        },
    ];
    let res = base::utils::distribute_amounts(&env, 0, &members).unwrap();
    assert_eq!(res.len(), 2);
    assert_eq!(res.get(0).unwrap(), 0);
    assert_eq!(res.get(1).unwrap(), 0);
}

#[test]
fn test_validate_percentages_large_list() {
    let env = Env::default();
    let mut members = soroban_sdk::Vec::new(&env);
    for _ in 0..100 {
        members.push_back(GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Member"),
            percentage: 100, // 100 members * 100 basis points = 10000 (100%)
        });
    }
    let res = base::utils::validate_percentages(&members);
    assert!(res.is_ok());
}

#[test]
fn test_get_member_shares_even() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[1u8; 32]);
    client.create(&id, &String::from_str(&env, "Group"), &creator, &1, &token);
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 6000,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Bob"),
            percentage: 4000,
        },
    ];
    client.update_members(&id, &creator, &members);
    let shares = client.get_member_shares(&id, &1000);
    assert_eq!(shares.len(), 2);
    assert_eq!(shares.get(0).unwrap(), 600);
    assert_eq!(shares.get(1).unwrap(), 400);
}

#[test]
fn test_get_calculated_share() {
    let (_env, client, _, _) = setup_env();
    let share = client.get_calculated_share(&1000, &2500);
    assert_eq!(share, 250);
}

#[test]
fn test_get_total_percentage() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[2u8; 32]);
    client.create(&id, &String::from_str(&env, "Group2"), &creator, &1, &token);
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "A"),
            percentage: 3333,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "B"),
            percentage: 3333,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "C"),
            percentage: 3334,
        },
    ];
    client.update_members(&id, &creator, &members);
    let total = client.get_total_percentage(&id);
    assert_eq!(total, 10000);
}

// ── overflow boundary regression tests ────────────────────────────────────
//
// MAX_SAFE_TOTAL = i128::MAX / 10_000 = 17_014_118_346_046_923_173_168_730_371_588_410
//
// Defect found: calculate_share used .expect() so any amount above this boundary
// caused an opaque trap instead of returning InvalidAmount.

/// One unit below the overflow boundary — must succeed.
#[test]
fn test_calculate_share_overflow_boundary_safe() {
    let max_safe = base::utils::MAX_SAFE_TOTAL;
    // percentage = 10_000 maximises the intermediate product (total * 10_000)
    let result = base::utils::calculate_share(max_safe, 10_000);
    assert!(
        result.is_ok(),
        "expected Ok for total == MAX_SAFE_TOTAL, got {:?}",
        result
    );
    assert_eq!(result.unwrap(), max_safe);
}

/// One unit above the overflow boundary — must return InvalidAmount, not trap.
///
/// Regression for: calculate_share panicked via .expect() instead of returning Err.
#[test]
fn test_calculate_share_overflow_boundary_over() {
    let over_safe = base::utils::MAX_SAFE_TOTAL + 1;
    let result = base::utils::calculate_share(over_safe, 10_000);
    assert_eq!(
        result,
        Err(base::errors::AutoShareError::InvalidAmount),
        "expected InvalidAmount for total == MAX_SAFE_TOTAL + 1, got {:?}",
        result
    );
}

/// distribute_amounts with an overflow-triggering total must return Err, not trap.
///
/// Regression for: distribute used .expect("failed to distribute amounts") which
/// turned the overflow into an opaque contract abort instead of a typed error.
///
/// The overflow boundary for `calculate_share` is `i128::MAX / percentage`.
/// With two members at 5_000 bps each, the safe boundary is `i128::MAX / 5_000`.
/// Any total strictly above that overflows the intermediate product `total * 5_000`.
#[test]
fn test_distribute_amounts_overflow_returns_err() {
    let env = Env::default();
    // With percentage = 5_000, overflow fires when total * 5_000 > i128::MAX,
    // i.e. total > i128::MAX / 5_000.
    let over_safe_5000 = i128::MAX / 5_000 + 1;
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 5_000,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Bob"),
            percentage: 5_000,
        },
    ];
    // The first (non-final) member goes through calculate_share and must overflow.
    let result = base::utils::distribute_amounts(&env, over_safe_5000, &members);
    assert_eq!(
        result,
        Err(base::errors::AutoShareError::InvalidAmount),
        "expected InvalidAmount for total > i128::MAX/5000, got {:?}",
        result
    );
}

/// get_calculated_share via contract client returns Err on overflow (no trap).
///
/// Regression for: get_calculated_share had no Result return type; overflow
/// caused an opaque host trap instead of a typed error visible to callers.
#[test]
fn test_get_calculated_share_overflow() {
    let (_env, client, _, _) = setup_env();
    let over_safe = base::utils::MAX_SAFE_TOTAL + 1;
    let result = client.try_get_calculated_share(&over_safe, &10_000u32);
    assert!(
        result.is_err(),
        "expected Err for overflowing get_calculated_share"
    );
}

/// get_member_shares via contract client returns GroupNotFound, not a trap.
///
/// Regression for: get_member_shares used .expect("group not found") so callers
/// received an opaque abort instead of the typed GroupNotFound error.
#[test]
fn test_get_member_shares_group_not_found() {
    let (env, _, _, _) = setup_env();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    let missing_id = BytesN::from_array(&env, &[0xddu8; 32]);
    let result = client.try_get_member_shares(&missing_id, &1000);
    assert!(
        result.is_err(),
        "expected Err(GroupNotFound) for missing group"
    );
}

/// get_total_percentage via contract client returns GroupNotFound, not a trap.
///
/// Regression for: get_total_percentage used .expect("group not found") so
/// callers received an opaque abort instead of a typed error.
#[test]
fn test_get_total_percentage_group_not_found() {
    let (env, _, _, _) = setup_env();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    let missing_id = BytesN::from_array(&env, &[0xeeu8; 32]);
    let result = client.try_get_total_percentage(&missing_id);
    assert!(
        result.is_err(),
        "expected Err(GroupNotFound) for missing group"
    );
}

/// validate_percentages (canonical) rejects a zero-percentage member.
///
/// Regression for: the old utils::validate_percentages did NOT check for
/// zero-percentage members, meaning a member with percentage=0 could slip
/// through and receive dust-only payouts silently.
#[test]
fn test_regression_validate_percentages_rejects_zero_member() {
    let env = Env::default();
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 10000,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Ghost"),
            percentage: 0,
        },
    ];
    // Both the utils (canonical) and validators (delegating) versions must reject.
    assert_eq!(
        base::utils::validate_percentages(&members),
        Err(base::errors::AutoShareError::InvalidPercentage)
    );
    assert_eq!(
        base::validators::validate_percentages(&members),
        Err(base::errors::AutoShareError::InvalidPercentage)
    );
}

/// validate_percentages (canonical) rejects overflow via checked_add.
///
/// Regression for: the old validators::validate_percentages used plain `+=`
/// which, with overflow-checks=true in release, would trap instead of
/// returning InvalidPercentage.
#[test]
fn test_regression_validate_percentages_overflow_safe() {
    let env = Env::default();
    // Two members whose raw sum overflows u32::MAX
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "A"),
            percentage: u32::MAX / 2 + 1,
        },
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "B"),
            percentage: u32::MAX / 2 + 1,
        },
    ];
    // Must return InvalidPercentage, not trap.
    assert_eq!(
        base::utils::validate_percentages(&members),
        Err(base::errors::AutoShareError::InvalidPercentage)
    );
    assert_eq!(
        base::validators::validate_percentages(&members),
        Err(base::errors::AutoShareError::InvalidPercentage)
    );
}
