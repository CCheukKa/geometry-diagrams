import "./test";
import { simplifyToken, TG } from "@lib/equations";
import { describe, expect, test } from "bun:test";

describe("equation tokens", () => {
    test("creates literal tokens", () => {
        const token = TG.literal(2.5);

        expect(token.type).toBe("literal" as typeof token.type);
        expect(token.value.eq(2.5)).toBe(true);
    });

    test("creates variable tokens", () => {
        const token = TG.variable("x");

        expect(token.type).toBe("variable" as typeof token.type);
        expect(token.id).toBe("x");
    });

    test("creates operator tokens with the expected shape", () => {
        const literal = TG.literal(2);
        const variable = TG.variable("x");

        const add = TG.add(literal, variable);
        expect(add.type).toBe("operator" as typeof add.type);
        expect(add.operator).toBe("add" as typeof add.operator);
        expect(add.operands).toHaveLength(2);

        const multiply = TG.multiply(literal, variable);
        expect(multiply.type).toBe("operator" as typeof multiply.type);
        expect(multiply.operator).toBe("multiply" as typeof multiply.operator);
        expect(multiply.operands).toHaveLength(2);

        const power = TG.power(variable, TG.literal(2), TG.literal(3));
        expect(power.type).toBe("operator" as typeof power.type);
        expect(power.operator).toBe("power" as typeof power.operator);
        expect(power.base).toBe(variable);
        expect(power.exponents).toHaveLength(2);
    });
});

describe("deepEquals", () => {
    test("compares literals, variables, and nested operators structurally", () => {
        const literalA = TG.literal(2);
        const literalB = TG.literal(2);
        const literalC = TG.literal(3);

        const variableX1 = TG.variable("x");
        const variableX2 = TG.variable("x");
        const variableY = TG.variable("y");

        expect(literalA).toEqualToken(literalB);
        expect(literalA).not.toEqualToken(literalC);
        expect(variableX1).toEqualToken(variableX2);
        expect(variableX1).not.toEqualToken(variableY);

        const nestedAdd1 = TG.add(TG.literal(1), TG.multiply(TG.variable("x"), TG.literal(2)));
        const nestedAdd2 = TG.add(TG.literal(1), TG.multiply(TG.variable("x"), TG.literal(2)));
        const nestedAdd3 = TG.add(TG.literal(1), TG.multiply(TG.variable("x"), TG.literal(3)));

        expect(nestedAdd1).toEqualToken(nestedAdd2);
        expect(nestedAdd1).not.toEqualToken(nestedAdd3);
    });

    test("treats commutative operator operands as order independent", () => {
        const left = TG.add(TG.variable("x"), TG.literal(2), TG.variable("y"));
        const right = TG.add(TG.variable("y"), TG.literal(2), TG.variable("x"));
        const different = TG.add(TG.variable("y"), TG.literal(3), TG.variable("x"));

        expect(left).toEqualToken(right);
        expect(left).not.toEqualToken(different);

        const productLeft = TG.multiply(TG.variable("a"), TG.literal(4), TG.variable("b"));
        const productRight = TG.multiply(TG.variable("b"), TG.variable("a"), TG.literal(4));

        expect(productLeft).toEqualToken(productRight);
    });
});

describe("simplifyToken", () => {
    test("simplifies literal-only expressions", () => {
        expect(simplifyToken(TG.add(TG.literal(2), TG.literal(3)))).toEqualToken(TG.literal(5));
        expect(simplifyToken(TG.multiply(TG.literal(4), TG.literal(5)))).toEqualToken(TG.literal(20));
        expect(simplifyToken(TG.add(TG.multiply(TG.literal(2), TG.literal(3)), TG.literal(4)))).toEqualToken(TG.literal(10));
        expect(simplifyToken(TG.power(TG.literal(2), TG.literal(3)))).toEqualToken(TG.literal(8));
    });

    test("simplifies expressions with variables and identity elements", () => {
        expect(simplifyToken(TG.add(TG.variable("x"), TG.literal(0)))).toEqualToken(TG.variable("x"));
        expect(simplifyToken(TG.multiply(TG.variable("y"), TG.literal(1)))).toEqualToken(TG.variable("y"));
        expect(simplifyToken(TG.multiply(TG.variable("z"), TG.literal(0)))).toEqualToken(TG.literal(0));
    });

    test("collapses high-level operators into the expected lower-level forms", () => {
        const subtract = simplifyToken(TG.subtract(TG.variable("a"), TG.variable("b")));
        const subtractExpected = TG.add(
            TG.variable("a"),
            TG.multiply(TG.variable("b"), TG.literal(-1)),
        );
        expect(subtract).toEqualToken(subtractExpected);

        const divide = simplifyToken(TG.divide(TG.variable("a"), TG.variable("b")));
        const divideExpected = TG.multiply(
            TG.variable("a"),
            TG.power(TG.variable("b"), TG.literal(-1)),
        );
        expect(divide).toEqualToken(divideExpected);

        const negate = simplifyToken(TG.negate(TG.variable("a")));
        const negateExpected = TG.multiply(TG.variable("a"), TG.literal(-1));
        expect(negate).toEqualToken(negateExpected);
    });

    test("handles nested operator expressions", () => {
        const expression = TG.multiply(
            TG.add(TG.variable("x"), TG.literal(0)),
            TG.multiply(TG.literal(2), TG.literal(3)),
        );

        const simplified = simplifyToken(expression);
        const expected = TG.multiply(TG.variable("x"), TG.literal(6));

        expect(simplified).toEqualToken(expected);
    });

    test("collects like terms in additions and powers", () => {
        const likeTerms = simplifyToken(TG.add(TG.variable("x"), TG.variable("x"), TG.variable("x")));
        expect(likeTerms).toEqualToken(TG.multiply(TG.literal(3), TG.variable("x")));

        const multipliedVars = simplifyToken(TG.multiply(TG.variable("x"), TG.variable("x"), TG.variable("x")));
        expect(multipliedVars).toEqualToken(TG.power(TG.variable("x"), TG.literal(3)));
    });

    test("distributes coefficients across structured terms in addition", () => {
        const expression = TG.add(
            TG.multiply(TG.literal(2), TG.variable("a"), TG.variable("b")),
            TG.multiply(TG.literal(3), TG.variable("a"), TG.variable("b")),
        );

        const simplified = simplifyToken(expression);
        const expected = TG.multiply(TG.literal(5), TG.multiply(TG.variable("a"), TG.variable("b")));

        expect(simplified).toEqualToken(expected);
    });

    test("combines powers with the same base inside products", () => {
        const expression = TG.multiply(
            TG.power(TG.variable("a"), TG.literal(2)),
            TG.power(TG.variable("a"), TG.literal(3)),
        );

        const simplified = simplifyToken(expression);
        const expected = TG.power(TG.variable("a"), TG.literal(5));

        expect(simplified).toEqualToken(expected);
    });
});