# FastMCP Test Suite

A comprehensive, multi-layered test suite for the FastMCP TypeScript framework, designed for thorough validation of MCP server operations, multi-tenant isolation, and performance characteristics.

## Test Architecture

### Directory Structure

```
tests/
├── README.md                    # This documentation
├── setup.ts                     # Vitest global setup and mocks
├── fixtures.ts                  # Shared test fixtures and data generators
├── vitest.config.js             # Vitest configuration with ES module support
├── unit/                        # Unit tests (fast, isolated)
│   ├── core.test.ts             # Core FastMCP business logic
│   ├── tools.test.ts            # MCP tools functionality
│   ├── resources.test.ts        # MCP resources functionality
│   ├── prompts.test.ts          # MCP prompts functionality
│   └── utils.test.ts            # Utility functions
├── integration/                 # Integration tests (medium speed)
│   ├── server-lifecycle.test.ts # FastMCP server initialization & lifecycle
│   ├── tool-execution.test.ts   # MCP tool execution & parameter validation
│   ├── resource-access.test.ts  # MCP resource access & template handling
│   ├── prompt-completion.test.ts # MCP prompt completion & argument handling
│   ├── authentication.test.ts   # Authentication and authorization
│   └── session-management.test.ts # Session management & client connections
├── e2e/                         # End-to-end workflow tests
│   ├── server-workflows.test.ts # Complete FastMCP server workflows
│   ├── multi-client.test.ts     # Multi-client scenarios
│   ├── transport-protocols.test.ts # HTTP Stream vs Stdio transport
│   └── oauth-integration.test.ts # OAuth 2.0 integration workflows
├── performance/                 # Performance and load tests
│   ├── server-performance.test.ts   # Server initialization benchmarks
│   ├── tool-performance.test.ts     # Tool execution benchmarks
│   ├── concurrent-clients.test.ts   # Concurrent client handling
│   └── memory-usage.test.ts         # Memory usage and leaks
├── security/                    # Security validation tests
│   ├── input-validation.test.ts # Input validation and sanitization
│   ├── auth-isolation.test.ts   # Authentication isolation verification
│   ├── access-control.test.ts   # Tool/resource access control
│   └── data-isolation.test.ts   # Multi-tenant data isolation
└── test-suite-architecture.md   # Detailed architecture documentation
```

## Test Categories

### 1. Unit Tests (`unit/`)

- **Scope**: Individual functions, classes, and modules in isolation
- **Mocking**: All external dependencies (network, file system, timers)
- **Coverage**: Business logic, data transformations, validation
- **Execution**: Fast (< 2 seconds), parallel execution

### 2. Integration Tests (`integration/`)

- **Scope**: Component interactions with real dependencies
- **Environment**: Test servers, mock clients
- **Coverage**: API contracts, data flow, error propagation
- **Execution**: Sequential, moderate speed (< 10 seconds)

### 3. End-to-End Tests (`e2e/`)

- **Scope**: Complete user workflows through MCP protocol
- **Environment**: Full server instances with MCP client simulation
- **Coverage**: User journeys, system integration, multi-tenant isolation
- **Execution**: Slower, comprehensive validation (< 30 seconds)

### 4. Performance Tests (`performance/`)

- **Scope**: System behavior under load and stress
- **Metrics**: Latency, throughput, memory, CPU utilization
- **Coverage**: Benchmarks, load testing, scalability
- **Execution**: Specialized test runners (< 15 seconds)

### 5. Security Tests (`security/`)

- **Scope**: Security boundaries and vulnerability assessment
- **Coverage**: Input validation, data isolation, secure defaults
- **Tools**: Static analysis, boundary testing
- **Execution**: Focused security validation (< 5 seconds)

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test categories
pnpm test unit/
pnpm test integration/
pnpm test e2e/
pnpm test performance/
pnpm test security/

# Run with coverage
pnpm test --coverage

# Run specific test file
pnpm test src/FastMCP.test.ts
```

## Test Configuration

- **Framework**: Vitest with native ESM support
- **Environment**: Node.js test environment
- **Mocking**: Vitest built-in mocking
- **Assertions**: Vitest expect API
- **Coverage**: Istanbul coverage reporter

## Test Data and Fixtures

Shared test fixtures are available in `fixtures.ts`:

- Server creation helpers
- Tool/resource/prompt templates
- Authentication mocks
- Random data generators

## Contributing

When adding new tests:

1. Place unit tests in `unit/` directory
2. Integration tests in `integration/`
3. E2E tests in `e2e/`
4. Performance tests in `performance/`
5. Security tests in `security/`
6. Use shared fixtures from `fixtures.ts`
7. Follow existing naming conventions
8. Ensure tests are isolated and deterministic
