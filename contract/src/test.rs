#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    vec, Address, BytesN, Env, String, Vec,
};

// ── helpers ──────────────────────────────────────────────────────────────────

fn setup_env() -> (Env, AutoShareContractClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
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

    client.update_members(&id, creator, &members);
    (id, addresses)
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

    let result = client.try_update_members(&id, &creator, &members);
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

    let result = client.try_update_members(&id, &other_user, &members);
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

    let result = client.try_update_members(&id, &Address::generate(&env), &members);
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

    let result = client.try_update_members(&id, &creator, &members);
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
    let result = client.try_update_members(&id, &attacker, &members);
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
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[20u8; 32]);
    client.create(&id, &String::from_str(&env, "G"), &creator, &1, &token);
    let result = client.try_distribute(&id, &creator, &0);
    assert!(result.is_err());
}

#[test]
fn test_distribute_negative_amount() {
    let (env, client, creator, token) = setup_env();
    let id = BytesN::from_array(&env, &[21u8; 32]);
    client.create(&id, &String::from_str(&env, "G"), &creator, &1, &token);
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

    let (id, _) =
        setup_group_with_members(&env, &client, &creator, &token_address, 30, &[5000, 5000]);
    let result = client.try_distribute(&id, &creator, &1000);
    assert!(result.is_err());
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
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    let creator = Address::generate(&env);
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
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    let creator = Address::generate(&env);
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
    client.update_members(&id, &creator, &members);

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
