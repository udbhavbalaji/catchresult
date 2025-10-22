import { describe, it, expect, beforeEach } from "bun:test";
import { SafeExec } from "../src/unwrap";
import { ok, err } from "neverthrow";

describe("SafeExec", () => {
  let safeExec: SafeExec;

  beforeEach(() => {
    safeExec = new SafeExec();
  });

  describe("catch", () => {
    it("should register an error handler and return this for chaining", () => {
      const handler = () => "error handled";
      const result = safeExec.catch("test", handler);
      expect(result).toBe(safeExec);
    });

    it("should handle string-based error matching", () => {
      safeExec.catch("test error", () => "handled");
      const safeFn = safeExec.getSafeFn((): string => {
        throw new Error("test error message");
      });
      const result = safeFn();
      expect(result).toBe("handled");
    });

    it("should handle error class matching", () => {
      class CustomError extends Error {}
      safeExec.catch(CustomError, () => "custom error handled");
      const safeFn = safeExec.getSafeFn((): string => {
        throw new CustomError("test");
      });
      const result = safeFn();
      expect(result).toBe("custom error handled");
    });
  });

  describe("catchMany", () => {
    it("should register multiple error handlers at once", () => {
      const handlers: Array<
        [string | ((e: unknown) => boolean), () => string]
      > = [
        ["error1", () => "handled 1"],
        ["error2", () => "handled 2"],
      ];
      const result = safeExec.catchMany(handlers);
      expect(result).toBe(safeExec);
    });

    it("should register multiple handlers and apply correct one", () => {
      safeExec.catchMany([
        ["error1", () => "handled 1"],
        ["error2", () => "handled 2"],
      ]);
      const safeFn = safeExec.getSafeFn((): string => {
        throw new Error("error2 occurred");
      });
      const result = safeFn();
      expect(result).toBe("handled 2");
    });
  });

  describe("catchAll", () => {
    it("should register a catch-all handler and return this for chaining", () => {
      const handler = () => "catch all";
      const result = safeExec.catchAll(handler);
      expect(result).toBe(safeExec);
    });

    it("should use catch-all handler when no specific handler matches", () => {
      safeExec.catch("specific", () => "specific");
      safeExec.catchAll(() => "catch all");
      const safeFn = safeExec.getSafeFn((): string => {
        throw new Error("unknown error");
      });
      const result = safeFn();
      expect(result).toBe("catch all");
    });
  });

  describe("getSafeFn", () => {
    it("should execute function successfully and return its value", () => {
      const safeFn = safeExec.getSafeFn((a: number, b: number) => a + b);
      const result = safeFn(2, 3);
      expect(result).toBe(5);
    });

    it("should catch and handle thrown errors", () => {
      safeExec.catch("division", () => 0);
      const safeFn = safeExec.getSafeFn((a: number, b: number) => {
        if (b === 0) throw new Error("division by zero");
        return a / b;
      });
      const result = safeFn(10, 0);
      expect(result).toBe(0);
    });

    it("should handle predicate-based error matching", () => {
      safeExec.catch(
        (err) => err instanceof Error && err.message.includes("custom"),
        () => "predicate matched",
      );
      const safeFn = safeExec.getSafeFn((): string => {
        throw new Error("custom message");
      });
      const result = safeFn();
      expect(result).toBe("predicate matched");
    });

    it("should handle object shape matching", () => {
      safeExec.catch({ code: 404 }, () => "not found");
      const safeFn = safeExec.getSafeFn((): string => {
        throw { code: 404, message: "Not found" };
      });
      const result = safeFn();
      expect(result).toBe("not found");
    });

    it("should provide error and context to handler", () => {
      let capturedError: any;
      safeExec.catch("test", (error, context) => {
        capturedError = error;
        return "handled";
      });
      const safeFn = safeExec.getSafeFn((x: number) => {
        throw new Error("test error");
      });
      safeFn(5);
      expect(capturedError).toBeInstanceOf(Error);
      expect((capturedError as Error).message).toBe("test error");
    });

    it("should preserve function arguments in context", () => {
      let capturedArgs: any;
      safeExec.catch("error", (error, context) => {
        capturedArgs = context?.args;
        return "handled";
      });
      const safeFn = safeExec.getSafeFn((a: number, b: string) => {
        throw new Error("error");
      });
      safeFn(42, "test");
      expect(capturedArgs).toEqual([42, "test"]);
    });
  });

  describe("getSafeFn with addContext", () => {
    it("should add context to error handler", async () => {
      let capturedContext: any;
      safeExec.catch("error", (error, context) => {
        capturedContext = context?.additionalContext;
        return "handled";
      });
      const safeFn = safeExec.getSafeFn(() => {
        throw new Error("error");
      });
      const contextualFn = safeFn.addContext({ userId: 123, action: "test" });
      contextualFn();
      expect(capturedContext).toMatchObject({
        userId: 123,
        action: "test",
      });
    });

    it("should merge multiple context additions", () => {
      let capturedContext: any;
      safeExec.catch("error", (error, context) => {
        capturedContext = context?.additionalContext;
        return "handled";
      });
      const safeFn = safeExec.getSafeFn(() => {
        throw new Error("error");
      });
      const contextualFn = safeFn.addContext({ userId: 123 });
      contextualFn();
      expect(capturedContext).toHaveProperty("userId", 123);
    });
  });

  describe("unwrap", () => {
    it("should unwrap Ok result and return value", () => {
      const result = ok(42);
      const value = safeExec.unwrap(result);
      expect(value).toBe(42);
    });

    it("should handle Err result with matching handler", () => {
      safeExec.catch("custom", () => "error handled");
      const result = err(new Error("custom error"));
      const value = safeExec.unwrap(result);
      expect(value).toBe("error handled");
    });

    it("should use catch-all handler for Err when no specific handler matches", () => {
      safeExec.catchAll(() => "default");
      const result = err(new Error("unknown"));
      const value = safeExec.unwrap(result);
      expect(value).toBe("default");
    });

    it("should pass error context to unwrap handler", () => {
      let capturedContext: any;
      safeExec.catch("test", (error, context) => {
        capturedContext = context?.additionalContext;
        return "handled";
      });
      const error = new Error("test error");
      const result = err(error);
      safeExec.unwrap(result);
      expect(capturedContext).toBeDefined();
      expect(capturedContext._context).toBeDefined();
    });
  });

  describe("unwrapAsync", () => {
    it("should unwrap async Ok result and return value", async () => {
      const result = Promise.resolve(ok(42));
      const value = await safeExec.unwrapAsync(result as any);
      expect(value).toBe(42);
    });

    it("should handle async Err result with matching handler", async () => {
      safeExec.catch("async error", () => "handled");
      const result = Promise.resolve(err(new Error("async error")));
      const value = await safeExec.unwrapAsync(result as any);
      expect(value).toBe("handled");
    });

    it("should use catch-all handler for async Err", async () => {
      safeExec.catchAll(() => "default async");
      const result = Promise.resolve(err(new Error("unknown")));
      const value = await safeExec.unwrapAsync(result as any);
      expect(value).toBe("default async");
    });
  });

  describe("getSafeFnAsync", () => {
    it("should execute async function successfully and return its value", async () => {
      const safeFn = safeExec.getSafeFnAsync(
        async (a: number, b: number) => a + b,
      );
      const result = await safeFn(2, 3);
      expect(result).toBe(5);
    });

    it("should catch and handle async function errors", async () => {
      safeExec.catch("async division", () => 0);
      const safeFn = safeExec.getSafeFnAsync(async (a: number, b: number) => {
        if (b === 0) throw new Error("async division by zero");
        return a / b;
      });
      const result = await safeFn(10, 0);
      expect(result).toBe(0);
    });

    it("should handle error class matching in async functions", async () => {
      class AsyncError extends Error {}
      safeExec.catch(AsyncError, () => "async error handled");
      const safeFn = safeExec.getSafeFnAsync(async (): Promise<string> => {
        throw new AsyncError("async");
      });
      const result = await safeFn();
      expect(result).toBe("async error handled");
    });

    it("should preserve function arguments in async context", async () => {
      let capturedArgs: any;
      safeExec.catch("error", (error, context) => {
        capturedArgs = context?.args;
        return "handled";
      });
      const safeFn = safeExec.getSafeFnAsync(async (a: number, b: string) => {
        throw new Error("error");
      });
      await safeFn(42, "async");
      expect(capturedArgs).toEqual([42, "async"]);
      // expect(capturedArgs).toEqual({ 0: 42, 1: "async" });
    });
  });

  describe("getSafeFnAsync with addContext", () => {
    it("should add context to async error handler", async () => {
      let capturedContext: any;
      safeExec.catch("error", (error, context) => {
        capturedContext = context?.additionalContext;
        return "handled";
      });
      const safeFn = safeExec.getSafeFnAsync(async () => {
        throw new Error("error");
      });
      const contextualFn = safeFn.addContext({ requestId: "123" });
      await contextualFn();
      expect(capturedContext).toMatchObject({ requestId: "123" });
    });

    it("should handle async with merged context", async () => {
      let capturedContext: any;
      safeExec.catch("error", (error, context) => {
        capturedContext = context?.additionalContext;
        return "handled";
      });
      const safeFn = safeExec.getSafeFnAsync(async () => {
        throw new Error("error");
      });
      const contextualFn = safeFn.addContext({ service: "api" });
      await contextualFn();
      expect(capturedContext).toHaveProperty("service", "api");
    });
  });

  describe("Error matching - matchesError (via getSafeFn)", () => {
    it("should match error by class instance", () => {
      class MyError extends Error {}
      let matched = false;
      safeExec.catch(MyError, () => {
        matched = true;
        return "matched";
      });
      const safeFn = safeExec.getSafeFn(() => {
        throw new MyError("test");
      });
      safeFn();
      expect(matched).toBe(true);
    });

    it("should not match different error classes", () => {
      class ErrorA extends Error {}
      class ErrorB extends Error {}
      safeExec.catch(ErrorA, () => "errorA");
      safeExec.catchAll(() => "catchAll");
      const safeFn = safeExec.getSafeFn((): string => {
        throw new ErrorB("test");
      });
      const result = safeFn();
      expect(result).toBe("catchAll");
    });

    it("should match string in error message", () => {
      safeExec.catch("timeout", () => "timeout handled");
      const safeFn = safeExec.getSafeFn((): string => {
        throw new Error("Request timeout occurred");
      });
      const result = safeFn();
      expect(result).toBe("timeout handled");
    });

    it("should match object shape", () => {
      safeExec.catch({ status: 500 }, () => "server error");
      const safeFn = safeExec.getSafeFn((): string => {
        throw { status: 500, message: "Internal Server Error" };
      });
      const result = safeFn();
      expect(result).toBe("server error");
    });

    it("should use first matching handler", () => {
      safeExec.catch("error", () => "first").catch("error", () => "second");
      const safeFn = safeExec.getSafeFn((): string => {
        throw new Error("error message");
      });
      const result = safeFn();
      expect(result).toBe("first");
    });
  });

  describe("Constructor", () => {
    it("should initialize with handlers passed to constructor", () => {
      const exec = new SafeExec([["test", () => "initialized"]]);
      const safeFn = exec.getSafeFn((): string => {
        throw new Error("test error");
      });
      const result = safeFn();
      expect(result).toBe("initialized");
    });

    it("should handle empty constructor", () => {
      const exec = new SafeExec();
      expect(exec).toBeInstanceOf(SafeExec);
    });

    it("should initialize with multiple handlers in constructor", () => {
      const exec = new SafeExec([
        ["error1", () => "handler1"],
        ["error2", () => "handler2"],
      ]);
      const safeFn1 = exec.getSafeFn((): string => {
        throw new Error("error1");
      });
      expect(safeFn1()).toBe("handler1");
    });
  });

  describe("Chain methods", () => {
    it("should chain catch and catchAll methods", () => {
      const result = safeExec
        .catch("error1", () => "h1")
        .catch("error2", () => "h2")
        .catchAll(() => "default");
      expect(result).toBe(safeExec);
    });

    it("should chain catchMany with catch", () => {
      const result = safeExec
        .catchMany([
          ["e1", () => "h1"],
          ["e2", () => "h2"],
        ])
        .catch("e3", () => "h3");
      expect(result).toBe(safeExec);
    });
  });

  describe("Edge cases", () => {
    it("should handle function that returns undefined", () => {
      const safeFn = safeExec.getSafeFn(() => undefined);
      const result = safeFn();
      expect(result).toBeUndefined();
    });

    it("should handle function that returns null", () => {
      const safeFn = safeExec.getSafeFn(() => null);
      const result = safeFn();
      expect(result).toBeNull();
    });

    it("should handle function with no arguments", () => {
      const safeFn = safeExec.getSafeFn(() => "result");
      const result = safeFn();
      expect(result).toBe("result");
    });

    it("should handle function with many arguments", () => {
      const safeFn = safeExec.getSafeFn(
        (a: number, b: number, c: number, d: number) => a + b + c + d,
      );
      const result = safeFn(1, 2, 3, 4);
      expect(result).toBe(10);
    });

    it("should preserve error stack trace in context", () => {
      let capturedContext: any;
      safeExec.catch("stack test", (error, context) => {
        capturedContext = context?.additionalContext;
        return "handled";
      });
      const safeFn = safeExec.getSafeFn(() => {
        throw new Error("stack test error");
      });
      safeFn();
      expect(capturedContext?._context).toBeDefined();
    });
  });

  describe("Type safety signatures", () => {
    // it("should maintain type information for getSafeFn - signature test", () => {
    //   type TestSig = () => void;
    //   const safeFn = safeExec.getSafeFn(() => {
    //     return 42;
    //   });
    //   expect(typeof safeFn).toBe("function");
    // });

    it("should maintain type information for getSafeFnAsync - signature test", () => {
      const safeFnAsync = safeExec.getSafeFnAsync(async () => {
        return "result";
      });
      expect(typeof safeFnAsync).toBe("function");
    });
  });
});
