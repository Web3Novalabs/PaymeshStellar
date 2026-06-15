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
├── frontend/            # Next.js web app (TypeScript, App Router)
│   ├── src/
│   ├── package.json
│   ├── .prettierrc       # Code formatting config
│   └── eslint.config.mjs # Linting config
├── backend/             # Express.js backend API
│   ├── src/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .eslintrc.json
│   ├── .prettierrc
│   └── .env.example
├── contract/            # Soroban smart contract (Rust)
│   ├── src/
│   │   ├── lib.rs              # Contract entry point
│   │   ├── test.rs             # Unit tests
│   │   ├── base/
│   │   │   ├── types.rs        # Data models (GroupMember, AutoShareDetails)
│   │   │   ├── errors.rs       # Custom error codes
│   │   │   └── events.rs       # On-chain event emissions
│   │   └── interfaces/
│   │       └── autoshare.rs    # Contract trait definition
│   ├── Cargo.toml
│   ├── Makefile
│   └── README.md
├── .github/workflows/   # CI/CD pipelines
│   ├── frontend.yml     # Frontend CI (Next.js)
│   ├── backend.yml      # Backend CI (Express.js)
│   └── contract.yml     # Smart Contract CI (Soroban)
├── .husky/              # Git hooks (pre-commit)
├── .lintstagedrc        # Lint-staged config
├── pnpm-workspace.yaml  # Monorepo workspace config
├── package.json         # Root package.json
└── README.md            # This file
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

- [Node.js](https://nodejs.org/) 18.x or higher
- [pnpm](https://pnpm.io/) 8.x or higher
- [Rust](https://rustup.rs/)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)

### Installation

```bash
# Install dependencies for all packages (frontend, backend)
pnpm install

# Set up backend environment
cp backend/.env.example backend/.env
```

### Development

#### Frontend

```bash
pnpm frontend:dev
```

The frontend will be available at `http://localhost:3000`.

#### Backend

```bash
pnpm backend:dev
```

The backend will be available at `http://localhost:3001`.

#### Smart Contract

```bash
cd contract
cargo build          # check compilation
cargo test           # run tests
stellar contract build   # build .wasm for deployment
```

### Building for Production

#### Frontend

```bash
pnpm frontend:build
pnpm --filter frontend start
```

#### Backend

```bash
pnpm backend:build
pnpm --filter backend start
```

#### Contract

```bash
cd contract
stellar contract build
```

## Code Quality

### Linting

Check code for errors and style issues:

```bash
# Lint all packages
pnpm lint:all

# Lint specific package
pnpm frontend:lint
pnpm backend:lint
```

### Formatting

Format code consistently:

```bash
# Format all packages
pnpm format:all

# Check if formatting is needed
pnpm format:check

# Format specific package
pnpm frontend:format
pnpm backend:format
```

### Pre-commit Hooks

Husky is configured to automatically run formatting and linting before commits. The hooks use lint-staged to only check changed files.

**Configured checks:**
- ESLint (frontend & backend)
- Prettier formatting (frontend & backend)

Pre-commit hooks will prevent commits with linting or formatting errors.

## CI/CD Pipelines

Three independent GitHub Actions workflows are configured:

### Frontend CI (`.github/workflows/frontend.yml`)

Runs when frontend files change.

**Checks:**
- Install dependencies
- TypeScript type checking
- ESLint linting
- Prettier formatting verification
- Production build
- Tests (if configured)

**Triggers:** Push to `main`/`develop`, PRs to `main`/`develop`

### Backend CI (`.github/workflows/backend.yml`)

Runs when backend files change.

**Checks:**
- Install dependencies
- TypeScript type checking
- ESLint linting
- Prettier formatting verification
- Production build
- Tests (if configured)

**Triggers:** Push to `main`/`develop`, PRs to `main`/`develop`

### Contract CI (`.github/workflows/contract.yml`)

Runs when contract files change.

**Checks:**
- Rust formatting check
- Clippy linting
- Production build
- Test suite

**Triggers:** Push to `main`/`develop`, PRs to `main`/`develop`

#### Testing on Multiple Node Versions

Frontend and Backend CI pipelines test on:
- Node 18.x
- Node 20.x

This ensures compatibility across different Node.js versions.

## Tech Stack

- **Frontend**: Next.js, TypeScript, React, Tailwind CSS
- **Backend**: Express.js, TypeScript, Node.js
- **Smart Contract**: Rust, Soroban SDK
- **Blockchain**: Stellar Network
- **Package Manager**: pnpm
- **Code Quality**: ESLint, Prettier
- **Git Hooks**: Husky, lint-staged
- **CI/CD**: GitHub Actions

## Monorepo Management

This is a pnpm workspace monorepo. Commands can be run from the root:

```bash
# Run command in specific package
pnpm --filter frontend <command>
pnpm --filter backend <command>

# Run command in all packages
pnpm -r <command>

# Install dependencies for all packages
pnpm install
```

## Development Workflow

1. **Create a new branch** for your feature
2. **Make changes** to frontend, backend, or contract
3. **Code will be automatically formatted** by pre-commit hooks
4. **Commit and push** your changes
5. **CI pipeline runs** automatically on GitHub
6. **Create a Pull Request** for review
7. **All checks must pass** before merging

## License

See LICENSE file for details.
