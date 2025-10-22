import { describe, it, expect } from "bun:test";
import { SafeExec } from "../src/unwrap";
import type {
  ErrorClass,
  ErrorObject,
  ErrorPredicate,
  ErrorMatcher,
  ErrorHandler,
  ErrorHandlerConfig,
  SafeHandler,
  SafeHandlerAsync,
} from "../src/types";

describe("Type Definitions", () => {
  describe("ErrorClass", () => {
    it("should accept Error subclasses - signature test", () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "CustomError";
        }
      }
      const errorClass: ErrorClass = CustomError;
      expect(typeof errorClass).toBe("function");
    });

    it("should validate ErrorClass constructor signature - test only", () => {
      class MyError extends Error {}
      const ErrorConstructor: ErrorClass = MyError;
      const instance = new ErrorConstructor("test");
      expect(instance).toBeInstanceOf(Error);
    });
  });

  describe("ErrorObject", () => {
    it("should accept any Record shape - signature test", () => {
      const errorObj: ErrorObject = {
        code: 404,
        message: "Not Found",
        details: { path: "/api/users/123" },
      };
      expect(errorObj.code).toBe(404);
    });

    it("should accept empty object - test only", () => {
      const emptyError: ErrorObject = {};
      expect(typeof emptyError).toBe("object");
    });
  });

  describe("ErrorPredicate", () => {
    it("should be callable with unknown error - signature test", () => {
      const predicate: ErrorPredicate = (error) => {
        return error instanceof Error && error.message.includes("test");
      };
      const result = predicate(new Error("test error"));
      expect(result).toBe(true);
    });

    it("should handle various error types - test only", () => {
      const predicate: ErrorPredicate = (error) => {
        return error !== null && typeof error === "object";
      };
      expect(predicate({ code: 500 })).toBe(true);
      expect(predicate(null)).toBe(false);
    });

    it("should return boolean - test only", () => {
      const predicate: ErrorPredicate = () => true;
      const result = predicate("any value");
      expect(typeof result).toBe("boolean");
    });
  });

  describe("ErrorMatcher", () => {
    it("should accept ErrorClass - signature test", () => {
      class TestError extends Error {}
      const matcher: ErrorMatcher = TestError;
      expect(typeof matcher).toBe("function");
    });

    it("should accept ErrorObject - signature test", () => {
      const matcher: ErrorMatcher = { code: 404 };
      expect(typeof matcher).toBe("object");
    });

    it("should accept string - signature test", () => {
      const matcher: ErrorMatcher = "timeout";
      expect(typeof matcher).toBe("string");
    });

    it("should accept ErrorPredicate - signature test", () => {
      const matcher: ErrorMatcher = (e) => e instanceof Error;
      expect(typeof matcher).toBe("function");
    });
  });

  describe("ErrorHandler", () => {
    it("should accept error and optional args - signature test", () => {
      const handler: ErrorHandler = (error, args) => {
        if (args?.additionalContext) {
          return "handled with context";
        }
        return "handled";
      };
      const result = handler(new Error("test"), { additionalContext: {} });
      expect(typeof result).toBe("string");
    });

    // it("should return any type - test only", () => {
    //   const numberHandler: ErrorHandler<number> = () => 42;
    //   const stringHandler: ErrorHandler<string> = () => "error";
    //   const objectHandler: ErrorHandler<object> = () => ({ handled: true });
    //
    //   expect(numberHandler(new Error())).toBe(42);
    //   expect(stringHandler(new Error())).toBe("error");
    //   expect(objectHandler(new Error())).toEqual({ handled: true });
    // });

    it("should accept null or undefined args - test only", () => {
      const handler: ErrorHandler = (error) => "handled";
      const result1 = handler(new Error());
      const result2 = handler(new Error(), undefined);
      expect(result1).toBe("handled");
      expect(result2).toBe("handled");
    });
  });

  describe("ErrorHandlerConfig", () => {
    it("should have matcher and handler properties - signature test", () => {
      const config: ErrorHandlerConfig = {
        matcher: "error",
        handler: () => "handled",
      };
      expect(config.matcher).toBe("error");
      expect(typeof config.handler).toBe("function");
    });

    it("should work with class matcher - test only", () => {
      class CustomError extends Error {}
      const config: ErrorHandlerConfig = {
        matcher: CustomError,
        handler: () => "custom error handled",
      };
      expect(config.matcher).toBe(CustomError);
    });

    it("should work with object matcher - test only", () => {
      const config: ErrorHandlerConfig = {
        matcher: { status: 500 },
        handler: (error, args) => "server error",
      };
      expect(config.matcher).toEqual({ status: 500 });
    });

    it("should work with predicate matcher - test only", () => {
      const config: ErrorHandlerConfig = {
        matcher: (e) => typeof e === "string",
        handler: () => "string error",
      };
      expect(typeof config.matcher).toBe("function");
    });
  });

  describe("SafeHandler", () => {
    it("should be callable with TArgs - signature test", () => {
      // const handler: SafeHandler<[number, string], boolean> = (
      //   num: number,
      //   str: string,
      // ) => true;
      // handler.addContext(() => {});
      const safeExec = new SafeExec();
      const handler = safeExec.getSafeFn((num: number, str: string) => true);
      const result = handler(42, "test");
      expect(result).toBe(true);
    });

    // it("should have addContext method property defined - signature test", () => {
    //   type TestHandler = SafeHandler<[], string>;
    //   const typeTest: TestHandler = Object.assign(() => "result", {
    //     addContext: (ctx: any) => () => "result",
    //   }) as TestHandler;
    //   expect(typeof typeTest.addContext).toBe("function");
    // });

    it("should support addContext signature through SafeExec.getSafeFn", () => {
      const safeExec = new SafeExec();
      const handler = safeExec.getSafeFn<[], string>(() => "result");
      expect(typeof handler.addContext).toBe("function");
    });

    it("should handle multiple arguments - test only", () => {
      const safeExec = new SafeExec();
      const handler = safeExec.getSafeFn<[number, number, number], number>(
        (a, b, c) => a + b + c,
      );
      const result = handler(1, 2, 3);
      expect(result).toBe(6);
    });

    it("should handle no arguments - test only", () => {
      const safeExec = new SafeExec();
      const handler = safeExec.getSafeFn<[], string>(() => "result");
      const result = handler();
      expect(result).toBe("result");
    });
  });

  describe("SafeHandlerAsync", () => {
    it("should be async callable with TArgs - signature test", async () => {
      // const handler: SafeHandlerAsync<[number, string], boolean> = async (
      //   num: number,
      //   str: string,
      // ) => true;
      const safeExec = new SafeExec();
      const handler = safeExec.getSafeFnAsync(
        async (num: number, str: string) => true,
      );
      const result = await handler(42, "test");
      expect(result).toBe(true);
    });

    // it("should have addContext method property defined - signature test", () => {
    //   type TestAsyncHandler = SafeHandlerAsync<[], string>;
    //   const typeTest: TestAsyncHandler = Object.assign(async () => "result", {
    //     addContext: (ctx: any) => async () => "result",
    //   }) as TestAsyncHandler;
    //   expect(typeof typeTest.addContext).toBe("function");
    // });

    it("should support addContext signature through SafeExec.getSafeFnAsync", () => {
      const safeExec = new SafeExec();
      const handler = safeExec.getSafeFnAsync<[], string>(async () => "result");
      expect(typeof handler.addContext).toBe("function");
    });

    it("should handle multiple async arguments - test only", async () => {
      const safeExec = new SafeExec();
      const handler = safeExec.getSafeFnAsync<[number, number], number>(
        async (a, b) => {
          await new Promise((resolve) => setTimeout(resolve, 0));
          return a + b;
        },
      );
      const result = await handler(10, 20);
      expect(result).toBe(30);
    });

    it("should handle no arguments async - test only", async () => {
      const safeExec = new SafeExec();
      const handler = safeExec.getSafeFnAsync<[], string>(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return "async result";
      });
      const result = await handler();
      expect(result).toBe("async result");
    });
  });

  describe("Type combinations", () => {
    it("should work with complex ErrorMatcher union", () => {
      const matcher1: ErrorMatcher = "string";
      const matcher2: ErrorMatcher = { code: 404 };
      const matcher3: ErrorMatcher = (e) => true;
      class MyError extends Error {}
      const matcher4: ErrorMatcher = MyError;

      expect(typeof matcher1).toBe("string");
      expect(typeof matcher2).toBe("object");
      expect(typeof matcher3).toBe("function");
      expect(typeof matcher4).toBe("function");
    });

    // it("should work with ErrorHandlerConfig array", () => {
    //   const configs: ErrorHandlerConfig[] = [
    //     { matcher: "error1", handler: () => "h1" },
    //     { matcher: { code: 500 }, handler: () => "h2" },
    //     { matcher: (e) => true, handler: () => "h3" },
    //   ];
    //   expect(configs.length).toBe(3);
    // });

    it("should support typed SafeHandler with context through SafeExec", () => {
      const safeExec = new SafeExec();
      const handler = safeExec.getSafeFn<[string, number], string>(
        (name, age) => `${name} is ${age}`,
      );
      const contextualHandler = handler.addContext({ location: "US" });
      const result = contextualHandler("Alice", 30);
      expect(result).toBe("Alice is 30");
    });
  });
});
