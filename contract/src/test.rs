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
#[should_panic(expected = "percentages must sum to 10000")]
fn test_update_members_invalid_percentage() {
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

    client.update_members(&id, &creator, &members); // should panic: 5000 != 10000
}

#[test]
fn test_get_groups_by_creator() {
    let (env, client, creator, token) = setup_env();

    let id1 = BytesN::from_array(&env, &[4u8; 32]);
    let id2 = BytesN::from_array(&env, &[5u8; 32]);

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
