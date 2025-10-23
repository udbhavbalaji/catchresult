# catchresult

A type-safe error handling wrapper for [neverthrow](https://github.com/supermacro/neverthrow)'s `Result` type. `catchresult` provides a fluent API to catch, match, and handle errors with ease.

## Installation

```bash
npm install catchresult neverthrow
# or
bun add catchresult neverthrow
```

## Quick Start

```ts
import { SafeExec } from "catchresult";

const safeExec = new SafeExec();

safeExec
  .catch("ENOENT", () => "File not found")
  .catch("EACCES", () => "Permission denied")
  .catchAll(() => "Unknown error");

const safeRead = safeExec.getSafeFn(fs.readFileSync);
const content = safeRead("path/to/file.txt", "utf-8");
```

## Features

- **Multiple error matching strategies**: Match by error class, string substring, object shape, or custom predicate
- **Fluent API**: Chain error handlers with `.catch()`, `.catchMany()`, and `.catchAll()`
- **Context preservation**: Pass additional context through `addContext()` for richer error information
- **Sync and async support**: Handle both synchronous functions with `getSafeFn()` and async functions with `getSafeFnAsync()`
- **neverthrow integration**: Unwrap `Result` and `ResultAsync` types with `.unwrap()` and `.unwrapAsync()`

## Usage

### Basic Error Handling

```ts
const exec = new SafeExec();

exec.catch(
  (err) => err instanceof Error && err.message.includes("Division by zero"),
  () => 0
);

const divide = exec.getSafeFn((a: number, b: number) => {
  if (b === 0) throw new Error("Division by zero");
  return a / b;
});

divide(10, 2); // 5
divide(10, 0); // 0 (handled)
```

### Error Matching Strategies

```ts
const exec = new SafeExec();

// Match by error class
class DatabaseError extends Error {}
exec.catch(DatabaseError, () => []);

// Match by string in error message
exec.catch("timeout", () => "timeout_fallback");

// Match by object shape
exec.catch({ status: 404 }, () => ({ notFound: true }));

// Match by predicate function
exec.catch(
  (err) => err instanceof Error && err.code === "ENOENT",
  (err, context) => `Error ${err} occurred in ${context?.location}`
);
```

### Multiple Handlers

```ts
const exec = new SafeExec([
  [ValidationError, () => ({ valid: false })],
  [DatabaseError, () => ({ data: [] })],
]);

exec.catch("timeout", () => ({ timeout: true }));
exec.catchAll(() => ({ error: "unknown" }));
```

### Context Propagation

```ts
const exec = new SafeExec();

// Get access to the context object within your error handlers

exec.catch("operation_failed", (error, context) => {
  console.log("User:", context?.additionalContext?.userId);
  console.log("Action:", context?.additionalContext?.action);
  return { success: false };
});

// Add context for the overall function
const operation = exec.getSafeFn(
  () => {
    throw new Error("operation_failed");
  },
  { operation: "delete_account" }
);

// Add context on-the-go for each function call
contextualOp.addContext({ userId: "user123" })();
```

In the above example, both `operation` and `userId` are available in the error handler through the context object. Apart from these, the context object also contains the args property, which contains the arguments passed to the function.

### Async Functions

```ts
const exec = new SafeExec();

exec.catch("timeout", () => "timeout_fallback");

const fetchUser = exec.getSafeFnAsync(async (userId: string) => {
  if (userId === "timeout") throw new Error("timeout error");
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
});

const user = await fetchUser("123");
const fallback = await fetchUser("timeout"); // 'timeout_fallback'
```

### Working with neverthrow

```ts
import { ok, err } from "neverthrow";

const exec = new SafeExec();

exec.catch("DB_ERROR", () => []);

const result = err(new Error("DB_ERROR"));
const value = exec.unwrap(result); // []
```

## API

### `new SafeExec(handlers?)`

Create a new error handling executor.

**Parameters:**

- `handlers?`: `Array<[ErrorMatcher, ErrorHandler]>` - Initial error handlers

### `.catch(matcher, handler)`

Register an error handler for a specific error type.

**Parameters:**

- `matcher`: Error class, string, object shape, or predicate function
- `handler`: Function receiving `(error, context)` and returning a fallback value

**Returns:** `this` (for chaining)

### `.catchMany(handlers)`

Register multiple error handlers at once.

**Parameters:**

- `handlers`: `Array<[ErrorMatcher, ErrorHandler]>`

**Returns:** `this` (for chaining)

### `.catchAll(handler)`

Register a catch-all handler for unmatched errors.

**Parameters:**

- `handler`: Function receiving `(error, context)`

**Returns:** `this` (for chaining)

### `.getSafeFn(fn, errArgs?)`

Get a safe version of a synchronous function.

**Parameters:**

- `fn`: Synchronous function to wrap
- `errArgs?`: Initial context object

**Returns:** Safe function with `.addContext()` method

### `.getSafeFnAsync(fn, errArgs?)`

Get a safe version of an asynchronous function.

**Parameters:**

- `fn`: Async function to wrap
- `errArgs?`: Initial context object

**Returns:** Promise-returning safe function with `.addContext()` method

### `.unwrap(result)`

Unwrap a neverthrow `Result` type.

**Parameters:**

- `result`: `Result<T, E>`

**Returns:** Value of type `T` or handler return value

### `.unwrapAsync(result)`

Unwrap a neverthrow `ResultAsync` type.

**Parameters:**

- `result`: `ResultAsync<T, E>`

**Returns:** `Promise` resolving to value of type `T` or handler return value

## Recommendations

- Best implementation for error handling is to use error handlers that don't return (basically return never). This way, the function is truly safe as any errors are caught and handled (with process exiting).
- Can also be used if you want to return a default value in case of error.
- Using the addContext() method can be useful for advanced error handling scenarios

## Types

```ts
type ErrorMatcher = ErrorClass | ErrorObject | string | ErrorPredicate;

type ErrorHandler<T = any> = (
  error: unknown,
  context?: Record<string, any>
) => T;

type SafeHandler<TArgs extends any[], TReturn> = {
  (...args: TArgs): TReturn;
  addContext: (context: Record<string, any>) => (...args: TArgs) => TReturn;
};

type SafeHandlerAsync<TArgs extends any[], TReturn> = {
  (...args: TArgs): Promise<TReturn>;
  addContext: (
    context: Record<string, any>
  ) => (...args: TArgs) => Promise<TReturn>;
};
```

## License

MIT
