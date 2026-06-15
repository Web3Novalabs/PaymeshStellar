# Contributing to PaymeshStellar

Thank you for your interest in contributing! This document provides guidelines for developing and submitting changes.

## Development Environment Setup

### Prerequisites

- Node.js 18.x or higher
- pnpm 8.x or higher
- Rust 1.70+
- Stellar CLI

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/Web3Novalabs/PaymeshStellar.git
cd PaymeshStellar

# Install dependencies
pnpm install

# Set up backend environment
cp backend/.env.example backend/.env
```

## Project Structure

The project is organized as a monorepo using pnpm workspaces:

- **frontend/** - Next.js web application
- **backend/** - Express.js API server
- **contract/** - Stellar Soroban smart contract

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

Work on your feature in the appropriate folder:

- Frontend changes: `frontend/`
- Backend changes: `backend/`
- Contract changes: `contract/`

### 3. Run Code Quality Checks

Before committing, run the appropriate checks:

```bash
# Format all code
pnpm format:all

# Lint all code
pnpm lint:all

# Type check
pnpm frontend:type-check
pnpm backend:type-check
```

### 4. Commit Your Changes

```bash
git add .
git commit -m "feat: description of your changes"
```

The pre-commit hook will automatically run formatting and linting checks. If there are issues, fix them and commit again.

### 5. Push and Create a Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub. CI/CD pipelines will automatically run on your PR.

## Commit Message Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): subject

body

footer
```

**Types:**
- `feat` - A new feature
- `fix` - A bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, missing semicolons, etc.)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `ci` - CI/CD configuration changes

**Scopes:**
- `frontend` - Frontend changes
- `backend` - Backend changes
- `contract` - Smart contract changes
- `infra` - Infrastructure/CI changes

**Examples:**
```
feat(frontend): add user profile page
fix(backend): resolve authentication token expiry bug
docs(contract): update AutoShare function documentation
```

## Code Standards

### TypeScript/JavaScript

- ESLint is configured and enforced via pre-commit hooks
- Prettier is used for code formatting
- Aim for meaningful variable and function names
- Add JSDoc comments for exported functions

### Rust (Smart Contract)

- Use `cargo fmt` for formatting
- Use `cargo clippy` for linting
- Write comprehensive tests in `src/test.rs`
- Document public types and functions

## Testing

### Frontend

```bash
pnpm --filter frontend test
```

### Backend

```bash
pnpm --filter backend test
```

### Contract

```bash
cd contract
cargo test
```

## CI/CD Pipelines

GitHub Actions automatically runs on:
- Push to `main` or `develop` branches
- All pull requests

**Pipelines:**
- **Frontend CI** - Runs on frontend file changes
- **Backend CI** - Runs on backend file changes
- **Contract CI** - Runs on contract file changes

All checks must pass before merging to `main`.

## Pull Request Guidelines

1. **Title** - Use Conventional Commits format
2. **Description** - Explain the changes and why they were made
3. **Link Issues** - Reference related issues (e.g., "Closes #123")
4. **Tests** - Ensure all tests pass
5. **Documentation** - Update README or docs if needed

## Code Review Process

1. Author submits PR
2. Automated checks run (CI pipelines)
3. Team members review code
4. Author addresses feedback
5. Maintainer merges PR

## Package Management

This project uses pnpm and workspaces:

```bash
# Add dependency to specific package
pnpm --filter frontend add lodash
pnpm --filter backend add express

# Add dev dependency
pnpm --filter frontend add -D @types/node

# Update all dependencies
pnpm update
```

## Running the Full Stack

### Development

```bash
# Terminal 1 - Frontend
pnpm frontend:dev

# Terminal 2 - Backend
pnpm backend:dev

# Terminal 3 - Smart Contract (if needed)
cd contract
stellar contract build
```

### Production Build

```bash
pnpm frontend:build
pnpm backend:build
cd contract && stellar contract build
```

## Troubleshooting

### Dependencies not installing

```bash
# Clear pnpm cache
pnpm store prune

# Reinstall
pnpm install
```

### Build failing

```bash
# Clean build
rm -rf node_modules .next dist contract/target
pnpm install
pnpm frontend:build
pnpm backend:build
```

### Pre-commit hook not running

```bash
# Reinstall Husky
pnpm install

# Make pre-commit executable
chmod +x .husky/pre-commit
```

## Questions or Issues?

- Check existing issues on GitHub
- Create a new issue with detailed information
- Reach out to the maintainers

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
