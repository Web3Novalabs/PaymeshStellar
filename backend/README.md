# PaymeshStellar Backend

Express.js backend for the PaymeshStellar application.

## Project Structure

```
backend/
├── src/
│   ├── __tests__/        # Smoke tests (health, CORS, headers)
│   ├── middleware/        # Auth middleware
│   ├── routes/            # Express route handlers
│   │   └── __tests__/    # Route integration tests
│   ├── services/          # Business logic / in-memory stores
│   ├── types/             # Shared domain types (Group, GroupMember, …)
│   ├── utils/             # Shared utilities (jwt, stellar, validation)
│   ├── db/                # Database layer (future)
│   ├── errors/            # Custom error classes (future)
│   └── index.ts           # App entry point
├── dist/                  # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
└── .env.example
```

## API Endpoints

### `GET /health`

Returns server liveness information.

```json
{
  "status": "ok",
  "uptime": 42,
  "version": "0.1.0"
}
```

- `status` — always `"ok"` when the server is running
- `uptime` — seconds since the process started
- `version` — value from `package.json`

### `GET /`

Returns a welcome message confirming the API is reachable.

## Security

- `helmet` sets standard HTTP security headers on every response
- `cors` restricts `Access-Control-Allow-Origin` to `CORS_ORIGIN` (required in production)
- Request bodies are limited to `50kb`
- JWT tokens expire after 24 hours and use timing-safe signature verification

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
