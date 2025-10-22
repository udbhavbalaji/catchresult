import { describe, it, expect, beforeEach } from "bun:test";
import { SafeExec } from "../src/unwrap";
import { ok, err } from "neverthrow";

describe("Integration Tests", () => {
  let safeExec: SafeExec;

  beforeEach(() => {
    safeExec = new SafeExec();
  });

  describe("Real-world scenarios", () => {
    it("should handle JSON parsing errors", () => {
      safeExec.catch("Unexpected", () => ({}));
      const safeParse = safeExec.getSafeFn(JSON.parse);
      const result = safeParse("invalid json");
      expect(result).toEqual({});
    });

    it("should handle multiple different error types simultaneously", () => {
      class ValidationError extends Error {}
      class DatabaseError extends Error {}

      safeExec
        .catch(ValidationError, () => ({ valid: false }))
        .catch(DatabaseError, () => ({ data: [] }))
        .catchAll(() => ({ error: "unknown" }));

      const validateFn = safeExec.getSafeFn((): { valid: boolean } => {
        throw new ValidationError("invalid input");
      });

      const queryFn = safeExec.getSafeFn((): Record<string, any> => {
        throw new DatabaseError("connection failed");
      });

      const unknownFn = safeExec.getSafeFn(
        (): { data: any } | { error: any } => {
          throw new Error("something else");
        },
      );

      expect(validateFn()).toEqual({ valid: false });
      expect(queryFn()).toEqual({ data: [] });
      expect(unknownFn()).toEqual({ error: "unknown" });
    });

    it("should handle file operation simulation", () => {
      const simulatedFileSystem: Record<string, string> = {
        "file.txt": "content",
      };

      safeExec.catch("ENOENT", () => null).catch("EACCES", () => null);

      const readFile = safeExec.getSafeFn((path: string) => {
        if (!simulatedFileSystem[path]) {
          throw new Error("ENOENT: File not found");
        }
        return simulatedFileSystem[path];
      });

      expect(readFile("file.txt")).toBe("content");
      expect(readFile("missing.txt")).toBeNull();
    });

    it("should work with API error responses", () => {
      safeExec.catch({ status: 404 }, () => ({ notFound: true }));
      safeExec.catch({ status: 500 }, () => ({ serverError: true }));
      safeExec.catchAll(() => ({ unknown: true }));

      const apiCall = safeExec.getSafeFn((statusCode: number) => {
        if (statusCode === 404) {
          throw { status: 404, message: "Not Found" };
        }
        if (statusCode === 500) {
          throw { status: 500, message: "Server Error" };
        }
        throw { status: statusCode };
      });

      expect(apiCall(404)).toEqual({ notFound: true });
      expect(apiCall(500)).toEqual({ serverError: true });
      expect(apiCall(403)).toEqual({ unknown: true });
    });

    it("should handle async API calls with error handling", async () => {
      safeExec.catch("timeout", () => "timeout_fallback");
      safeExec.catch("network", () => "offline_fallback");
      safeExec.catchAll(() => "unknown_error");

      const fetchUser = safeExec.getSafeFnAsync(async (userId: string) => {
        if (userId === "timeout") throw new Error("timeout error");
        if (userId === "network") throw new Error("network error");
        return { id: userId, name: "User" };
      });

      expect(await fetchUser("123")).toEqual({ id: "123", name: "User" });
      expect(await fetchUser("timeout")).toBe("timeout_fallback");
      expect(await fetchUser("network")).toBe("offline_fallback");
    });

    it("should work with neverthrow Result types", () => {
      safeExec.catch("DB_ERROR", () => []);

      const okResult = ok([{ id: 1, name: "test" }]);
      const errResult = err(new Error("DB_ERROR"));

      expect(safeExec.unwrap(okResult)).toEqual([{ id: 1, name: "test" }]);
      expect(safeExec.unwrap(errResult)).toEqual([]);
    });

    it("should preserve context through error handler chain", () => {
      interface LogContext {
        userId: string;
        action: string;
        timestamp?: number;
      }

      let finalContext: LogContext | undefined;

      safeExec.catch("operation_failed", (error, context) => {
        finalContext = context?.additionalContext as LogContext;
        return { success: false };
      });

      const operation = safeExec.getSafeFn(() => {
        throw new Error("operation_failed");
      });

      const contextualOperation = operation.addContext({
        userId: "user123",
        action: "delete_account",
      });

      contextualOperation();

      expect(finalContext?.userId).toBe("user123");
      expect(finalContext?.action).toBe("delete_account");
    });
  });

  describe("Complex handler scenarios", () => {
    it("should handle nested error contexts", () => {
      let capturedContext: any;

      safeExec.catch("parse_error", (error, context) => {
        capturedContext = context;
        return "recovered";
      });

      const parseData = safeExec.getSafeFn((input: string) => {
        throw new Error("parse_error in data");
      });

      const contextualParse = parseData.addContext({
        source: "api",
        endpoint: "/data",
      });

      contextualParse("data");

      expect(capturedContext?.additionalContext?.source).toBe("api");
      expect(capturedContext?.additionalContext?.endpoint).toBe("/data");
    });

    it("should handle predicates with complex error objects", () => {
      safeExec.catch(
        (err) => {
          if (typeof err === "object" && err !== null) {
            const e = err as any;
            return e.severity === "critical" && e.code >= 1000;
          }
          return false;
        },
        () => "critical error handled",
      );

      const throwCritical = safeExec.getSafeFn(() => {
        throw { code: 1001, severity: "critical", message: "Critical issue" };
      });

      const throwWarning = safeExec.getSafeFn(() => {
        throw { code: 500, severity: "warning", message: "Minor issue" };
      });

      safeExec.catchAll(() => "non-critical");

      expect(throwCritical()).toBe("critical error handled");
      expect(throwWarning()).toBe("non-critical");
    });
  });

  describe("Async integration scenarios", () => {
    it("should handle async operations with multiple error types", async () => {
      class TimeoutError extends Error {
        constructor(message = "Timeout") {
          super(message);
          this.name = "TimeoutError";
        }
      }

      safeExec
        .catch(TimeoutError, () => "timeout_handled")
        .catch("connection_refused", () => "connection_handled")
        .catchAll(() => "default");

      const asyncOperation = safeExec.getSafeFnAsync(async (type: string) => {
        if (type === "timeout") throw new TimeoutError();
        if (type === "connection") throw new Error("connection_refused error");
        return "success";
      });

      expect(await asyncOperation("success")).toBe("success");
      expect(await asyncOperation("timeout")).toBe("timeout_handled");
      expect(await asyncOperation("connection")).toBe("connection_handled");
    });

    it("should work with async context addition", async () => {
      let capturedError: any;
      let capturedContext: any;

      safeExec.catch("async_error", (error, context) => {
        capturedError = error;
        capturedContext = context;
        return "recovered";
      });

      const asyncOp = safeExec.getSafeFnAsync(async (value: string) => {
        throw new Error("async_error occurred");
      });

      const contextualOp = asyncOp.addContext({
        requestId: "req-123",
        service: "worker",
      });

      await contextualOp("test");

      expect((capturedError as Error).message).toContain("async_error");
      expect(capturedContext?.additionalContext?.requestId).toBe("req-123");
      expect(capturedContext?.additionalContext?.service).toBe("worker");
    });
  });

  describe("Edge case handling", () => {
    it("should handle functions that return complex objects", () => {
      const safeFn = safeExec.getSafeFn(() => ({
        data: { nested: { value: 42 } },
        status: "success",
      }));

      const result = safeFn();
      expect(result.data.nested.value).toBe(42);
      expect(result.status).toBe("success");
    });

    it("should handle rapid successive calls", () => {
      let callCount = 0;

      safeExec.catch("error", () => {
        callCount++;
        return "handled";
      });

      const safeFn = safeExec.getSafeFn(() => {
        throw new Error("error");
      });

      safeFn();
      safeFn();
      safeFn();

      expect(callCount).toBe(3);
    });

    it("should handle mixed sync/async with same handlers", async () => {
      safeExec.catch("shared_error", () => "handled");

      const syncFn = safeExec.getSafeFn(() => {
        throw new Error("shared_error");
      });

      const asyncFn = safeExec.getSafeFnAsync(async () => {
        throw new Error("shared_error");
      });

      expect(syncFn()).toBe("handled");
      expect(await asyncFn()).toBe("handled");
    });
  });

  describe("Performance-like tests", () => {
    it("should handle large argument sets", () => {
      const safeFn = safeExec.getSafeFn(
        (
          a: number,
          b: number,
          c: number,
          d: number,
          e: number,
          f: number,
          g: number,
          h: number,
          i: number,
          j: number,
        ) => a + b + c + d + e + f + g + h + i + j,
      );

      const result = safeFn(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
      expect(result).toBe(55);
    });

    it("should handle many error handlers", () => {
      const newExec = new SafeExec();
      for (let i = 0; i < 20; i++) {
        newExec.catch(
          (err) => err instanceof Error && err.message === `error_type_${i}`,
          () => `handled${i}`,
        );
      }

      newExec.catchAll(() => "default");

      const safeFn = newExec.getSafeFn(() => {
        throw new Error("error_type_15");
      });

      const result = safeFn();
      expect(result).toBe("handled15");
    });
  });

  describe("Documentation example scenarios", () => {
    it("should work like the README division example", () => {
      safeExec.catch(
        (err) =>
          err instanceof Error && err.message.includes("Division by zero"),
        () => 0,
      );

      const divide = safeExec.getSafeFn((a: number, b: number) => {
        if (b === 0) throw new Error("Division by zero");
        return a / b;
      });

      expect(divide(10, 2)).toBe(5);
      expect(divide(10, 0)).toBe(0);
    });

    it("should work like the README file operation example", () => {
      const simulatedFS: Record<string, string> = {
        "config.txt": "setting=value",
      };

      safeExec.catch("ENOENT", () => "").catch("EACCES", () => "");

      const readFile = safeExec.getSafeFn((path: string) => {
        if (!simulatedFS[path]) throw new Error("ENOENT");
        return simulatedFS[path];
      });

      expect(readFile("config.txt")).toBe("setting=value");
      expect(readFile("missing.txt")).toBe("");
    });
  });
});
