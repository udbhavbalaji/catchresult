import { ErrorHandler, SafeExec } from "./src";

const safeExec = new SafeExec();

class ValidationError extends Error {
  constructor(public message: string) {
    super(message);
  }
}

safeExec.catch(ValidationError, (err, args) => {
  console.log(args?.location, args?.args, args?.additionalContext.type);
  return false;
});

function validate(input: unknown) {
  if (typeof input !== "boolean") {
    throw new ValidationError("Input must be a string");
  } else return input;
}

const safeValidate = safeExec.getSafeFn(validate, { location: "validate" });

const num = safeValidate.addContext({ type: typeof 42 })(42);
const str = safeValidate.addContext({ type: typeof "hello" })("hello");
const bool = safeValidate(true);

console.log(typeof num, num);
console.log(typeof str, str);
console.log(typeof bool, bool);
