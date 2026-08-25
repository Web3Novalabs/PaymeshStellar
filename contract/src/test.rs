#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _},
    vec, Address, BytesN, Env, String, Vec,
};

// ── helpers ──────────────────────────────────────────────────────────────────

fn setup_env() -> (Env, AutoShareContractClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.init(&admin);
    let creator = Address::generate(&env);
    let token = Address::generate(&env);
    (env, client, creator, token)
}

/// Creates an Env with a real Stellar asset token and a registered AutoShareContract.
fn setup_token_env() -> (Env, AutoShareContractClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.init(&admin);
    let creator = Address::generate(&env);
    (env, client, creator, token_address)
}

/// Creates a group with the given percentages (must sum to 10000) and returns
/// its id and member addresses in order.
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

    let mut members = Vec::new(env);
    let mut addresses = Vec::new(env);
    for &pct in percentages {
        let addr = Address::generate(env);
        addresses.push_back(addr.clone());
        members.push_back(GroupMember {
            address: addr,
            name: String::from_str(env, "Member"),
            percentage: pct,
        });
    }

    client.update_members(&id, creator, &members, &1);
    (id, addresses)
}

fn setup_env_with_group(
    env: &Env,
    num_members: u32,
) -> (
    AutoShareContractClient<'static>,
    BytesN<32>,
    Address,
    Address,
    Vec<GroupMember>,
    u32,
) {
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.init(&admin);
    let creator = Address::generate(env);
    let token = Address::generate(env);
    let id = BytesN::from_array(env, &[1u8; 32]);
    client.create(
        &id,
        &String::from_str(env, "Test Group"),
        &creator,
        &1,
        &token,
    );

    let mut members = Vec::new(env);
    if num_members > 0 {
        let pct_per_member = 10000 / num_members;
        let mut total_pct = 0;
        for i in 0..num_members {
            let pct = if i == num_members - 1 {
                10000 - total_pct
            } else {
                pct_per_member
            };
            total_pct += pct;
            let addr = Address::generate(env);
            members.push_back(GroupMember {
                address: addr,
                name: String::from_str(env, "Member"),
                percentage: pct,
            });
        }
        client.update_members(&id, &creator, &members, &1);
    }

    (client, id, creator, token, members, 0)
}

// ── create / get tests ───────────────────────────────────────────────────────

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
fn test_create_duplicate_group_panics() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[1u8; 32]);
    client.create(&id, &String::from_str(&env, "G"), &creator, &1, &token);
    let result = client.try_create(&id, &String::from_str(&env, "G2"), &creator, &1, &token);
    assert!(result.is_err());
}

// ── update_members tests ─────────────────────────────────────────────────────

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

    client.update_members(&id, &creator, &members, &1);
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

    let result = client.try_update_members(&id, &creator, &members, &1);
    assert!(result.is_err());
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

    let result = client.try_update_members(&id, &other_user, &members, &1);
    assert!(result.is_err());
    let details = client.get(&id);
    assert_eq!(details.members.len(), 0);
}

#[test]
fn test_update_members_group_not_found() {
    let (env, client, _creator, _token) = setup_env();
    let id = BytesN::from_array(&env, &[99u8; 32]);

    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 10000,
        },
    ];

    let result = client.try_update_members(&id, &Address::generate(&env), &members, &1);
    assert!(result.is_err());
}

#[test]
fn test_update_members_duplicate_member() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[5u8; 32]);

    client.create(&id, &String::from_str(&env, "Team E"), &creator, &1, &token);

    let alice = Address::generate(&env);

    // Same address appears twice — must be rejected as DuplicateMember
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

    let result = client.try_update_members(&id, &creator, &members, &1);
    assert!(result.is_err());
}

#[test]
fn test_update_members_non_creator_panics() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[3u8; 32]);
    client.create(&id, &String::from_str(&env, "Team C"), &creator, &1, &token);

    let attacker = Address::generate(&env);
    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 10000,
        },
    ];
    // Non-creator must be rejected with Unauthorized
    let result = client.try_update_members(&id, &attacker, &members, &1);
    assert!(result.is_err());
}

// ── get_groups_by_creator tests ──────────────────────────────────────────────

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

#[test]
fn test_get_groups_by_creator_returns_empty_for_unknown() {
    let (env, client, _creator, _token) = setup_env();
    let stranger = Address::generate(&env);
    let groups = client.get_groups_by_creator(&stranger);
    assert_eq!(groups.len(), 0);
}

// ── distribute: error cases ──────────────────────────────────────────────────

#[test]
fn test_distribute_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    client.init(&Address::generate(&env));

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
    client.init(&Address::generate(&env));

    let creator = Address::generate(&env);
    let id = BytesN::from_array(&env, &[21u8; 32]);
    client.create(
        &id,
        &String::from_str(&env, "G"),
        &creator,
        &1,
        &token_address,
    );
    let result = client.try_distribute(&id, &creator, &-500);
    assert!(result.is_err());
}

#[test]
fn test_distribute_group_not_found() {
    let (env, client, creator, _token) = setup_env();
    let id = BytesN::from_array(&env, &[99u8; 32]);
    let result = client.try_distribute(&id, &creator, &100);
    assert!(result.is_err());
}

#[test]
fn test_distribute_insufficient_balance() {
    let (env, client, creator, token_address) = setup_token_env();

    // Mint only 50, but try to distribute 1000
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
    client.init(&Address::generate(&env));

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
    client.init(&Address::generate(&env));

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
    client.init(&Address::generate(&env));

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
    client.init(&Address::generate(&env));

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
    client.init(&Address::generate(&env));

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
    client.init(&Address::generate(&env));

    let creator = Address::generate(&env);
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    let large_amount: i128 = 1_000_000_000_000_000_000;
    token_admin.mint(&creator, &large_amount);

    let (id, members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 30, &[5000, 5000]);
    // The test mints exactly `large_amount` so a distribution of that size is
    // affordable, and 1e18 is far below MAX_SAFE_TOTAL, so it must succeed.
    // (It previously distributed 1000 and asserted an error, which only held
    // because the group was never created — `create` was failing with
    // MigrationRequired before this setup called `init`.)
    let result = client.try_distribute(&id, &creator, &large_amount);
    assert!(
        result.is_ok(),
        "expected a large in-range distribution to succeed"
    );

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    for member in members.iter() {
        assert_eq!(token_client.balance(&member), large_amount / 2);
    }
}

// ── distribute: single member ────────────────────────────────────────────────

#[test]
fn test_distribute_single_member_receives_full_amount() {
    let (env, client, creator, token_address) = setup_token_env();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &1_000);

    let (id, members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 50, &[10000]);

    client.distribute(&id, &creator, &1_000);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    // Single member must receive exactly the full amount
    assert_eq!(token_client.balance(&members.get(0).unwrap()), 1_000);
    // Caller must have nothing left
    assert_eq!(token_client.balance(&creator), 0);
}

#[test]
fn test_distribute_single_member_odd_amount() {
    // Even with an indivisible amount, a single 100% member gets everything
    let (env, client, creator, token_address) = setup_token_env();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &7);

    let (id, members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 51, &[10000]);

    client.distribute(&id, &creator, &7);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(token_client.balance(&members.get(0).unwrap()), 7);
}

// ── distribute: two members ──────────────────────────────────────────────────

#[test]
fn test_distribute_two_members_60_40() {
    let (env, client, creator, token_address) = setup_token_env();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &1_000);

    let (id, members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 10, &[6000, 4000]);

    client.distribute(&id, &creator, &1_000);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(token_client.balance(&members.get(0).unwrap()), 600);
    assert_eq!(token_client.balance(&members.get(1).unwrap()), 400);
    // Caller transferred the full amount — nothing remains
    assert_eq!(token_client.balance(&creator), 0);
}

#[test]
fn test_distribute_two_members_70_30() {
    // 70%/30% split on 10_000 → exact integer division, no rounding
    let (env, client, creator, token_address) = setup_token_env();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &10_000);

    let (id, members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 52, &[7000, 3000]);

    client.distribute(&id, &creator, &10_000);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(token_client.balance(&members.get(0).unwrap()), 7_000);
    assert_eq!(token_client.balance(&members.get(1).unwrap()), 3_000);
}

#[test]
fn test_distribute_two_members_1_99_split() {
    // Smallest / largest possible split on 10_000
    let (env, client, creator, token_address) = setup_token_env();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &10_000);

    let (id, members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 55, &[100, 9900]);

    client.distribute(&id, &creator, &10_000);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(token_client.balance(&members.get(0).unwrap()), 100);
    assert_eq!(token_client.balance(&members.get(1).unwrap()), 9_900);
}

// ── distribute: multiple members ─────────────────────────────────────────────

#[test]
fn test_distribute_four_members_equal_split() {
    // 25% each → 250 each on 1000 total
    let (env, client, creator, token_address) = setup_token_env();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &1_000);

    let (id, members) = setup_group_with_members(
        &env,
        &client,
        &creator,
        &token_address,
        53,
        &[2500, 2500, 2500, 2500],
    );

    client.distribute(&id, &creator, &1_000);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(token_client.balance(&members.get(0).unwrap()), 250);
    assert_eq!(token_client.balance(&members.get(1).unwrap()), 250);
    assert_eq!(token_client.balance(&members.get(2).unwrap()), 250);
    assert_eq!(token_client.balance(&members.get(3).unwrap()), 250);

    let total: i128 = (0..4)
        .map(|i| token_client.balance(&members.get(i).unwrap()))
        .sum();
    assert_eq!(total, 1_000);
}

#[test]
fn test_distribute_five_members_sum_equals_total() {
    // 5 members with uneven splits; sum of shares must equal the input amount
    let (env, client, creator, token_address) = setup_token_env();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &9_999);

    let (id, members) = setup_group_with_members(
        &env,
        &client,
        &creator,
        &token_address,
        54,
        &[3000, 2500, 2000, 1500, 1000],
    );

    client.distribute(&id, &creator, &9_999);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    let total: i128 = (0..5)
        .map(|i| token_client.balance(&members.get(i).unwrap()))
        .sum();

    assert_eq!(total, 9_999);
}

// ── distribute: rounding edge cases ──────────────────────────────────────────

#[test]
fn test_distribute_rounding_three_way_33_33_34() {
    let (env, client, creator, token_address) = setup_token_env();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &100);

    // 33% + 33% + 34% — last member absorbs rounding dust
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

    // All amounts must add up to exactly 100 (no token left in contract)
    assert_eq!(a + b + c, 100);
    // First two get their integer-truncated share
    assert_eq!(a, 100 * 3300 / 10000);
    assert_eq!(b, 100 * 3300 / 10000);
    // Last member gets the remainder
    assert_eq!(c, 100 - a - b);
}

#[test]
fn test_distribute_rounding_prime_amount_three_equal_parts() {
    // 997 (prime) split into approx thirds; rounding dust to last member
    let (env, client, creator, token_address) = setup_token_env();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &997);

    let (id, members) = setup_group_with_members(
        &env,
        &client,
        &creator,
        &token_address,
        60,
        &[3333, 3333, 3334],
    );

    client.distribute(&id, &creator, &997);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    let a = token_client.balance(&members.get(0).unwrap());
    let b = token_client.balance(&members.get(1).unwrap());
    let c = token_client.balance(&members.get(2).unwrap());

    assert_eq!(a + b + c, 997);
    // Non-last members get floor(997 * 3333 / 10000)
    assert_eq!(a, 997 * 3333 / 10000);
    assert_eq!(b, 997 * 3333 / 10000);
    // Last member absorbs whatever remains
    assert_eq!(c, 997 - a - b);
}

#[test]
fn test_distribute_rounding_minimal_amount_three_members() {
    // Amount of 3 split into approximate thirds — rounding must still conserve total
    let (env, client, creator, token_address) = setup_token_env();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &3);

    let (id, members) = setup_group_with_members(
        &env,
        &client,
        &creator,
        &token_address,
        61,
        &[3333, 3333, 3334],
    );

    client.distribute(&id, &creator, &3);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    let a = token_client.balance(&members.get(0).unwrap());
    let b = token_client.balance(&members.get(1).unwrap());
    let c = token_client.balance(&members.get(2).unwrap());

    assert_eq!(a + b + c, 3);
}

#[test]
fn test_distribute_rounding_seven_members_sum_exact() {
    // 7-member split; total must be conserved regardless of per-member rounding
    let (env, client, creator, token_address) = setup_token_env();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    let amount: i128 = 123;
    token_admin.mint(&creator, &amount);

    // 6 × 1429 bp + 1 × 1426 bp = 10000 bp
    let (id, members) = setup_group_with_members(
        &env,
        &client,
        &creator,
        &token_address,
        62,
        &[1429, 1429, 1429, 1429, 1429, 1429, 1426],
    );

    client.distribute(&id, &creator, &amount);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    let total: i128 = (0..7)
        .map(|i| token_client.balance(&members.get(i).unwrap()))
        .sum();

    assert_eq!(total, amount);
}

// ── distribute: realistic payroll scenarios ───────────────────────────────────

#[test]
fn test_distribute_realistic_payroll_five_employees() {
    // 10_000 XLM payroll represented in stroops (1 XLM = 10_000_000 stroops)
    let (env, client, creator, token_address) = setup_token_env();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    let total: i128 = 100_000_000_000; // 10_000 XLM in stroops
    token_admin.mint(&creator, &total);

    // 40% / 25% / 20% / 10% / 5%
    let (id, members) = setup_group_with_members(
        &env,
        &client,
        &creator,
        &token_address,
        56,
        &[4000, 2500, 2000, 1000, 500],
    );

    client.distribute(&id, &creator, &total);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    let distributed: i128 = (0..5)
        .map(|i| token_client.balance(&members.get(i).unwrap()))
        .sum();

    // Total distributed must exactly equal the input amount
    assert_eq!(distributed, total);
    // Verify the 40% employee's share
    assert_eq!(
        token_client.balance(&members.get(0).unwrap()),
        40_000_000_000_i128
    );
    // Verify the 5% (last) employee's share absorbed any dust
    let last = token_client.balance(&members.get(4).unwrap());
    assert_eq!(last, total - (distributed - last));
}

#[test]
fn test_distribute_caller_balance_is_zero_after_full_distribution() {
    // Caller starts with exactly the distributed amount; nothing should remain
    let (env, client, creator, token_address) = setup_token_env();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &2_000);

    let (id, _) =
        setup_group_with_members(&env, &client, &creator, &token_address, 72, &[5000, 5000]);

    client.distribute(&id, &creator, &2_000);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(token_client.balance(&creator), 0);
}

#[test]
fn test_distribute_partial_amount_caller_retains_remainder() {
    // Caller has 5_000, distributes only 2_000 → retains 3_000
    let (env, client, creator, token_address) = setup_token_env();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &5_000);

    let (id, _) =
        setup_group_with_members(&env, &client, &creator, &token_address, 73, &[5000, 5000]);

    client.distribute(&id, &creator, &2_000);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(token_client.balance(&creator), 3_000);
}

// ── event emission ────────────────────────────────────────────────────────────

#[test]
fn test_create_emits_group_created_event() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[80u8; 32]);

    client.create(
        &id,
        &String::from_str(&env, "Event Group"),
        &creator,
        &1,
        &token,
    );

    // The event topics are published as strings ("autoshare", "created").
    // env.events().all() returns Vec<(Address, Vec<Val>, Val)> — we inspect the
    // debug representation to find the expected topic pair.
    let events = env.events().all();
    let has_created = events.iter().any(|(_contract, topics, _data)| {
        topics
            == soroban_sdk::vec![
                &env,
                soroban_sdk::IntoVal::<Env, soroban_sdk::Val>::into_val(
                    &String::from_str(&env, "autoshare"),
                    &env
                ),
                soroban_sdk::IntoVal::<Env, soroban_sdk::Val>::into_val(
                    &String::from_str(&env, "created"),
                    &env
                ),
            ]
    });
    assert!(has_created, "expected group_created event was not emitted");
}

#[test]
fn test_update_members_emits_members_updated_event() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[81u8; 32]);

    client.create(
        &id,
        &String::from_str(&env, "Event Group 2"),
        &creator,
        &1,
        &token,
    );

    let members = vec![
        &env,
        GroupMember {
            address: Address::generate(&env),
            name: String::from_str(&env, "Alice"),
            percentage: 10000,
        },
    ];
    client.update_members(&id, &creator, &members, &1);

    let events = env.events().all();
    let has_updated = events.iter().any(|(_contract, topics, _data)| {
        topics
            == soroban_sdk::vec![
                &env,
                soroban_sdk::IntoVal::<Env, soroban_sdk::Val>::into_val(
                    &String::from_str(&env, "autoshare"),
                    &env
                ),
                soroban_sdk::IntoVal::<Env, soroban_sdk::Val>::into_val(
                    &String::from_str(&env, "members_updated"),
                    &env
                ),
            ]
    });
    assert!(
        has_updated,
        "expected members_updated event was not emitted"
    );
}

#[test]
fn test_distribute_emits_distributed_event() {
    let (env, client, creator, token_address) = setup_token_env();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    token_admin.mint(&creator, &500);

    let (id, _) =
        setup_group_with_members(&env, &client, &creator, &token_address, 70, &[5000, 5000]);

    client.distribute(&id, &creator, &500);

    // Verify the "autoshare"/"distributed" event was published
    let events = env.events().all();
    let has_distributed = events.iter().any(|(_contract, topics, _data)| {
        topics
            == soroban_sdk::vec![
                &env,
                soroban_sdk::IntoVal::<Env, soroban_sdk::Val>::into_val(
                    &String::from_str(&env, "autoshare"),
                    &env
                ),
                soroban_sdk::IntoVal::<Env, soroban_sdk::Val>::into_val(
                    &String::from_str(&env, "distributed"),
                    &env
                ),
            ]
    });
    assert!(
        has_distributed,
        "expected distributed event was not emitted"
    );
}

// ── upgrade & migration tests ────────────────────────────────────────────────

#[test]
fn test_init_stamps_schema_version_and_sets_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    assert_eq!(client.schema_version(), 0);
    client.init(&admin);
    assert_eq!(client.schema_version(), CURRENT_SCHEMA_VERSION);

    // Repeated init must fail
    let admin2 = Address::generate(&env);
    let err = client.try_init(&admin2);
    assert_eq!(err, Err(Ok(AutoShareError::AlreadyInitialized)));
}

#[test]
fn test_full_upgrade_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    client.init(&Address::generate(&env));
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let token = Address::generate(&env);

    // Seed v1 layout in storage directly (simulating a deployed v1 contract with pre-existing data)
    let id1 = BytesN::from_array(&env, &[101u8; 32]);
    let id2 = BytesN::from_array(&env, &[102u8; 32]);
    let member_addr = Address::generate(&env);

    let mut members1 = Vec::new(&env);
    members1.push_back(GroupMember {
        address: member_addr.clone(),
        name: String::from_str(&env, "Alice"),
        percentage: 10000,
    });

    let v1_group1 = AutoShareDetailsV1 {
        id: id1.clone(),
        name: String::from_str(&env, "V1 Alpha"),
        creator: creator.clone(),
        usage_count: 5,
        payment_token: token.clone(),
        members: members1.clone(),
    };

    let v1_group2 = AutoShareDetailsV1 {
        id: id2.clone(),
        name: String::from_str(&env, "V1 Beta"),
        creator: creator.clone(),
        usage_count: 10,
        payment_token: token.clone(),
        members: Vec::new(&env),
    };

    env.as_contract(&contract_id, || {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::SchemaVersion, &1u32);
        env.storage().instance().set(&DataKey::Paused, &false);

        env.storage()
            .persistent()
            .set(&DataKey::Group(id1.clone()), &v1_group1);
        env.storage()
            .persistent()
            .set(&DataKey::Group(id2.clone()), &v1_group2);

        let mut creator_groups = Vec::new(&env);
        creator_groups.push_back(id1.clone());
        creator_groups.push_back(id2.clone());
        env.storage()
            .persistent()
            .set(&DataKey::CreatorGroups(creator.clone()), &creator_groups);

        let mut all_groups = Vec::new(&env);
        all_groups.push_back(id1.clone());
        all_groups.push_back(id2.clone());
        env.storage()
            .persistent()
            .set(&DataKey::AllGroups, &all_groups);
    });

    assert_eq!(client.schema_version(), 1);

    // 1. Assert mutating calls fail with MigrationRequired while schema_version != CURRENT_SCHEMA_VERSION
    let new_id = BytesN::from_array(&env, &[103u8; 32]);
    let err_create = client.try_create(
        &new_id,
        &String::from_str(&env, "New Group"),
        &creator,
        &1,
        &token,
    );
    assert_eq!(err_create, Err(Ok(AutoShareError::MigrationRequired)));

    let err_update = client.try_update_members(&id1, &creator, &members1, &1);
    assert_eq!(err_update, Err(Ok(AutoShareError::MigrationRequired)));

    let err_distribute = client.try_distribute(&id1, &creator, &100);
    assert_eq!(err_distribute, Err(Ok(AutoShareError::MigrationRequired)));

    // 2. Assert read operations remain available and correctly return v1 group data
    let group1 = client.get(&id1);
    assert_eq!(group1.id, id1);
    assert_eq!(group1.name, String::from_str(&env, "V1 Alpha"));
    assert_eq!(group1.creator, creator);
    assert_eq!(group1.usage_count, 5);
    assert_eq!(group1.version, 1);
    assert_eq!(group1.members.len(), 1);

    let creator_groups = client.get_groups_by_creator(&creator);
    assert_eq!(creator_groups.len(), 2);

    let shares = client.get_member_shares(&id1, &1000);
    assert_eq!(shares.get(0).unwrap(), 1000);

    // 3. Pause and run migration
    client.pause(&admin);
    let progress = client.migrate(&admin, &10);
    assert_eq!(progress.migrated, 2);
    assert_eq!(progress.remaining, 0);
    assert!(progress.done);

    assert_eq!(client.schema_version(), CURRENT_SCHEMA_VERSION);
    client.unpause(&admin);

    // 4. Assert mutations now succeed
    let res_create = client.try_create(
        &new_id,
        &String::from_str(&env, "New Group"),
        &creator,
        &1,
        &token,
    );
    assert!(res_create.is_ok());

    // 5. Assert every group's data survived field-for-field with upgraded schema version
    let upgraded_g1 = client.get(&id1);
    assert_eq!(upgraded_g1.id, v1_group1.id);
    assert_eq!(upgraded_g1.name, v1_group1.name);
    assert_eq!(upgraded_g1.creator, v1_group1.creator);
    assert_eq!(upgraded_g1.usage_count, v1_group1.usage_count);
    assert_eq!(upgraded_g1.payment_token, v1_group1.payment_token);
    assert_eq!(upgraded_g1.members, v1_group1.members);
    assert_eq!(upgraded_g1.version, CURRENT_SCHEMA_VERSION);

    let upgraded_g2 = client.get(&id2);
    assert_eq!(upgraded_g2.id, v1_group2.id);
    assert_eq!(upgraded_g2.name, v1_group2.name);
    assert_eq!(upgraded_g2.creator, v1_group2.creator);
    assert_eq!(upgraded_g2.usage_count, v1_group2.usage_count);
    assert_eq!(upgraded_g2.payment_token, v1_group2.payment_token);
    assert_eq!(upgraded_g2.members, v1_group2.members);
    assert_eq!(upgraded_g2.version, CURRENT_SCHEMA_VERSION);
}

#[test]
fn test_batch_resumption_7_groups_limit_3() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    client.init(&Address::generate(&env));
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let token = Address::generate(&env);

    // Setup 7 groups in V1 layout
    let mut all_ids = Vec::new(&env);
    env.as_contract(&contract_id, || {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::SchemaVersion, &1u32);
        env.storage().instance().set(&DataKey::Paused, &false);

        for i in 1..=7u8 {
            let id = BytesN::from_array(&env, &[i; 32]);
            all_ids.push_back(id.clone());

            let v1 = AutoShareDetailsV1 {
                id: id.clone(),
                name: String::from_str(&env, "Group"),
                creator: creator.clone(),
                usage_count: i as u32,
                payment_token: token.clone(),
                members: Vec::new(&env),
            };
            env.storage().persistent().set(&DataKey::Group(id), &v1);
        }

        env.storage()
            .persistent()
            .set(&DataKey::AllGroups, &all_ids);
    });

    // Call 1: limit 3 -> migrates 3, 4 remaining
    let p1 = client.migrate(&admin, &3);
    assert_eq!(p1.migrated, 3);
    assert_eq!(p1.remaining, 4);
    assert!(!p1.done);
    assert_eq!(client.schema_version(), 1);

    // Call 2: limit 3 -> migrates 3, 1 remaining
    let p2 = client.migrate(&admin, &3);
    assert_eq!(p2.migrated, 3);
    assert_eq!(p2.remaining, 1);
    assert!(!p2.done);
    assert_eq!(client.schema_version(), 1);

    // Call 3: limit 3 -> migrates 1, 0 remaining, done!
    let p3 = client.migrate(&admin, &3);
    assert_eq!(p3.migrated, 1);
    assert_eq!(p3.remaining, 0);
    assert!(p3.done);
    assert_eq!(client.schema_version(), CURRENT_SCHEMA_VERSION);

    // Exactly 3 calls completed migration. 4th call returns NothingToMigrate.
    let err = client.try_migrate(&admin, &3);
    assert_eq!(err, Err(Ok(AutoShareError::NothingToMigrate)));

    // Verify all 7 groups are migrated to CURRENT_SCHEMA_VERSION
    for i in 1..=7u8 {
        let id = BytesN::from_array(&env, &[i; 32]);
        let g = client.get(&id);
        assert_eq!(g.version, CURRENT_SCHEMA_VERSION);
        assert_eq!(g.usage_count, i as u32);
    }
}

#[test]
fn test_interrupted_migration_consistent_state() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    client.init(&Address::generate(&env));
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let token = Address::generate(&env);

    let mut all_ids = Vec::new(&env);
    env.as_contract(&contract_id, || {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::SchemaVersion, &1u32);
        env.storage().instance().set(&DataKey::Paused, &false);

        for i in 1..=5u8 {
            let id = BytesN::from_array(&env, &[i; 32]);
            all_ids.push_back(id.clone());

            let v1 = AutoShareDetailsV1 {
                id: id.clone(),
                name: String::from_str(&env, "Group"),
                creator: creator.clone(),
                usage_count: i as u32,
                payment_token: token.clone(),
                members: Vec::new(&env),
            };
            env.storage().persistent().set(&DataKey::Group(id), &v1);
        }

        env.storage()
            .persistent()
            .set(&DataKey::AllGroups, &all_ids);
    });

    // Run batch 1 (2 groups) and interrupt (don't call migrate again)
    let p1 = client.migrate(&admin, &2);
    assert_eq!(p1.migrated, 2);
    assert_eq!(p1.remaining, 3);
    assert!(!p1.done);

    // Verify readable state for all 5 groups
    for i in 1..=5u8 {
        let id = BytesN::from_array(&env, &[i; 32]);
        let g = client.get(&id);
        assert_eq!(g.usage_count, i as u32);
        if i <= 2 {
            assert_eq!(g.version, CURRENT_SCHEMA_VERSION);
        } else {
            assert_eq!(g.version, 1);
        }
    }
}

#[test]
fn test_non_admin_upgrade_unauthorized() {
    let (env, client, _creator, _token) = setup_env();
    let stranger = Address::generate(&env);
    let fake_wasm_hash = BytesN::from_array(&env, &[99u8; 32]);

    let err = client.try_upgrade(&stranger, &fake_wasm_hash);
    assert_eq!(err, Err(Ok(AutoShareError::Unauthorized)));
}

#[test]
fn test_non_admin_migrate_unauthorized() {
    let (env, client, _creator, _token) = setup_env();
    let stranger = Address::generate(&env);

    let err = client.try_migrate(&stranger, &5);
    assert_eq!(err, Err(Ok(AutoShareError::Unauthorized)));
}

#[test]
fn test_upgrade_while_unpaused_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.init(&admin);

    let fake_wasm_hash = BytesN::from_array(&env, &[88u8; 32]);

    // Contract is not paused -> upgrade returns ContractNotPaused
    let err = client.try_upgrade(&admin, &fake_wasm_hash);
    assert_eq!(err, Err(Ok(AutoShareError::ContractNotPaused)));

    // Pause contract -> upgrade proceeds past the pause check
    client.pause(&admin);
    // Note: upgrade with a non-existent wasm hash in test env will fail at deployer level or succeed if mock
    let res = client.try_upgrade(&admin, &fake_wasm_hash);
    // In soroban testutils with mock_all_auths, deployer update will succeed or throw host error for invalid wasm,
    // but the contract level validation (auth and pause) succeeded.
    assert_ne!(res, Err(Ok(AutoShareError::ContractNotPaused)));
    assert_ne!(res, Err(Ok(AutoShareError::Unauthorized)));
}

#[test]
fn test_migrate_when_current_returns_nothing_to_migrate() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.init(&admin);

    assert_eq!(client.schema_version(), CURRENT_SCHEMA_VERSION);
    let err = client.try_migrate(&admin, &10);
    assert_eq!(err, Err(Ok(AutoShareError::NothingToMigrate)));
}

#[test]
fn test_pause_unpause_admin_only() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let stranger = Address::generate(&env);
    client.init(&admin);

    // Non-admin cannot pause or unpause
    assert_eq!(
        client.try_pause(&stranger),
        Err(Ok(AutoShareError::Unauthorized))
    );
    assert_eq!(
        client.try_unpause(&stranger),
        Err(Ok(AutoShareError::Unauthorized))
    );

    // Admin can pause and unpause
    assert!(client.try_pause(&admin).is_ok());
    assert!(client.try_unpause(&admin).is_ok());
}

#[test]
fn test_all_groups_global_index_maintained_on_create() {
    let (env, client, creator, token) = setup_env();

    let id1 = BytesN::from_array(&env, &[111u8; 32]);
    let id2 = BytesN::from_array(&env, &[112u8; 32]);

    client.create(&id1, &String::from_str(&env, "G1"), &creator, &1, &token);
    client.create(&id2, &String::from_str(&env, "G2"), &creator, &2, &token);

    let g1 = client.get(&id1);
    assert_eq!(g1.version, CURRENT_SCHEMA_VERSION);
    let g2 = client.get(&id2);
    assert_eq!(g2.version, CURRENT_SCHEMA_VERSION);
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
    client.init(&Address::generate(&env));
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
    client.init(&Address::generate(&env));
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

// ── escrow helpers ───────────────────────────────────────────────────────────

/// Creates a token-backed group, mints `funding` to the creator, and returns the
/// env, client, group id, payer, token address and the member addresses in order.
fn setup_escrow(
    id_byte: u8,
    percentages: &[u32],
    funding: i128,
) -> (
    Env,
    AutoShareContractClient<'static>,
    BytesN<32>,
    Address,
    Address,
    Vec<Address>,
) {
    let (env, client, creator, token_address) = setup_token_env();
    soroban_sdk::token::StellarAssetClient::new(&env, &token_address).mint(&creator, &funding);
    let (id, members) = setup_group_with_members(
        &env,
        &client,
        &creator,
        &token_address,
        id_byte,
        percentages,
    );
    (env, client, id, creator, token_address, members)
}

/// Mirror of the Stellar asset contract's storage key layout.
///
/// Soroban encodes `#[contracttype]` enum keys by variant name, so this matches
/// the real contract's `Balance(Address)` entry. It exists only so the TTL test
/// can keep the payment token's own entries alive across a ledger jump.
#[soroban_sdk::contracttype]
enum SacDataKey {
    Balance(Address),
}

/// Deterministic PRNG for the escrow fuzz test. `no_std`-friendly and seeded so
/// a failure is always reproducible.
struct Lcg(u64);

impl Lcg {
    fn next(&mut self) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        self.0 >> 33
    }

    fn below(&mut self, bound: u64) -> u64 {
        self.next() % bound
    }
}

/// Reads the escrow accounting invariant from inside the contract's storage.
fn escrow_accounting_holds(
    env: &Env,
    client: &AutoShareContractClient,
    id: &BytesN<32>,
    members: &Vec<Address>,
) -> bool {
    env.as_contract(&client.address, || {
        base::escrow::accounting_holds(env, id, members)
    })
}

// ── escrow: deposit ──────────────────────────────────────────────────────────

#[test]
fn test_escrow_deposit_credits_each_member_and_total() {
    let (env, client, id, payer, _token, members) = setup_escrow(10, &[6000, 4000], 1_000);

    client.deposit(&id, &payer, &1_000);

    assert_eq!(client.claimable_balance(&id, &members.get(0).unwrap()), 600);
    assert_eq!(client.claimable_balance(&id, &members.get(1).unwrap()), 400);
    assert_eq!(client.total_escrowed(&id), 1_000);
    assert!(escrow_accounting_holds(&env, &client, &id, &members));
}

#[test]
fn test_escrow_deposit_takes_custody_of_the_full_amount() {
    let (env, client, id, payer, token, _members) = setup_escrow(11, &[5000, 5000], 1_000);
    let token_client = soroban_sdk::token::Client::new(&env, &token);

    client.deposit(&id, &payer, &600);

    // One transfer out of the payer, into the contract — not N member transfers.
    assert_eq!(token_client.balance(&payer), 400);
    assert_eq!(token_client.balance(&client.address), 600);
}

#[test]
fn test_escrow_deposit_accumulates_across_calls() {
    let (env, client, id, payer, _token, members) = setup_escrow(12, &[5000, 5000], 1_000);

    client.deposit(&id, &payer, &100);
    client.deposit(&id, &payer, &300);

    assert_eq!(client.claimable_balance(&id, &members.get(0).unwrap()), 200);
    assert_eq!(client.claimable_balance(&id, &members.get(1).unwrap()), 200);
    assert_eq!(client.total_escrowed(&id), 400);
    assert!(escrow_accounting_holds(&env, &client, &id, &members));
}

#[test]
fn test_escrow_deposit_empty_members_takes_no_custody() {
    let (env, client, creator, token_address) = setup_token_env();
    soroban_sdk::token::StellarAssetClient::new(&env, &token_address).mint(&creator, &1_000);
    let token_client = soroban_sdk::token::Client::new(&env, &token_address);

    let id = BytesN::from_array(&env, &[13u8; 32]);
    client.create(
        &id,
        &String::from_str(&env, "No Members"),
        &creator,
        &1,
        &token_address,
    );

    let result = client.try_deposit(&id, &creator, &500);
    assert_eq!(result, Err(Ok(AutoShareError::EmptyMembers)));

    // The contract must not be left holding tokens nobody can claim.
    assert_eq!(token_client.balance(&client.address), 0);
    assert_eq!(token_client.balance(&creator), 1_000);
    assert_eq!(client.total_escrowed(&id), 0);
}

#[test]
fn test_escrow_deposit_rejects_non_positive_amounts() {
    let (_env, client, id, payer, _token, _members) = setup_escrow(14, &[10000], 1_000);

    assert_eq!(
        client.try_deposit(&id, &payer, &0),
        Err(Ok(AutoShareError::InvalidAmount))
    );
    assert_eq!(
        client.try_deposit(&id, &payer, &-1),
        Err(Ok(AutoShareError::InvalidAmount))
    );
    assert_eq!(client.total_escrowed(&id), 0);
}

#[test]
fn test_escrow_deposit_rejects_unknown_group() {
    let (env, client, _id, payer, _token, _members) = setup_escrow(15, &[10000], 1_000);
    let missing = BytesN::from_array(&env, &[200u8; 32]);

    assert_eq!(
        client.try_deposit(&missing, &payer, &10),
        Err(Ok(AutoShareError::GroupNotFound))
    );
}

#[test]
fn test_escrow_deposit_rejects_insufficient_balance() {
    let (env, client, id, payer, token, _members) = setup_escrow(16, &[10000], 50);
    let token_client = soroban_sdk::token::Client::new(&env, &token);

    assert_eq!(
        client.try_deposit(&id, &payer, &51),
        Err(Ok(AutoShareError::InsufficientBalance))
    );
    assert_eq!(token_client.balance(&payer), 50);
    assert_eq!(token_client.balance(&client.address), 0);
}

// ── escrow: claim ────────────────────────────────────────────────────────────

#[test]
fn test_escrow_claim_pays_member_and_clears_the_entry() {
    let (env, client, id, payer, token, members) = setup_escrow(20, &[7000, 3000], 1_000);
    let token_client = soroban_sdk::token::Client::new(&env, &token);
    let alice = members.get(0).unwrap();

    client.deposit(&id, &payer, &1_000);
    let claimed = client.claim(&id, &alice);

    assert_eq!(claimed, 700);
    assert_eq!(token_client.balance(&alice), 700);
    assert_eq!(client.claimable_balance(&id, &alice), 0);
    assert_eq!(client.total_escrowed(&id), 300);
    assert_eq!(token_client.balance(&client.address), 300);
    assert!(escrow_accounting_holds(&env, &client, &id, &members));
}

#[test]
fn test_escrow_claim_to_pays_an_alternate_address() {
    let (env, client, id, payer, token, members) = setup_escrow(21, &[10000], 1_000);
    let token_client = soroban_sdk::token::Client::new(&env, &token);
    let member = members.get(0).unwrap();
    let payout = Address::generate(&env);

    client.deposit(&id, &payer, &400);
    let claimed = client.claim_to(&id, &member, &payout);

    assert_eq!(claimed, 400);
    assert_eq!(token_client.balance(&payout), 400);
    assert_eq!(token_client.balance(&member), 0);
    assert_eq!(client.claimable_balance(&id, &member), 0);
    assert_eq!(client.total_escrowed(&id), 0);
}

#[test]
fn test_escrow_double_claim_returns_nothing_to_claim() {
    let (env, client, id, payer, token, members) = setup_escrow(22, &[10000], 1_000);
    let token_client = soroban_sdk::token::Client::new(&env, &token);
    let member = members.get(0).unwrap();

    client.deposit(&id, &payer, &250);
    assert_eq!(client.claim(&id, &member), 250);

    assert_eq!(
        client.try_claim(&id, &member),
        Err(Ok(AutoShareError::NothingToClaim))
    );
    // The second call moved nothing.
    assert_eq!(token_client.balance(&member), 250);
}

#[test]
fn test_escrow_claim_with_zero_balance_returns_nothing_to_claim() {
    // 1 stroop across a 99.99% / 0.01% split floors the first member's share to
    // zero, so they are a member with nothing owed.
    let (_env, client, id, payer, _token, members) = setup_escrow(23, &[9999, 1], 1_000);
    let starved = members.get(0).unwrap();

    client.deposit(&id, &payer, &1);

    assert_eq!(client.claimable_balance(&id, &starved), 0);
    assert_eq!(
        client.try_claim(&id, &starved),
        Err(Ok(AutoShareError::NothingToClaim))
    );
}

#[test]
fn test_escrow_claim_by_non_member_returns_member_not_found() {
    let (env, client, id, payer, token, _members) = setup_escrow(24, &[10000], 1_000);
    let token_client = soroban_sdk::token::Client::new(&env, &token);
    let stranger = Address::generate(&env);

    client.deposit(&id, &payer, &500);

    assert_eq!(
        client.try_claim(&id, &stranger),
        Err(Ok(AutoShareError::MemberNotFound))
    );
    // Nothing moved: the stranger is empty and the escrow is untouched.
    assert_eq!(token_client.balance(&stranger), 0);
    assert_eq!(token_client.balance(&client.address), 500);
    assert_eq!(client.total_escrowed(&id), 500);
}

#[test]
fn test_escrow_claim_rejects_unknown_group() {
    let (env, client, _id, _payer, _token, members) = setup_escrow(25, &[10000], 1_000);
    let missing = BytesN::from_array(&env, &[201u8; 32]);

    assert_eq!(
        client.try_claim(&missing, &members.get(0).unwrap()),
        Err(Ok(AutoShareError::GroupNotFound))
    );
}

// ── escrow: snapshot semantics ───────────────────────────────────────────────

#[test]
fn test_escrow_credits_survive_a_full_member_replacement() {
    let (env, client, id, payer, token, original) = setup_escrow(30, &[6000, 4000], 10_000);
    let token_client = soroban_sdk::token::Client::new(&env, &token);
    let alice = original.get(0).unwrap();
    let bob = original.get(1).unwrap();

    client.deposit(&id, &payer, &1_000);

    // Swap the entire member list out for a different set.
    let carol = Address::generate(&env);
    let dave = Address::generate(&env);
    let replacements = vec![
        &env,
        GroupMember {
            address: carol.clone(),
            name: String::from_str(&env, "Carol"),
            percentage: 5000,
        },
        GroupMember {
            address: dave.clone(),
            name: String::from_str(&env, "Dave"),
            percentage: 5000,
        },
    ];
    client.update_members(&id, &payer, &replacements, &2);

    // The original members keep exactly what the earlier deposit credited them.
    assert_eq!(client.claimable_balance(&id, &alice), 600);
    assert_eq!(client.claimable_balance(&id, &bob), 400);
    assert_eq!(client.claimable_balance(&id, &carol), 0);
    assert_eq!(client.claimable_balance(&id, &dave), 0);

    assert_eq!(client.claim(&id, &alice), 600);
    assert_eq!(client.claim(&id, &bob), 400);
    assert_eq!(token_client.balance(&alice), 600);
    assert_eq!(token_client.balance(&bob), 400);
    assert_eq!(client.total_escrowed(&id), 0);

    // A later deposit credits only the new member set.
    client.deposit(&id, &payer, &200);
    assert_eq!(client.claimable_balance(&id, &carol), 100);
    assert_eq!(client.claimable_balance(&id, &dave), 100);
    assert_eq!(client.claimable_balance(&id, &alice), 0);
}

// ── escrow: accounting ───────────────────────────────────────────────────────

#[test]
fn test_escrow_no_dust_leaks_across_100_uneven_deposits() {
    // 1_000 over 7 members at 1429/1429/1429/1429/1429/1428/1427 bps never
    // divides evenly, so every deposit produces remainder dust.
    let percentages = [1429u32, 1429, 1429, 1429, 1429, 1428, 1427];
    let (env, client, id, payer, token, members) = setup_escrow(31, &percentages, 1_000_000);
    let token_client = soroban_sdk::token::Client::new(&env, &token);

    let deposit_amount: i128 = 1_000;
    for _ in 0..100 {
        client.deposit(&id, &payer, &deposit_amount);
    }

    let total_deposited = deposit_amount * 100;
    let summed = env.as_contract(&client.address, || {
        base::escrow::sum_claimable(&env, &id, &members)
    });

    assert_eq!(summed, total_deposited, "stroops leaked across deposits");
    assert_eq!(client.total_escrowed(&id), total_deposited);
    assert_eq!(token_client.balance(&client.address), total_deposited);

    // And every stroop is actually payable.
    let mut paid: i128 = 0;
    for member in members.iter() {
        paid += client.claim(&id, &member);
    }
    assert_eq!(paid, total_deposited);
    assert_eq!(client.total_escrowed(&id), 0);
    assert_eq!(token_client.balance(&client.address), 0);
}

#[test]
fn test_escrow_fuzz_deposits_and_claims_hold_the_invariant() {
    let percentages = [3333u32, 3333, 3334];
    let (env, client, id, payer, token, members) = setup_escrow(32, &percentages, 1_000_000);
    let token_client = soroban_sdk::token::Client::new(&env, &token);

    let mut rng = Lcg(0x5EED_1234_ABCD_0001);
    let mut deposited: i128 = 0;
    let mut claimed: i128 = 0;

    for _ in 0..120 {
        if rng.below(2) == 0 {
            let amount = (rng.below(997) + 1) as i128;
            client.deposit(&id, &payer, &amount);
            deposited += amount;
        } else {
            let member = members.get(rng.below(members.len() as u64) as u32).unwrap();
            // A claim is only legal when something is owed; an empty member
            // must report NothingToClaim rather than move tokens.
            let owed = client.claimable_balance(&id, &member);
            if owed > 0 {
                assert_eq!(client.claim(&id, &member), owed);
                claimed += owed;
            } else {
                assert_eq!(
                    client.try_claim(&id, &member),
                    Err(Ok(AutoShareError::NothingToClaim))
                );
            }
        }

        // The invariant must hold after every single step.
        assert!(
            escrow_accounting_holds(&env, &client, &id, &members),
            "sum(claimable) != total_escrowed"
        );
        assert_eq!(client.total_escrowed(&id), deposited - claimed);
        assert_eq!(token_client.balance(&client.address), deposited - claimed);
    }

    assert!(
        deposited > 0 && claimed > 0,
        "fuzz run exercised both paths"
    );
}

#[test]
fn test_escrow_totals_across_groups_never_exceed_contract_balance() {
    let (env, client, creator, token_address) = setup_token_env();
    soroban_sdk::token::StellarAssetClient::new(&env, &token_address).mint(&creator, &100_000);
    let token_client = soroban_sdk::token::Client::new(&env, &token_address);

    let (first, first_members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 33, &[5000, 5000]);
    let (second, second_members) =
        setup_group_with_members(&env, &client, &creator, &token_address, 34, &[2500, 7500]);

    client.deposit(&first, &creator, &1_111);
    client.deposit(&second, &creator, &2_222);
    client.claim(&first, &first_members.get(0).unwrap());

    let combined = client.total_escrowed(&first) + client.total_escrowed(&second);
    assert!(combined <= token_client.balance(&client.address));
    assert_eq!(combined, token_client.balance(&client.address));

    // Each group's books balance independently.
    assert!(escrow_accounting_holds(
        &env,
        &client,
        &first,
        &first_members
    ));
    assert!(escrow_accounting_holds(
        &env,
        &client,
        &second,
        &second_members
    ));
}

// ── escrow: write ordering (reentrancy) ──────────────────────────────────────

#[test]
fn test_escrow_settle_clears_state_before_any_transfer() {
    let (env, client, id, payer, token, members) = setup_escrow(35, &[6000, 4000], 10_000);
    let token_client = soroban_sdk::token::Client::new(&env, &token);
    let alice = members.get(0).unwrap();

    client.deposit(&id, &payer, &1_000);

    // `claim_to` runs `settle_claim` to completion and only then calls the token
    // contract. Driving the effects half on its own shows the exact state a
    // reentrant token would see: the entry is already gone and the group total
    // already decremented, while not a single stroop has moved.
    let settled = env.as_contract(&client.address, || {
        let details = base::auth::validate_group_exists(&env, &id).unwrap();
        base::escrow::settle_claim(&env, &id, &alice, &details).unwrap()
    });

    assert_eq!(settled, 600);
    assert_eq!(client.claimable_balance(&id, &alice), 0);
    assert_eq!(client.total_escrowed(&id), 400);
    assert_eq!(token_client.balance(&alice), 0);
    assert_eq!(token_client.balance(&client.address), 1_000);

    // A reentrant second attempt at that point finds nothing left to take.
    let reentrant = env.as_contract(&client.address, || {
        let details = base::auth::validate_group_exists(&env, &id).unwrap();
        base::escrow::settle_claim(&env, &id, &alice, &details)
    });
    assert_eq!(reentrant, Err(AutoShareError::NothingToClaim));
}

// ── escrow: TTL ──────────────────────────────────────────────────────────────

#[test]
fn test_escrow_entries_survive_ledger_advance_past_default_ttl() {
    let (env, client, id, payer, token, members) = setup_escrow(36, &[10000], 10_000);
    let token_client = soroban_sdk::token::Client::new(&env, &token);
    let member = members.get(0).unwrap();

    client.deposit(&id, &payer, &750);

    // The escrow contract can only extend entries it owns, so the payment token's
    // instance and the escrow's balance entry inside it have to be kept alive
    // separately. On a real network an asset contract stays live off its own
    // traffic; here the test stands in for that. `SacDataKey` mirrors the Stellar
    // asset contract's own key layout, which is encoded by variant name.
    env.as_contract(&token, || {
        env.storage().instance().extend_ttl(
            base::escrow::ESCROW_TTL_THRESHOLD,
            base::escrow::ESCROW_TTL_EXTEND_TO,
        );
        env.storage().persistent().extend_ttl(
            &SacDataKey::Balance(client.address.clone()),
            base::escrow::ESCROW_TTL_THRESHOLD,
            base::escrow::ESCROW_TTL_EXTEND_TO,
        );
    });

    // Well past the 4_096-ledger default persistent TTL, and inside the 120-day
    // window `deposit` extended every entry it wrote to.
    let advance = 60 * base::escrow::LEDGERS_PER_DAY;
    assert!(advance > 4_096);
    env.ledger().with_mut(|li| {
        li.sequence_number += advance;
    });

    assert_eq!(client.claimable_balance(&id, &member), 750);
    assert_eq!(client.total_escrowed(&id), 750);
    assert_eq!(client.claim(&id, &member), 750);
    assert_eq!(token_client.balance(&member), 750);
}

// ── escrow: additive, not a replacement ──────────────────────────────────────

#[test]
fn test_distribute_still_works_alongside_escrow() {
    let (env, client, id, payer, token, members) = setup_escrow(37, &[6000, 4000], 10_000);
    let token_client = soroban_sdk::token::Client::new(&env, &token);
    let alice = members.get(0).unwrap();
    let bob = members.get(1).unwrap();

    // The push path is unchanged and pays members directly.
    client.distribute(&id, &payer, &1_000);
    assert_eq!(token_client.balance(&alice), 600);
    assert_eq!(token_client.balance(&bob), 400);
    assert_eq!(client.total_escrowed(&id), 0);
    assert_eq!(client.claimable_balance(&id, &alice), 0);

    // And the pull path works on the same group afterwards.
    client.deposit(&id, &payer, &500);
    assert_eq!(client.claimable_balance(&id, &alice), 300);
    assert_eq!(client.claim(&id, &alice), 300);
    assert_eq!(token_client.balance(&alice), 900);
}

#[test]
fn test_granular_member_management() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, id, creator, _token, members, _) = setup_env_with_group(&env, 3);

    // Add a member
    let new_member = GroupMember {
        address: Address::generate(&env),
        name: String::from_str(&env, "New Member"),
        percentage: 1000,
    };

    // Version is 2 after creation + member list update
    client.add_member(
        &id,
        &creator,
        &new_member,
        &RebalancePolicy::Proportional,
        &2,
    );

    let group = client.get(&id);
    assert_eq!(group.group_version, 3);
    let mut total: u32 = 0;
    for m in group.members.iter() {
        total += m.percentage;
    }
    assert_eq!(total, 10_000);

    // Concurrent update should fail
    let res = client.try_add_member(
        &id,
        &creator,
        &new_member,
        &RebalancePolicy::Proportional,
        &2,
    );
    assert!(res.is_err());

    // Remove a member
    let member_to_remove = members.get(0).unwrap().address.clone();
    client.remove_member(
        &id,
        &creator,
        &member_to_remove,
        &RebalancePolicy::Proportional,
        &3,
    );

    let group2 = client.get(&id);
    assert_eq!(group2.group_version, 4);
    let mut total2: u32 = 0;
    for m in group2.members.iter() {
        total2 += m.percentage;
    }
    assert_eq!(total2, 10_000);

    // Set percentage
    let member_to_update = new_member.address.clone();
    client.set_member_percentage(
        &id,
        &creator,
        &member_to_update,
        &2000,
        &RebalancePolicy::Proportional,
        &4,
    );

    let group3 = client.get(&id);
    assert_eq!(group3.group_version, 5);
    let mut total3: u32 = 0;
    for m in group3.members.iter() {
        total3 += m.percentage;
    }
    assert_eq!(total3, 10_000);
}

// ── group creation, retrieval, and querying tests ────────────────────────────

#[test]
fn test_successful_group_creation_and_retrieval() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[100u8; 32]);
    let name = String::from_str(&env, "Engineering Team");

    // Test successful group creation
    let result = client.try_create(&id, &name, &creator, &0, &token);
    assert!(result.is_ok());

    // Test retrieving created group by ID
    let details = client.get(&id);
    assert_eq!(details.id, id);
    assert_eq!(details.name, name);
    assert_eq!(details.creator, creator);
    assert_eq!(details.usage_count, 0);
    assert_eq!(details.payment_token, token);
    assert_eq!(details.members.len(), 0);
}

#[test]
fn test_group_retrieval_when_group_does_not_exist() {
    let (_env, client, _creator, _token) = setup_env();
    let non_existent_id = BytesN::from_array(&_env, &[99u8; 32]);

    // Test group retrieval when group doesn't exist (using try_get to capture error)
    let result = client.try_get(&non_existent_id);
    assert!(result.is_err());
    assert_eq!(result, Err(Ok(AutoShareError::GroupNotFound)));
}

#[test]
fn test_get_groups_by_creator_queries() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[101u8; 32]);
    let name = String::from_str(&env, "Marketing Team");

    client.create(&id, &name, &creator, &5, &token);

    // Test getting groups by creator
    let groups = client.get_groups_by_creator(&creator);
    assert_eq!(groups.len(), 1);
    let group = groups.get(0).unwrap();
    assert_eq!(group.id, id);
    assert_eq!(group.name, name);
    assert_eq!(group.creator, creator);
}

#[test]
fn test_multiple_groups_by_same_creator() {
    let (env, client, creator, token) = setup_env();
    let id1 = BytesN::from_array(&env, &[102u8; 32]);
    let id2 = BytesN::from_array(&env, &[103u8; 32]);
    let name1 = String::from_str(&env, "Sales Team");
    let name2 = String::from_str(&env, "Support Team");

    client.create(&id1, &name1, &creator, &1, &token);
    client.create(&id2, &name2, &creator, &2, &token);

    // Test multiple groups by same creator
    let groups = client.get_groups_by_creator(&creator);
    assert_eq!(groups.len(), 2);

    let group1 = groups.get(0).unwrap();
    let group2 = groups.get(1).unwrap();

    // Check that we retrieved both groups correctly
    assert_eq!(group1.id, id1);
    assert_eq!(group1.name, name1);
    assert_eq!(group2.id, id2);
    assert_eq!(group2.name, name2);
}

#[test]
#[should_panic]
fn test_create_group_requires_authorized_creator() {
    let env = Env::default();
    // Do NOT mock_all_auths to test authorization requirement

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.init(&admin);

    let creator = Address::generate(&env);
    let token = Address::generate(&env);
    let id = BytesN::from_array(&env, &[104u8; 32]);
    let name = String::from_str(&env, "Design Team");

    // This call should panic because mock_all_auths was not called,
    // meaning the creator's authorization is missing/invalid.
    client.create(&id, &name, &creator, &0, &token);
}
