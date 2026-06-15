# PaymeshStellar Backend

Express.js backend for the PaymeshStellar application.

## Project Structure

```
backend/
├── src/
│   └── index.ts          # Main application entry point
├── dist/                 # Compiled JavaScript (generated)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── .eslintrc.json        # ESLint configuration
├── .prettierrc            # Prettier configuration
└── .env.example          # Example environment variables
```

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- pnpm 8.x or higher

### Installation

```bash
# Install dependencies from root
pnpm install

# Set up environment variables
cp backend/.env.example backend/.env
```

### Development

```bash
# Start development server with hot reload
pnpm backend:dev
```

The server will start at `http://localhost:3001`.

### Build

```bash
# Compile TypeScript to JavaScript
pnpm backend:build

# Start production server
pnpm --filter backend start
```

## Code Quality

### Linting

```bash
# Check for linting errors
pnpm backend:lint

# Fix linting errors automatically
pnpm --filter backend lint:fix
```

### Formatting

```bash
# Format code
pnpm backend:format

# Check if code is formatted
pnpm --filter backend format:check
```

### Type Checking

```bash
# Check TypeScript types
pnpm --filter backend type-check
```

## Planned Services

- **API Server** - RESTful or GraphQL API to serve the frontend and interact with the blockchain
- **Database Integration** - Data persistence layer for off-chain data (user profiles, transaction history, caching)
- **Authentication** - User authentication and authorization (wallet-based auth, session management, JWT tokens)
- **Webhook Handlers** - Listeners for blockchain events and external service callbacks

## CI/CD

This backend is automatically tested and built through GitHub Actions. See `.github/workflows/backend.yml` for the workflow configuration.

The workflow runs on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Only when backend-related files change

Check includes:
- Dependencies installation
- TypeScript type checking
- ESLint linting
- Prettier formatting check
- Production build

## Technologies

- **Framework**: Express.js
- **Language**: TypeScript
- **Linter**: ESLint
- **Formatter**: Prettier
- **Runtime**: Node.js
