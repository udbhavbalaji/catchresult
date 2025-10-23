type ErrorReturnTypes =
  | Record<string, any>
  | Array<any>
  | string
  | boolean
  | number
  | Error
  | never;

// Types for error matching
export type ErrorClass = new (...args: any[]) => Error;
export type ErrorObject = Record<string, any>;
export type ErrorPredicate = (error: unknown) => boolean;
export type ErrorMatcher = ErrorClass | ErrorObject | string | ErrorPredicate;

export type ErrorReturnType<T> = T;

// Handler function type
export type ErrorHandler<T extends ErrorReturnTypes = any> = (
  // export type ErrorHandler<T = any> = (
  error: unknown,
  context?: Record<string, any>,
  // ) => ErrorReturnType<T>;
) => T;

// Configuration for error handlers
export interface ErrorHandlerConfig {
  matcher: ErrorMatcher;
  handler: ErrorHandler;
}

export interface SafeHandler<TArgs extends any[], TReturn> {
  (...args: TArgs): TReturn;
  addContext: (
    addedContext: Record<string, any>,
  ) => (...args: TArgs) => TReturn;
}

export interface SafeHandlerAsync<TArgs extends any[], TReturn> {
  (...args: TArgs): Promise<TReturn>;
  addContext: (
    addedContext: Record<string, any>,
  ) => (...args: TArgs) => Promise<TReturn>;
}
