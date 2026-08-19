# AutoShare Contract

AutoShare is a Soroban contract for creating payment-sharing groups and
distributing Stellar-compatible tokens among configured members. Member shares
are expressed in basis points: `10_000` basis points equals 100%, `5_000`
equals 50%, and `100` equals 1%.

## Contract API

| Function | Signature | Authentication | Errors | Event |
|---|---|---|---|---|
| `init` | `init(admin) -> Result<(), AutoShareError>` | None (one-time setup) | `AlreadyInitialized` | None |
| `create` | `create(id, name, creator, usage_count, payment_token) -> Result<(), AutoShareError>` | `creator` | `MigrationRequired`, `GroupAlreadyExists` | `("autoshare", "created")`, payload `(id, creator)` |
| `update_members` | `update_members(id, caller, new_members) -> Result<(), AutoShareError>` | `caller`, who must be the group creator | `MigrationRequired`, `GroupNotFound`, `Unauthorized`, `EmptyMembers`, `DuplicateMember`, `InvalidPercentage` | `("autoshare", "members_updated")`, payload `(id, member_count)` |
| `get` | `get(id) -> Result<AutoShareDetails, AutoShareError>` | None | `GroupNotFound` | None |
| `get_groups_by_creator` | `get_groups_by_creator(creator) -> Vec<AutoShareDetails>` | None | None | None |
| `distribute` | `distribute(id, from, amount) -> Result<(), AutoShareError>` | `from` | `MigrationRequired`, `InvalidAmount`, `GroupNotFound`, `EmptyMembers`, `InsufficientBalance` | `("autoshare", "distributed")`, payload `(id, from, amount)` |
| `get_member_shares` | `get_member_shares(group_id, total_amount) -> Vec<i128>` | None | Panics if the group is missing or invalid | None |
| `get_calculated_share` | `get_calculated_share(total, percentage) -> i128` | None | Panics on arithmetic overflow | None |
| `get_total_percentage` | `get_total_percentage(group_id) -> u32` | None | Panics if the group is missing | None |
| `upgrade` | `upgrade(caller, new_wasm_hash) -> Result<(), AutoShareError>` | `caller` (contract admin) | `Unauthorized`, `ContractNotPaused` | `("autoshare", "upgraded")`, payload `new_wasm_hash` |
| `migrate` | `migrate(caller, limit) -> Result<MigrationProgress, AutoShareError>` | `caller` (contract admin) | `Unauthorized`, `NothingToMigrate` | `("autoshare", "migrated")`, payload `(migrated, remaining)` |
| `schema_version` | `schema_version() -> u32` | None | None | None |
| `pause` | `pause(caller) -> Result<(), AutoShareError>` | `caller` (contract admin) | `Unauthorized` | `("autoshare", "paused")`, payload `()` |
| `unpause` | `unpause(caller) -> Result<(), AutoShareError>` | `caller` (contract admin) | `Unauthorized` | `("autoshare", "unpaused")`, payload `()` |

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

### Storage Keys

The contract partitions storage between **persistent** (group data and indexes) and **instance** (contract-level configuration and operational flags):

#### Persistent Storage
- `DataKey::Group(id)` stores one `AutoShareDetails` record by its 32-byte ID.
- `DataKey::CreatorGroups(creator)` stores the ordered group IDs created by an address, enabling `get_groups_by_creator`.
- `DataKey::AllGroups` maintains the global ordered list of all created group IDs (`Vec<BytesN<32>>`).

#### Instance Storage
- `DataKey::Admin` stores the contract administrator address.
- `DataKey::SchemaVersion` stores the active `u32` schema version (read on nearly every call).
- `DataKey::MigrationCursor` tracks the batch progress index into `AllGroups` during active migrations. Removed upon completion.
- `DataKey::Paused` stores the `bool` maintenance flag.

Public Rust items are protected by `#![deny(missing_docs)]`; adding an
undocumented public API causes compilation and documentation generation to
fail.

## Upgrades and Migrations

The contract implements contract upgradeability via Soroban's `update_current_contract_wasm` combined with instance-level schema versioning and resumable batched storage migration.

### Migration Guardrails

- **Mutating operations blocked during pending migrations**: While `schema_version() != CURRENT_SCHEMA_VERSION`, all mutating entrypoints (`create`, `update_members`, `distribute`) return `AutoShareError::MigrationRequired`.
- **Read-only operations remain available**: Queries (`get`, `get_groups_by_creator`, `get_member_shares`, `get_total_percentage`) gracefully decode both legacy (v1) and current (v2) group formats.
- **Admin-gated operations**: Only the contract administrator can call `pause`, `unpause`, `upgrade`, and `migrate`. Non-admin callers receive `AutoShareError::Unauthorized`.
- **Upgrade safety gating**: `upgrade` strictly requires the contract to be paused (`Paused == true`). Calling `upgrade` while unpaused returns `AutoShareError::ContractNotPaused`.

### Operator Runbook

Follow these exact steps when upgrading a deployed contract:

```bash
# 1. Install the new contract WASM on-chain to obtain its 32-byte hash
NEW_WASM_HASH=$(stellar contract install --wasm target/wasm32v1-none/release/autoshare.wasm --source <ADMIN> --network <NETWORK>)

# 2. Pause the contract to prevent state mutations during the upgrade window
stellar contract invoke --id <CONTRACT_ID> --source <ADMIN> --network <NETWORK> -- pause --caller <ADMIN>

# 3. Upgrade contract WASM executable
stellar contract invoke --id <CONTRACT_ID> --source <ADMIN> --network <NETWORK> -- upgrade --caller <ADMIN> --new_wasm_hash $NEW_WASM_HASH

# 4. Run batched migration until all groups are upgraded (done == true)
# Choose a limit (e.g. 50-100) appropriate for the network's transaction CPU/memory budget
stellar contract invoke --id <CONTRACT_ID> --source <ADMIN> --network <NETWORK> -- migrate --caller <ADMIN> --limit 50

# Repeat step 4 if remaining > 0 until done is true

# 5. Verify the schema version
stellar contract invoke --id <CONTRACT_ID> --source <ADMIN> --network <NETWORK> -- schema_version
# Output: 2

# 6. Unpause the contract to resume normal user operations
stellar contract invoke --id <CONTRACT_ID> --source <ADMIN> --network <NETWORK> -- unpause --caller <ADMIN>
```

### Rollback Story: What is and is not Recoverable

- **Recoverable**:
  - If a migration is interrupted between batches, the contract remains in a consistent state. Group data is never corrupted or duplicated; unmigrated records remain readable via backward-compatible deserialization fallbacks. Calling `migrate` resumes exactly from the persisted cursor.
  - If an upgrade fails before migration starts, the admin can re-install and point `upgrade` back to the previous WASM hash without data loss.
- **Not Recoverable**:
  - Once a migration batch writes records in the new schema format, rolling back the WASM to an older version that does not know about the new fields will cause decoding failures for migrated groups.
  - Upgrading without pausing risks concurrent user transactions reading intermediate migration state or failing with `MigrationRequired`. Always pause before executing `upgrade`.

### Global Group Index (`AllGroups`) Ceiling and Scaling

The contract maintains `DataKey::AllGroups` (`Vec<BytesN<32>>`) to enable exhaustive iteration across all groups during migrations.
- **Entry Size Ceiling**: Soroban limits a single persistent storage entry to 64 KB. With each group ID requiring 32 bytes (plus XDR vector overhead), `AllGroups` can store up to ~1,800–2,000 groups before reaching the entry limit.
- **Write Cost**: Appending to `AllGroups` on each `create` call incurs a read-modify-write on the vector.
- **Scaling Recommendation**: For deployments expecting more than 1,500 groups, transition the global index into paginated buckets (e.g., `DataKey::AllGroupsPage(u32)` containing fixed 500-group segments) or an on-chain linked-list / tree structure.

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

