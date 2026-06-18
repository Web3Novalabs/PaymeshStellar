use soroban_sdk::{Address, BytesN, Env};

pub fn group_created(env: &Env, id: &BytesN<32>, creator: &Address) {
    env.events()
        .publish(("autoshare", "created"), (id.clone(), creator.clone()));
}

pub fn members_updated(env: &Env, id: &BytesN<32>, member_count: u32) {
    env.events()
        .publish(("autoshare", "members_updated"), (id.clone(), member_count));
}

pub fn distribution_processed(env: &Env, id: &BytesN<32>, total_amount: i128) {
    env.events().publish(
        ("autoshare", "distribution_processed"),
        (id.clone(), total_amount),
    );
}
