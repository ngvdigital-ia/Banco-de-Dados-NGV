export const OPERATION_OPERATOR_EMAILS = Object.freeze([
  "ngvdigital.ia@gmail.com",
  "ngvdigital10@gmail.com",
]);

export function isOperationOperator(email) {
  return typeof email === "string"
    && OPERATION_OPERATOR_EMAILS.includes(email.toLowerCase());
}
