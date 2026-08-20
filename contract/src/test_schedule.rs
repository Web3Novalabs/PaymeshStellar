use crate::base::errors::AutoShareError;
use crate::{AutoShareContract, AutoShareContractClient};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token, vec, Address, BytesN, Env, String};

fn setup_env() -> (
    Env,
    AutoShareContractClient<'static>,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.init(&admin);
    let creator = Address::generate(&env);

    // Use stellar asset token
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());

    (env, client, creator, token_id.address(), admin)
}

#[test]
fn test_create_and_get_schedule() {
    let (env, client, creator, token, _admin) = setup_env();
    let id = BytesN::from_array(&env, &[1u8; 32]);
    client.create(&id, &String::from_str(&env, "Group"), &creator, &1, &token);

    let first_run_at = env.ledger().timestamp() + 1000;
    client.create_schedule(&id, &creator, &604800, &first_run_at, &5, &100_000);

    let schedule = client.get_schedule(&id);
    assert_eq!(schedule.interval_secs, 604800);
    assert_eq!(schedule.next_run_at, first_run_at);
    assert_eq!(schedule.remaining_runs, 5);
    assert_eq!(schedule.amount, 100_000);
    assert_eq!(schedule.funder, creator);
    assert!(schedule.active);
}

#[test]
fn test_timestamp_boundaries() {
    let (env, client, creator, token, _admin) = setup_env();
    let id = BytesN::from_array(&env, &[2u8; 32]);
    client.create(&id, &String::from_str(&env, "Group"), &creator, &1, &token);

    // Add member
    let member = Address::generate(&env);
    client.update_members(
        &id,
        &creator,
        &vec![
            &env,
            crate::base::types::GroupMember {
                address: member.clone(),
                name: String::from_str(&env, "Mem"),
                percentage: 10000,
            },
        ],
    );

    let token_admin = token::StellarAssetClient::new(&env, &token);
    token_admin.mint(&creator, &1_000_000);

    let start_time = 1_000_000;
    env.ledger().set_timestamp(start_time);

    let first_run_at = start_time + 1000;
    let interval = 100;
    client.create_schedule(&id, &creator, &interval, &first_run_at, &20, &50_000);

    // 1 second before due
    env.ledger().set_timestamp(first_run_at - 1);
    let keeper = Address::generate(&env);
    let res = client.try_execute_schedule(&id, &keeper);
    assert_eq!(res.unwrap_err().unwrap(), AutoShareError::ScheduleNotDue);

    // exactly at due
    env.ledger().set_timestamp(first_run_at);
    client.execute_schedule(&id, &keeper);
    let schedule = client.get_schedule(&id);
    assert_eq!(schedule.remaining_runs, 19);
    assert_eq!(schedule.next_run_at, first_run_at + interval);

    // 3 intervals late
    env.ledger().set_timestamp(first_run_at + interval * 4); // skipped 1, 2, 3, now at 4
    client.execute_schedule(&id, &keeper);
    let schedule2 = client.get_schedule(&id);
    // Runs due: (first_run_at + interval*4 - (first_run_at + interval)) / interval + 1
    // (4 - 1) + 1 = 4 runs due.
    assert_eq!(schedule2.remaining_runs, 19 - 4);
    assert_eq!(schedule2.next_run_at, first_run_at + interval * 5); // next run at 5
}

#[test]
fn test_no_drift_random_offsets() {
    let (env, client, creator, token, _admin) = setup_env();
    let id = BytesN::from_array(&env, &[3u8; 32]);
    client.create(&id, &String::from_str(&env, "Group"), &creator, &1, &token);

    let member = Address::generate(&env);
    client.update_members(
        &id,
        &creator,
        &vec![
            &env,
            crate::base::types::GroupMember {
                address: member.clone(),
                name: String::from_str(&env, "Mem"),
                percentage: 10000,
            },
        ],
    );

    let token_admin = token::StellarAssetClient::new(&env, &token);
    token_admin.mint(&creator, &1_000_000);

    let start_time = 1_000_000;
    env.ledger().set_timestamp(start_time);

    let first_run_at = start_time + 1000;
    let interval = 100;
    client.create_schedule(&id, &creator, &interval, &first_run_at, &20, &5_000);

    let keeper = Address::generate(&env);
    let mut expected_next = first_run_at;

    for i in 0..10 {
        // Random offset after due time (simulated via pseudorandom logic)
        let offset = 1 + (i * 7) % 90; // offset between 1 and 90 seconds
        env.ledger().set_timestamp(expected_next + offset);

        client.execute_schedule(&id, &keeper);
        expected_next += interval;

        let schedule = client.get_schedule(&id);
        assert_eq!(schedule.next_run_at, expected_next);
        assert_eq!(schedule.remaining_runs, 20 - 1 - i as u32);
    }

    assert_eq!(expected_next, first_run_at + 10 * interval);
}

#[test]
fn test_funder_drained_and_recovered() {
    let (env, client, creator, token, _admin) = setup_env();
    let id = BytesN::from_array(&env, &[4u8; 32]);
    client.create(&id, &String::from_str(&env, "Group"), &creator, &1, &token);

    let member = Address::generate(&env);
    client.update_members(
        &id,
        &creator,
        &vec![
            &env,
            crate::base::types::GroupMember {
                address: member.clone(),
                name: String::from_str(&env, "Mem"),
                percentage: 10000,
            },
        ],
    );

    let token_admin = token::StellarAssetClient::new(&env, &token);
    token_admin.mint(&creator, &50_000);

    let start_time = 1_000_000;
    env.ledger().set_timestamp(start_time);

    let first_run_at = start_time + 1000;
    let interval = 100;
    client.create_schedule(&id, &creator, &interval, &first_run_at, &5, &50_000);

    let keeper = Address::generate(&env);
    env.ledger().set_timestamp(first_run_at);

    // First run succeeds
    client.execute_schedule(&id, &keeper);

    // Funder drained (balance now 0). Second run should fail cleanly.
    env.ledger().set_timestamp(first_run_at + interval);
    let res = client.try_execute_schedule(&id, &keeper);
    assert_eq!(
        res.unwrap_err().unwrap(),
        AutoShareError::InsufficientBalance
    );

    let schedule = client.get_schedule(&id);
    assert_eq!(schedule.next_run_at, first_run_at + interval);
    assert_eq!(schedule.remaining_runs, 4); // unchanged

    // Refund funder
    token_admin.mint(&creator, &50_000);

    // Later run succeeds
    client.execute_schedule(&id, &keeper);
    let schedule_after = client.get_schedule(&id);
    assert_eq!(schedule_after.next_run_at, first_run_at + interval * 2);
    assert_eq!(schedule_after.remaining_runs, 3);
}

#[test]
fn test_remaining_runs_hitting_zero() {
    let (env, client, creator, token, _admin) = setup_env();
    let id = BytesN::from_array(&env, &[5u8; 32]);
    client.create(&id, &String::from_str(&env, "Group"), &creator, &1, &token);

    let member = Address::generate(&env);
    client.update_members(
        &id,
        &creator,
        &vec![
            &env,
            crate::base::types::GroupMember {
                address: member.clone(),
                name: String::from_str(&env, "Mem"),
                percentage: 10000,
            },
        ],
    );

    let token_admin = token::StellarAssetClient::new(&env, &token);
    token_admin.mint(&creator, &50_000);

    let start_time = 1_000_000;
    env.ledger().set_timestamp(start_time);

    let first_run_at = start_time + 1000;
    client.create_schedule(&id, &creator, &100, &first_run_at, &1, &50_000);

    let keeper = Address::generate(&env);
    env.ledger().set_timestamp(first_run_at);
    client.execute_schedule(&id, &keeper);

    let schedule = client.get_schedule(&id);
    assert_eq!(schedule.remaining_runs, 0);
    assert!(!schedule.active);

    // Further executions return ScheduleInactive
    env.ledger().set_timestamp(first_run_at + 100);
    let res = client.try_execute_schedule(&id, &keeper);
    assert_eq!(res.unwrap_err().unwrap(), AutoShareError::ScheduleInactive);
}

#[test]
fn test_paused_behavior() {
    let (env, client, creator, token, admin) = setup_env();
    let id = BytesN::from_array(&env, &[6u8; 32]);
    client.create(&id, &String::from_str(&env, "Group"), &creator, &1, &token);

    let start_time = 1_000_000;
    env.ledger().set_timestamp(start_time);
    client.create_schedule(&id, &creator, &100, &start_time, &10, &1000);

    client.pause(&admin);

    let keeper = Address::generate(&env);
    let res = client.try_execute_schedule(&id, &keeper);
    assert_eq!(res.unwrap_err().unwrap(), AutoShareError::ContractPaused);
}
