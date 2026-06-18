#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, vec, Address, BytesN, Env, String};

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
#[ignore]
fn test_create_duplicate_group() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[1u8; 32]);
    let name = String::from_str(&env, "Payroll Team A");

    client.create(&id, &name, &creator, &3, &token);
    // second create should not overwrite; ensure group exists
    client.create(&id, &name, &creator, &3, &token);
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
#[ignore]
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

    client.update_members(&id, &creator, &members);
    // ensure members not updated due to invalid percentages
    let details = client.get(&id);
    assert_eq!(details.members.len(), 0);
}

#[test]
#[ignore]
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

    client.update_members(&id, &other_user, &members);
    let details = client.get(&id);
    assert_eq!(details.members.len(), 0);
}

#[test]
#[ignore]
fn test_update_members_group_not_found() {
    let (env, _, _, _token) = setup_env();
    let id = BytesN::from_array(&env, &[99u8; 32]);

    let _members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 10000,
        },
    ];

    let result = base::validators::validate_group_exists(&env, &id);
    assert_eq!(result, Err(AutoShareError::GroupNotFound));
}

#[test]
#[ignore]
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

    client.update_members(&id, &creator, &members);
    let details = client.get(&id);
    assert_eq!(details.members.len(), 0);
}

#[test]
#[ignore]
fn test_update_members_empty() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[6u8; 32]);

    client.create(&id, &String::from_str(&env, "Team F"), &creator, &1, &token);

    let members: soroban_sdk::Vec<GroupMember> = soroban_sdk::Vec::new(&env);

    client.update_members(&id, &creator, &members);
    let details = client.get(&id);
    assert_eq!(details.members.len(), 0);
}

#[test]
#[ignore]
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

    client.update_members(&id, &creator, &members);
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

    // Register real token contract
    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);

    // Fund the caller
    token_admin.mint(&creator, &1000);

    let (id, members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 10, &[6000, 4000]);

    client.distribute(&creator, &id, &1000);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(token_client.balance(&members.get(0).unwrap()), 600);
    assert_eq!(token_client.balance(&members.get(1).unwrap()), 400);
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

    client.distribute(&creator, &id, &100);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    let a = token_client.balance(&members.get(0).unwrap());
    let b = token_client.balance(&members.get(1).unwrap());
    let c = token_client.balance(&members.get(2).unwrap());

    // All amounts must add up to exactly 100
    assert_eq!(a + b + c, 100);
}

#[test]
fn test_distribute_zero_amount() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[20u8; 32]);
    client.create(&id, &String::from_str(&env, "G"), &creator, &1, &token);
    // validate_amount should reject zero
    assert_eq!(
        base::validators::validate_amount(0),
        Err(AutoShareError::InvalidAmount)
    );
}

#[test]
fn test_distribute_negative_amount() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[21u8; 32]);
    client.create(&id, &String::from_str(&env, "G"), &creator, &1, &token);
    assert_eq!(
        base::validators::validate_amount(-100),
        Err(AutoShareError::InvalidAmount)
    );
}

#[test]
#[ignore]
fn test_distribute_group_not_found() {
    let (env, _, _, _token) = setup_env();
    let id = BytesN::from_array(&env, &[99u8; 32]);
    let result = base::validators::validate_group_exists(&env, &id);
    assert_eq!(result, Err(AutoShareError::GroupNotFound));
}

#[test]
#[ignore]
fn test_distribute_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    // Mint only 50, but try to distribute 1000
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &50);

    let (id, members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 30, &[5000, 5000]);

    client.distribute(&creator, &id, &1000);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(token_client.balance(&members.get(0).unwrap()), 0);
    assert_eq!(token_client.balance(&members.get(1).unwrap()), 0);
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
#[ignore]
fn test_validate_group_exists() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[50u8; 32]);

    client.create(&id, &String::from_str(&env, "Test"), &creator, &1, &token);

    let result = base::validators::validate_group_exists(&env, &id);
    assert!(result.is_ok());
    let details = result.unwrap();
    assert_eq!(details.creator, creator);
}

#[test]
#[ignore]
fn test_validate_group_exists_not_found() {
    let env = Env::default();
    let id = BytesN::from_array(&env, &[99u8; 32]);

    let result = base::validators::validate_group_exists(&env, &id);
    assert_eq!(result, Err(AutoShareError::GroupNotFound));
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
    let share = base::utils::calculate_share(1000, 2500);
    assert_eq!(share, 250);
}

#[test]
fn test_calculate_share_zero() {
    let share = base::utils::calculate_share(1000, 0);
    assert_eq!(share, 0);
}

#[test]
fn test_calculate_share_full() {
    let share = base::utils::calculate_share(1000, 10000);
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
