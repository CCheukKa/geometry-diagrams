import { deepEquals, simplifyToken, TG } from "@lib/equations";
import { describe, expect, test } from "bun:test";

describe("simplification", () => {

    test("deepEquals", () => {
        const a = TG.literal(2);
        const b = TG.literal(2);
        expect(deepEquals(a, b)).toBe(true);

        const c = TG.variable("x");
        const d = TG.variable("x");
        expect(deepEquals(c, d)).toBe(true);

        const e = TG.add(a, c);
        const f = TG.add(b, d);
        expect(deepEquals(e, f)).toBe(true);

        const g = TG.multiply(e, f);
        const h = TG.multiply(f, e);
        expect(deepEquals(g, h)).toBe(true);

        const i = TG.literal(3);
        const j = TG.literal(4);
        expect(deepEquals(i, j)).toBe(false);

        const k = TG.variable("y");
        const l = TG.variable("z");
        expect(deepEquals(k, l)).toBe(false);
    });

    test("simplifyToken: literal", () => {
        const a = TG.add(TG.literal(2), TG.literal(3));
        const b = TG.literal(5);
        expect(deepEquals(a, b)).toBe(false);
        const simplifiedA = simplifyToken(a);
        expect(deepEquals(simplifiedA, b)).toBe(true);

        const c = TG.multiply(TG.literal(4), TG.literal(5));
        const d = TG.literal(20);
        expect(deepEquals(c, d)).toBe(false);
        const simplifiedC = simplifyToken(c);
        expect(deepEquals(simplifiedC, d)).toBe(true);

        const e = TG.add(TG.multiply(TG.literal(2), TG.literal(3)), TG.literal(4));
        const f = TG.literal(10);
        expect(deepEquals(e, f)).toBe(false);
        const simplifiedE = simplifyToken(e);
        expect(deepEquals(simplifiedE, f)).toBe(true);

        const g = TG.power(TG.literal(2), TG.literal(3));
        const h = TG.literal(8);
        expect(deepEquals(g, h)).toBe(false);
        const simplifiedG = simplifyToken(g);
        expect(deepEquals(simplifiedG, h)).toBe(true);
    });

    test("simplifyToken: variable", () => {
        const a = TG.add(TG.variable("x"), TG.literal(0));
        const b = TG.variable("x");
        expect(deepEquals(a, b)).toBe(false);
        const simplifiedA = simplifyToken(a);
        expect(deepEquals(simplifiedA, b)).toBe(true);

        const c = TG.multiply(TG.variable("y"), TG.literal(1));
        const d = TG.variable("y");
        expect(deepEquals(c, d)).toBe(false);
        const simplifiedC = simplifyToken(c);
        expect(deepEquals(simplifiedC, d)).toBe(true);

        const e = TG.multiply(TG.variable("z"), TG.literal(0));
        const f = TG.literal(0);
        expect(deepEquals(e, f)).toBe(false);
        const simplifiedE = simplifyToken(e);
        expect(deepEquals(simplifiedE, f)).toBe(true);
    });
});