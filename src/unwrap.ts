// External imports
import { Result, ResultAsync } from "neverthrow";

// Internal imports
import type {
  ErrorClass,
  ErrorHandler,
  ErrorHandlerConfig,
  ErrorMatcher,
  ErrorPredicate,
  SafeHandler,
  SafeHandlerAsync,
} from "./types";

export class SafeExec {
  private errorHandlers: ErrorHandlerConfig[] = [];
  private catchAllHandler: ErrorHandler | undefined;

  constructor(handlers: Array<[ErrorMatcher, ErrorHandler]> = []) {
    this.catchMany(handlers);
  }

  /**
   * Register an error handler for a specific error type
   */
  catch(matcher: ErrorMatcher, handler: ErrorHandler): this {
    this.errorHandlers.push({ matcher, handler });
    return this;
  }

  /**
   * Register multiple error handlers at once
   */
  catchMany(handlers: Array<[ErrorMatcher, ErrorHandler]>): this {
    handlers.forEach(([matcher, handler]) => {
      this.catch(matcher, handler);
    });
    return this;
  }

  /**
   * Register a catch-all error handler
   */
  catchAll(handler: ErrorHandler): this {
    this.catchAllHandler = handler;
    return this;
  }

  /**
   * Get a safe version of a synchronous function
   */
  getSafeFn<TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => TReturn,
    errArgs?: Record<string, any>,
  ) {
    const wrappedFn = Result.fromThrowable(fn, (e) => e);

    const resFn: SafeHandler<TArgs, TReturn> = (...args: TArgs): TReturn => {
      const result = wrappedFn(...args);

      if (result.isOk()) {
        return result.value;
      }

      const error = result.error;

      // Try to find a matching handler
      for (const { matcher, handler } of this.errorHandlers) {
        if (this.matchesError(error, matcher)) {
          return handler(error, {
            ...errArgs,
            args,
            additionalContext: {
              ...errArgs?.additionalContext,
              _context: (error as any).stack ?? (error as any).details,
            },
          });
        }
      }

      // No handler found - log and exit - using catchall handler if there
      if (this.catchAllHandler) {
        return this.catchAllHandler(error, {
          ...errArgs,
          args,
          additionalContext: {
            ...errArgs?.additionalContext,
            _context: (error as any).stack ?? (error as any).details,
          },
        });
      }
      console.error("Unhandled error:", error);
      process.exit(1);
    };

    resFn.addContext = (addedContext: Record<string, any>) => {
      return (...args: TArgs): TReturn => {
        const result = wrappedFn(...args);

        if (result.isOk()) {
          return result.value;
        }

        const error = result.error;

        // Try to find a matching handler
        for (const { matcher, handler } of this.errorHandlers) {
          if (this.matchesError(error, matcher)) {
            return handler(error, {
              ...errArgs,
              args,
              additionalContext: {
                ...errArgs?.additionalContext,
                ...addedContext,
                _context: (error as any).stack ?? (error as any).details,
              },
            });
          }
        }
        // No handler found - log and exit - using catchall handler if there
        if (this.catchAllHandler) {
          return this.catchAllHandler(error, {
            ...errArgs,
            args,
            additionalContext: {
              ...errArgs?.additionalContext,
              ...addedContext,
              _context: (error as any).stack ?? (error as any).details,
            },
          });
        }
        console.error("Unhandled error:", error);
        process.exit(1);
      };
    };

    return resFn;
  }

  /**
   * Unwrap a result
   */
  unwrap<T, E>(result: Result<T, E>) {
    if (result.isOk()) {
      return result.value;
    }

    const error = result.error;

    for (const { matcher, handler } of this.errorHandlers) {
      if (this.matchesError(error, matcher)) {
        return handler(error, {
          additionalContext: {
            _context: (error as any).stack ?? (error as any).details,
          },
        });
      }
    }

    if (this.catchAllHandler) {
      return this.catchAllHandler(error, {
        additionalContext: {
          _context: (error as any).stack ?? (error as any).details,
        },
      });
    }
    console.error("Unhandled error:", error);
    process.exit(1);
  }

  /**
   * Unwrap an asynchronoous result (result wrapped in a promise)
   */
  async unwrapAsync<T, E>(res: ResultAsync<T, E>) {
    const result = await res;

    return this.unwrap(result);
  }

  /**
   * Get a safe version of an asynchronous function
   */
  getSafeFnAsync<TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    errArgs?: Record<string, any>,
  ) {
    const wrappedFn = ResultAsync.fromThrowable(fn, (e) => e);

    const resFn: SafeHandlerAsync<TArgs, TReturn> = async (
      ...args: TArgs
    ): Promise<TReturn> => {
      const result = await wrappedFn(...args);

      if (result.isOk()) {
        return result.value;
      }

      const error = result.error;

      // Try to find a matching handler
      for (const { matcher, handler } of this.errorHandlers) {
        if (this.matchesError(error, matcher)) {
          return handler(error, {
            ...errArgs,
            args,
            additionalContext: {
              ...errArgs?.additionalContext,
              _context: (error as any).stack ?? (error as any).details,
            },
          });
        }
      }

      // No handler found - log and exit
      if (this.catchAllHandler) {
        return this.catchAllHandler(error, {
          ...errArgs,
          args,
          additionalContext: {
            ...errArgs?.additionalContext,
            _context: (error as any).stack ?? (error as any).details,
          },
        });
      }
      console.error("Unhandled error:", error);
      process.exit(1);
    };

    resFn.addContext = (addedContext: Record<string, any>) => {
      return async (...args: TArgs): Promise<TReturn> => {
        const result = await wrappedFn(...args);

        if (result.isOk()) {
          return result.value;
        }

        const error = result.error;

        // Try to find a matching handler
        for (const { matcher, handler } of this.errorHandlers) {
          if (this.matchesError(error, matcher)) {
            return handler(error, {
              ...errArgs,
              args,
              additionalContext: {
                ...errArgs?.additionalContext,
                ...addedContext,
                _context: (error as any).stack ?? (error as any).details,
              },
            });
          }
        }

        // No handler found - log and exit
        if (this.catchAllHandler) {
          return this.catchAllHandler(error, {
            ...errArgs,
            args,
            additionalContext: {
              ...errArgs?.additionalContext,
              _context: (error as any).stack ?? (error as any).details,
            },
          });
        }
        console.error("Unhandled error:", error);
        process.exit(1);
      };
    };

    return resFn;
  }

  private matchesError(error: unknown, matcher: ErrorMatcher): boolean {
    // Class instance check
    if (typeof matcher === "function" && matcher.prototype instanceof Error) {
      return error instanceof (matcher as ErrorClass);
    }

    // Predicate function
    if (typeof matcher === "function") {
      return (matcher as ErrorPredicate)(error);
    }

    // String matching (error message)
    if (typeof matcher === "string") {
      if (error instanceof Error) {
        return error.message.includes(matcher);
      }
      return String(error).includes(matcher);
    }

    // Object shape matching
    if (typeof matcher === "object" && matcher !== null) {
      if (typeof error !== "object" || error === null) {
        return false;
      }

      // Check if error has all keys from matcher
      return Object.keys(matcher).every((key) => {
        const errorObj = error as Record<string, any>;
        return key in errorObj && errorObj[key] === matcher[key];
      });
    }

    return false;
  }
}

// Usage examples:
/*
import * as fs from 'fs';

// Example 1: Basic usage with fs.readFileSync
const safeExec = new SafeExec();

safeExec
  .catch('ENOENT', (err) => {
    console.log('File not found, returning empty string');
    return '';
  })
  .catch('EACCES', (err) => {
    console.log('Permission denied, returning empty string');
    return '';
  });

const safeReadFile = safeExec.getSafeFn(fs.readFileSync);

// Use it just like the original function
const content1 = safeReadFile('path/to/file.txt', 'utf-8');
const content2 = safeReadFile('another/file.txt', 'utf-8');

// Example 2: Multiple safe functions sharing the same handlers
const safeJSONParse = safeExec.getSafeFn(JSON.parse);
const safeWriteFile = safeExec.getSafeFn(fs.writeFileSync);

const data = safeJSONParse('{"name": "test"}');
safeWriteFile('output.txt', 'Hello World');

// Example 3: Specific error handlers for different use cases
const fileExec = new SafeExec();
fileExec
  .catch('ENOENT', () => null)
  .catch('EACCES', () => null);

const networkExec = new SafeExec();
networkExec
  .catch(NetworkError, () => ({ error: 'Network failed' }))
  .catch('timeout', () => ({ error: 'Request timeout' }));

const safeRead = fileExec.getSafeFn(fs.readFileSync);
const safeFetch = networkExec.getSafeFnAsync(fetch);

// Example 4: Class-based error handling
class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

function queryDatabase(sql: string): any[] {
  throw new DatabaseError('Connection timeout');
}

const dbExec = new SafeExec();
dbExec.catch(DatabaseError, (err) => {
  console.log('Database error occurred:', err);
  return [];
});

const safeQuery = dbExec.getSafeFn(queryDatabase);
const results = safeQuery('SELECT * FROM users'); // Returns []

// Example 5: Async function handling
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new NetworkError('Failed to fetch user');
  return response.json();
}

const apiExec = new SafeExec();
apiExec.catch(NetworkError, () => {
  console.log('Network error, returning default user');
  return { id: 'unknown', name: 'Guest' };
});

const safeFetchUser = apiExec.getSafeFnAsync(fetchUser);
const user = await safeFetchUser('123');

// Example 6: Object shape matching
const configExec = new SafeExec();
configExec.catch({ code: 404 }, () => {
  console.log('Resource not found');
  return null;
});

function getConfig(key: string): any {
  throw { code: 404, message: 'Config not found' };
}

const safeGetConfig = configExec.getSafeFn(getConfig);
const config = safeGetConfig('api_key'); // Returns null

// Example 7: Predicate matching
const mathExec = new SafeExec();
mathExec.catch(
  (err) => err instanceof Error && err.message.includes('Division by zero'),
  () => {
    console.log('Cannot divide by zero, returning 0');
    return 0;
  }
);

function divide(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

const safeDivide = mathExec.getSafeFn(divide);
const result1 = safeDivide(10, 2); // 5
const result2 = safeDivide(10, 0); // 0 (handled)
*/
