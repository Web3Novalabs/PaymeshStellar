# AutoShare Contract

AutoShare is a Soroban contract for creating payment-sharing groups and
distributing Stellar-compatible tokens among configured members. Member shares
are expressed in basis points: `10_000` basis points equals 100%, `5_000`
equals 50%, and `100` equals 1%.

## Contract API

| Function | Signature | Authentication | Errors | Event |
|---|---|---|---|---|
| `create` | `create(id, name, creator, usage_count, payment_token) -> Result<(), AutoShareError>` | `creator` | `GroupAlreadyExists` | `("autoshare", "created")`, payload `(id, creator)` |
| `update_members` | `update_members(id, caller, new_members) -> Result<(), AutoShareError>` | `caller`, who must be the group creator | `GroupNotFound`, `Unauthorized`, `EmptyMembers`, `DuplicateMember`, `InvalidPercentage` | `("autoshare", "members_updated")`, payload `(id, member_count)` |
| `get` | `get(id) -> Result<AutoShareDetails, AutoShareError>` | None | `GroupNotFound` | None |
| `get_groups_by_creator` | `get_groups_by_creator(creator) -> Vec<AutoShareDetails>` | None | None | None |
| `distribute` | `distribute(id, from, amount) -> Result<(), AutoShareError>` | `from` | `InvalidAmount`, `GroupNotFound`, `EmptyMembers`, `InsufficientBalance` | `("autoshare", "distributed")`, payload `(id, from, amount)` |
| `get_member_shares` | `get_member_shares(group_id, total_amount) -> Vec<i128>` | None | Panics if the group is missing or invalid | None |
| `get_calculated_share` | `get_calculated_share(total, percentage) -> i128` | None | Panics on arithmetic overflow | None |
| `get_total_percentage` | `get_total_percentage(group_id) -> u32` | None | Panics if the group is missing | None |

`update_members` requires a non-empty list of unique member addresses. Every
member percentage must be greater than zero, and the percentages must total
exactly `10_000` basis points.

Distribution uses integer floor division. Any remaining rounding dust is paid
to the final member so all transfers sum exactly to the requested amount.

## Architecture

- `src/lib.rs` defines the deployable `AutoShareContract`, its public
  entrypoints, authentication checks, storage operations, and token transfers.
- `src/base/` contains shared data types, stable error codes, event publishers,
  validators, and basis-point distribution helpers.
- `src/interfaces/` defines the `AutoShareTrait` interface for compatible
  implementations and clients.

The contract uses persistent Soroban storage with two key variants:

- `DataKey::Group(id)` stores one `AutoShareDetails` record by its 32-byte ID.
- `DataKey::CreatorGroups(creator)` stores the ordered group IDs created by an
  address, enabling `get_groups_by_creator`.

Public Rust items are protected by `#![deny(missing_docs)]`; adding an
undocumented public API causes compilation and documentation generation to
fail.

## Build, Test, and Documentation

Prerequisites:

- Rust with the `wasm32v1-none` target
- Stellar CLI for deployment

Install the Rust target once with:

```bash
rustup target add wasm32v1-none
```

Run the standard checks from this directory:

```bash
make fmt-check
make clippy
make test
make docs
make build
```

The equivalent documentation commands are:

```bash
cargo test --doc
cargo doc --no-deps
```

Generated HTML API documentation is written to
`target/doc/autoshare/index.html`.

## Deploy

Build the optimized WASM and deploy it with Stellar CLI:

```bash
make build

stellar contract deploy \
  --wasm target/wasm32v1-none/release/autoshare.wasm \
  --source <SOURCE_IDENTITY> \
  --network <NETWORK>
```

The deployment command prints the contract ID. Configure the selected source
identity and network in Stellar CLI before deploying.
