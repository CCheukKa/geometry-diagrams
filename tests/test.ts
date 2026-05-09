import { expect } from "bun:test";
import { deepEquals, formatToken, type Token } from "@lib/equations";

declare module "bun:test" {
    interface Matchers<T = unknown> {
        toEqualToken(expected: Token): void;
    }
}
expect.extend({
    toEqualToken(received: unknown, expected: Token) {
        const receivedToken = received as Token;
        const pass = deepEquals(receivedToken, expected);
        const message = () => `Expected ${formatToken(expected)}, but got ${formatToken(receivedToken)}`
        return { pass, message };
    },
});