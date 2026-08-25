#![cfg(test)]

use crate::{AutoShareContract, AutoShareContractClient};
use soroban_sdk::testutils::{Address as _, Events as _, MockAuth, MockAuthInvoke};
use soroban_sdk::{vec, Address, BytesN, Env, IntoVal, String, Symbol, TryIntoVal, TryFromVal};

// 1. init twice returns AlreadyInitialized; state from the first call is untouched.
#[test]
fn test_init_twice() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let admin1 = Address::generate(&env);
    client.init(&admin1);

    let admin2 = Address::generate(&env);
    let err = client.try_init(&admin2).unwrap_err().unwrap();
    assert_eq!(err, crate::base::errors::AutoShareError::AlreadyInitialized);

    // state from first call is untouched (admin is still admin1)
    let err2 = client.try_pause(&admin2).unwrap_err().unwrap();
    assert_eq!(err2, crate::base::errors::AutoShareError::Unauthorized);

    client.pause(&admin1); // admin1 still has admin rights
}

// 2. pause by a non-admin returns Unauthorized; by the admin, succeeds and emits the event.
#[test]
fn test_pause_unauthorized_and_authorized() {
    let env = Env::default();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "init",
            args: (&admin,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.init(&admin);

    let non_admin = Address::generate(&env);
    env.mock_auths(&[MockAuth {
        address: &non_admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "pause",
            args: (&non_admin,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let err = client.try_pause(&non_admin).unwrap_err().unwrap();
    assert_eq!(err, crate::base::errors::AutoShareError::Unauthorized);

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "pause",
            args: (&admin,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.pause(&admin);

    let events = env.events().all();
    let mut found = false;
    for event in events.iter() {
        if event.0 == contract_id {
            let topics = event.1;
            if topics.len() == 2 {
                let t0: Result<String, _> = topics.get(0).unwrap().try_into_val(&env);
                let t1: Result<String, _> = topics.get(1).unwrap().try_into_val(&env);
                
                if let (Ok(topic0), Ok(topic1)) = (t0, t1) {
                    if topic0 == String::from_str(&env, "autoshare") && topic1 == String::from_str(&env, "paused") {
                        found = true;
                        break;
                    }
                }
            }
        }
    }
    assert!(found, "paused event not found");
}

// 3. distribute while paused returns ContractPaused and moves zero tokens
#[test]
fn test_distribute_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token_address = token_id.address();
    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);

    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.init(&admin);

    let creator = Address::generate(&env);
    token_admin.mint(&creator, &1000);

    let id = BytesN::from_array(&env, &[1; 32]);
    client.create(
        &id,
        &String::from_str(&env, "G"),
        &creator,
        &1,
        &token_address,
    );
    let member = Address::generate(&env);
    client.update_members(
        &id,
        &creator,
        &vec![
            &env,
            crate::base::types::GroupMember {
                address: member.clone(),
                name: String::from_str(&env, "M"),
                percentage: 10000,
            },
        ],
        &1,
    );

    client.pause(&admin);

    let pre_balance_creator = token_client.balance(&creator);
    let pre_balance_member = token_client.balance(&member);

    let err = client
        .try_distribute(&id, &creator, &1000)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, crate::base::errors::AutoShareError::ContractPaused);

    assert_eq!(token_client.balance(&creator), pre_balance_creator);
    assert_eq!(token_client.balance(&member), pre_balance_member);
}

// 4. accept_admin called by anyone other than the pending address returns Unauthorized; with no proposal outstanding, NoPendingAdmin.
// 5. After a successful handover the old admin immediately loses pause/propose_admin rights.
#[test]
fn test_admin_handover() {
    let env = Env::default();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let old_admin = Address::generate(&env);

    env.mock_auths(&[MockAuth {
        address: &old_admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "init",
            args: (&old_admin,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.init(&old_admin);

    let stranger = Address::generate(&env);

    // No proposal outstanding
    env.mock_auths(&[MockAuth {
        address: &stranger,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "accept_admin",
            args: (&stranger,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let err = client.try_accept_admin(&stranger).unwrap_err().unwrap();
    assert_eq!(err, crate::base::errors::AutoShareError::NoPendingAdmin);

    let new_admin = Address::generate(&env);

    // old_admin proposes new_admin
    env.mock_auths(&[MockAuth {
        address: &old_admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "propose_admin",
            args: (&old_admin, &new_admin).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.propose_admin(&old_admin, &new_admin);

    // stranger tries to accept
    env.mock_auths(&[MockAuth {
        address: &stranger,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "accept_admin",
            args: (&stranger,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let err2 = client.try_accept_admin(&stranger).unwrap_err().unwrap();
    assert_eq!(err2, crate::base::errors::AutoShareError::Unauthorized);

    // new_admin accepts
    env.mock_auths(&[MockAuth {
        address: &new_admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "accept_admin",
            args: (&new_admin,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.accept_admin(&new_admin);

    // old_admin loses rights
    env.mock_auths(&[MockAuth {
        address: &old_admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "pause",
            args: (&old_admin,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let err3 = client.try_pause(&old_admin).unwrap_err().unwrap();
    assert_eq!(err3, crate::base::errors::AutoShareError::Unauthorized);
}

// 6. Every admin entrypoint before init returns NotInitialized, not GroupNotFound.
#[test]
fn test_not_initialized() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AutoShareContract, ());
    let client = AutoShareContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let new_admin = Address::generate(&env);
    let dummy_hash = BytesN::from_array(&env, &[0; 32]);

    assert_eq!(
        client.try_pause(&caller).unwrap_err().unwrap(),
        crate::base::errors::AutoShareError::NotInitialized
    );
    assert_eq!(
        client.try_unpause(&caller).unwrap_err().unwrap(),
        crate::base::errors::AutoShareError::NotInitialized
    );
    assert_eq!(
        client
            .try_propose_admin(&caller, &new_admin)
            .unwrap_err()
            .unwrap(),
        crate::base::errors::AutoShareError::NotInitialized
    );
    assert_eq!(
        client
            .try_cancel_admin_proposal(&caller)
            .unwrap_err()
            .unwrap(),
        crate::base::errors::AutoShareError::NotInitialized
    );
    assert_eq!(
        client
            .try_upgrade(&caller, &dummy_hash)
            .unwrap_err()
            .unwrap(),
        crate::base::errors::AutoShareError::NotInitialized
    );
    assert_eq!(
        client.try_migrate(&caller, &1).unwrap_err().unwrap(),
        crate::base::errors::AutoShareError::NotInitialized
    );
}
