# Vitest to Mocha/Chai/Sinon Migration Guide

This guide helps you migrate test files from Vitest to Mocha, Chai, and Sinon.

## Import Changes

### Before (Vitest)
```typescript
import { describe, expect, it, vi } from "vitest";
```

### After (Mocha/Chai/Sinon)
```typescript
import { expect } from "chai";
import { describe, it } from "mocha";
import sinon from "sinon";
```

## Assertion Changes

### Instance checks
- **Before**: `expect(obj).toBeInstanceOf(Class)`
- **After**: `expect(obj).to.be.instanceOf(Class)`

### Equality checks
- **Before**: `expect(value).toBe(expected)`
- **After**: `expect(value).to.equal(expected)`

### Deep equality (objects/arrays)
- **Before**: `expect(obj).toEqual(expected)`
- **After**: `expect(obj).to.deep.equal(expected)`

### Boolean checks
- **Before**: `expect(value).toBeTruthy()` / `expect(value).toBeFalsy()`
- **After**: `expect(value).to.be.true` / `expect(value).to.be.false`

### Null/Undefined checks
- **Before**: `expect(value).toBeNull()` / `expect(value).toBeUndefined()`
- **After**: `expect(value).to.be.null` / `expect(value).to.be.undefined`

### Contains/Includes
- **Before**: `expect(array).toContain(item)`
- **After**: `expect(array).to.include(item)`

### Length checks
- **Before**: `expect(array).toHaveLength(n)`
- **After**: `expect(array).to.have.lengthOf(n)`

### Property checks
- **Before**: `expect(obj).toHaveProperty('key', value)`
- **After**: `expect(obj).to.have.property('key', value)`

## Mock/Spy Changes

### Creating spies/mocks
- **Before**: `const spy = vi.fn()`
- **After**: `const spy = sinon.spy()`

### Creating stubs (with return value)
- **Before**: `const mock = vi.fn().mockReturnValue(value)`
- **After**: `const stub = sinon.stub().returns(value)`

### Spy assertions
- **Before**: `expect(spy).toHaveBeenCalled()`
- **After**: `expect(spy.called).to.be.true` or `sinon.assert.called(spy)`

- **Before**: `expect(spy).not.toHaveBeenCalled()`
- **After**: `expect(spy.called).to.be.false` or `sinon.assert.notCalled(spy)`

- **Before**: `expect(spy).toHaveBeenCalledTimes(n)`
- **After**: `expect(spy.callCount).to.equal(n)` or `sinon.assert.callCount(spy, n)`

- **Before**: `expect(spy).toHaveBeenCalledWith(arg1, arg2)`
- **After**: `sinon.assert.calledWith(spy, arg1, arg2)`

### Restoring mocks
Always restore Sinon spies/stubs after each test:
```typescript
afterEach(() => {
  sinon.restore();
});
```

## Lifecycle Hooks

Both frameworks use the same names:
- `beforeEach()` - runs before each test
- `afterEach()` - runs after each test
- `before()` - runs once before all tests
- `after()` - runs once after all tests

## Async Tests

Both frameworks handle async tests the same way:
```typescript
it("should handle async operations", async () => {
  const result = await someAsyncFunction();
  expect(result).to.equal(expected);
});
```

## Running Tests

- **Before**: `npm test` or `vitest run`
- **After**: `npm test` or `mocha`

## Configuration

- **Vitest**: `vitest.config.ts` or in `vite.config.ts`
- **Mocha**: `.mocharc.json` or `.mocharc.js`

## Example Migration

### Before (Vitest)
```typescript
import { describe, expect, it, vi } from "vitest";

describe("MyComponent", () => {
  it("should call callback", () => {
    const callback = vi.fn();
    myFunction(callback);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("arg");
  });

  it("should return correct value", () => {
    const result = myFunction();
    expect(result).toBe(42);
  });
});
```

### After (Mocha/Chai/Sinon)
```typescript
import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import sinon from "sinon";

describe("MyComponent", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("should call callback", () => {
    const callback = sinon.spy();
    myFunction(callback);
    expect(callback.callCount).to.equal(1);
    sinon.assert.calledWith(callback, "arg");
  });

  it("should return correct value", () => {
    const result = myFunction();
    expect(result).to.equal(42);
  });
});
```

## Additional Resources

- [Mocha Documentation](https://mochajs.org/)
- [Chai Assertion Library](https://www.chaijs.com/)
- [Sinon Spies, Stubs & Mocks](https://sinonjs.org/)

## Notes for Remaining Tests

The following test files still need to be migrated:
- `tests/performance/server-performance.test.ts`
- `tests/security/input-validation.test.ts`
- `tests/integration/server-lifecycle.test.ts`
- `tests/integration/FastMCP.session-context.test.ts`
- `tests/integration/FastMCP.oauth.test.ts`
- `tests/unit/utils.test.ts`
- `tests/e2e/FastMCP.test.ts`
- `tests/performance/para-agent.perf.test.ts`
- `tests/e2e/para-agent.test.ts`

Use this guide to update each file systematically.
