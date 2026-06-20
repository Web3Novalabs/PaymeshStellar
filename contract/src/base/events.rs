use soroban_sdk::{Address, BytesN, Env};

pub fn group_created(env: &Env, id: &BytesN<32>, creator: &Address) {
    env.events()
        .publish(("autoshare", "created"), (id.clone(), creator.clone()));
}

pub fn members_updated(env: &Env, id: &BytesN<32>, member_count: u32) {
    env.events()
        .publish(("autoshare", "members_updated"), (id.clone(), member_count));
}

pub fn distributed(env: &Env, id: &BytesN<32>, from: &Address, amount: i128) {
    env.events().publish(
        ("autoshare", "distributed"),
        (id.clone(), from.clone(), amount),
    );
}
