# PaymeshStellar

A decentralized payroll system built on the Stellar blockchain using Soroban smart contracts.

## What is AutoShare?

AutoShare lets you create payroll groups where funds are automatically split among members based on predefined percentages. A creator sets up a group, adds members with their share allocations, and payments are distributed on-chain — transparent, trustless, and auditable.

### How it works

1. **Create a group** — Define a payroll plan with a name, payment token, and usage count.
2. **Add members** — Assign team members with percentage-based splits (must total 100%).
3. **Distribute** — Payments sent to the group are automatically split among members.

## Project Structure

```
PaymeshStellar/
├── frontend/       # Next.js web app (TypeScript, App Router)
├── contract/       # Soroban smart contract (Rust)
│   └── src/
│       ├── lib.rs              # Contract entry point
│       ├── test.rs             # Unit tests
│       ├── base/
│       │   ├── types.rs        # Data models (GroupMember, AutoShareDetails)
│       │   ├── errors.rs       # Custom error codes
│       │   └── events.rs       # On-chain event emissions
│       └── interfaces/
│           └── autoshare.rs    # Contract trait definition
└── backend/        # Reserved for future API/auth services
```

## Smart Contract Functions

| Function | Description |
|---|---|
| `create` | Create a new payroll group |
| `update_members` | Set or update members and their percentage splits |
| `get` | Retrieve a group by ID |
| `get_groups_by_creator` | List all groups owned by an address |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

### Smart Contract

```bash
cd contract
cargo build          # check compilation
cargo test           # run tests
stellar contract build   # build .wasm for deployment
```

## Tech Stack

- **Frontend**: Next.js, TypeScript
- **Smart Contract**: Rust, Soroban SDK
- **Blockchain**: Stellar Network
