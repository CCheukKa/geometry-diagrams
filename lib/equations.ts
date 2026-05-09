import Decimal from "decimal.js";

enum TokenType {
    LITERAL = 'literal',
    VARIABLE = 'variable',
    OPERATOR = 'operator',
}

enum Operator {
    ADD = 'add',
    MULTIPLY = 'multiply',
    POWER = 'power',
    ABSOLUTE_VALUE = 'absolute_value',
    SINE = 'sine',
    COSINE = 'cosine',
    TANGENT = 'tangent',
    ARCSINE = 'arcsine',
    ARCCOSINE = 'arccosine',
    ARCTANGENT = 'arctangent',
}

type LiteralToken = {
    type: TokenType.LITERAL,
    value: Decimal,
}

type VariableToken = {
    type: TokenType.VARIABLE,
    id: string,
}

type OperatorToken = {
    type: TokenType.OPERATOR,
} & ({
    operator: Operator.ADD | Operator.MULTIPLY,
    operands: Token[],
} | {
    operator: Operator.POWER,
    base: Token,
    exponents: Token[],
} | {
    operator: Operator.ABSOLUTE_VALUE | Operator.SINE | Operator.COSINE | Operator.TANGENT | Operator.ARCSINE | Operator.ARCCOSINE | Operator.ARCTANGENT,
    operand: Token,
});

export type Token = LiteralToken | VariableToken | OperatorToken;

export type Equation = { //! always = 0
    id: string,
    expression: Token,
}
// TODO: Inequalities

export class TG {
    public static literal(value: Decimal.Value): LiteralToken {
        return {
            type: TokenType.LITERAL,
            value: new Decimal(value),
        };
    }
    public static variable(id: string): VariableToken {
        return {
            type: TokenType.VARIABLE,
            id,
        };
    }
    public static add(...operands: Token[]): Token & { type: TokenType.OPERATOR, operator: Operator.ADD } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.ADD,
            operands,
        };
    }
    public static subtract(left: Token, right: Token): Token & { type: TokenType.OPERATOR, operator: Operator.ADD } {
        return this.add(left, this.multiply(right, TG.literal(-1)));
    }
    public static equal(left: Token, right: Token): Token & { type: TokenType.OPERATOR, operator: Operator.ADD } {
        return this.subtract(left, right);
    }
    public static multiply(...operands: Token[]): Token & { type: TokenType.OPERATOR, operator: Operator.MULTIPLY } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.MULTIPLY,
            operands,
        };
    }
    public static divide(left: Token, right: Token): Token & { type: TokenType.OPERATOR, operator: Operator.MULTIPLY } {
        return this.multiply(left, this.power(right, TG.literal(-1)));
    }
    public static power(base: Token, ...exponents: Token[]): Token & { type: TokenType.OPERATOR, operator: Operator.POWER } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.POWER,
            base,
            exponents,
        };
    }
    public static square(base: Token): Token & { type: TokenType.OPERATOR, operator: Operator.POWER } {
        return this.power(base, TG.literal(2));
    }
    public static cube(base: Token): Token & { type: TokenType.OPERATOR, operator: Operator.POWER } {
        return this.power(base, TG.literal(3));
    }
    public static sqrt(base: Token): Token & { type: TokenType.OPERATOR, operator: Operator.POWER } {
        return this.power(base, TG.literal(0.5));
    }
    public static cbrt(base: Token): Token & { type: TokenType.OPERATOR, operator: Operator.POWER } {
        return this.power(base, TG.literal(1 / 3));
    }
    public static negate(operand: Token): Token & { type: TokenType.OPERATOR, operator: Operator.MULTIPLY } {
        return this.multiply(operand, TG.literal(-1));
    }
    public static abs(operand: Token): Token & { type: TokenType.OPERATOR, operator: Operator.ABSOLUTE_VALUE } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.ABSOLUTE_VALUE,
            operand,
        };
    }
    public static sin(operand: Token): Token & { type: TokenType.OPERATOR, operator: Operator.SINE } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.SINE,
            operand,
        };
    }
    public static cos(operand: Token): Token & { type: TokenType.OPERATOR, operator: Operator.COSINE } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.COSINE,
            operand,
        };
    }
    public static tan(operand: Token): Token & { type: TokenType.OPERATOR, operator: Operator.TANGENT } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.TANGENT,
            operand,
        };
    }
    public static asin(operand: Token): Token & { type: TokenType.OPERATOR, operator: Operator.ARCSINE } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.ARCSINE,
            operand,
        };
    }
    public static acos(operand: Token): Token & { type: TokenType.OPERATOR, operator: Operator.ARCCOSINE } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.ARCCOSINE,
            operand,
        };
    }
    public static atan(operand: Token): Token & { type: TokenType.OPERATOR, operator: Operator.ARCTANGENT } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.ARCTANGENT,
            operand,
        };
    }
}

export function formatToken(token: Token): string {
    switch (token.type) {
        case TokenType.LITERAL: return token.value.toString();
        case TokenType.VARIABLE: return token.id;
        case TokenType.OPERATOR: {
            switch (token.operator) {
                case Operator.ADD: return `(${token.operands.map(formatToken).join(' + ')})`;
                case Operator.MULTIPLY: return `(${token.operands.map(formatToken).join(' * ')})`;
                case Operator.POWER: return `(${formatToken(token.base)} ^ ${token.exponents.map(formatToken).join(' ^ ')})`;
                case Operator.SINE: return `sin(${formatToken(token.operand)})`;
                case Operator.COSINE: return `cos(${formatToken(token.operand)})`;
                case Operator.TANGENT: return `tan(${formatToken(token.operand)})`;
                case Operator.ARCSINE: return `arcsin(${formatToken(token.operand)})`;
                case Operator.ARCCOSINE: return `arccos(${formatToken(token.operand)})`;
                case Operator.ARCTANGENT: return `arctan(${formatToken(token.operand)})`;
                default: {
                    // @ts-expect-error
                    const _exhaustiveCheck: never = token.operator;
                    return _exhaustiveCheck;
                }
            }
        }
    }
}

export function solveSystemOfEquations(equations: Equation[]): Record<string, Decimal> {
    // simplify equations
    equations = equations.map(equation => ({
        id: equation.id,
        expression: simplifyToken(equation.expression),
    }));

    // get equation dependencies
    const dependentVariables: Record<string, string[]> = {};
    for (const equation of equations) {
        dependentVariables[equation.id] = [
            ...enumerateVariables(equation.expression),
        ];
    }
    // const uniqueVariables = Array.from(new Set(Object.values(dependentVariables).flat()));

    return {}
}

function enumerateVariables(token: Token): string[] {
    const variableIDs: string[] = [];
    if (token.type === TokenType.VARIABLE) {
        variableIDs.push(token.id);
    }
    if (token.type === TokenType.OPERATOR) {
        if (token.operator === Operator.ADD || token.operator === Operator.MULTIPLY) {
            for (const operand of token.operands) {
                variableIDs.push(...enumerateVariables(operand));
            }
        }
        if (token.operator === Operator.SINE || token.operator === Operator.COSINE || token.operator === Operator.TANGENT || token.operator === Operator.ARCSINE || token.operator === Operator.ARCCOSINE || token.operator === Operator.ARCTANGENT) {
            variableIDs.push(...enumerateVariables(token.operand));
        }
        if (token.operator === Operator.POWER) {
            variableIDs.push(...enumerateVariables(token.base));
            for (const exponent of token.exponents) {
                variableIDs.push(...enumerateVariables(exponent));
            }
        }
    }
    return variableIDs;
}

function isLiteral(token: Token): token is LiteralToken { return token.type === TokenType.LITERAL; }
function isVariable(token: Token): token is VariableToken { return token.type === TokenType.VARIABLE; }
function isOperator(token: Token): token is OperatorToken { return token.type === TokenType.OPERATOR; }
export function deepEquals(token1: Token, token2: Token): boolean {
    if (token1.type !== token2.type) { return false; }
    if (isLiteral(token1) && isLiteral(token2)) {
        return token1.value.equals(token2.value);
    }
    if (isVariable(token1) && isVariable(token2)) {
        return token1.id === token2.id;
    }
    if (isOperator(token1) && isOperator(token2)) {
        if (token1.operator !== token2.operator) { return false; }
        switch (token1.operator) {
            case Operator.ADD:
            case Operator.MULTIPLY:
                // @ts-ignore
                return tokensMatch(token1.operands, token2.operands);
            case Operator.POWER:
                // @ts-ignore
                return deepEquals(token1.base, token2.base) && tokensMatch(token1.exponents, token2.exponents);
            case Operator.SINE:
            case Operator.COSINE:
            case Operator.TANGENT:
            case Operator.ARCSINE:
            case Operator.ARCCOSINE:
            case Operator.ARCTANGENT:
                // @ts-ignore
                return deepEquals(token1.operand, token2.operand);
        }
    }
    return false;
    /* -------------------------------------------------------------------------- */
    function tokensMatch(tokens1: Token[], tokens2: Token[]): boolean {
        if (tokens1.length !== tokens2.length) { return false; }
        const sortedTokens1 = [...tokens1].sort(compareTokens);
        const sortedTokens2 = [...tokens2].sort(compareTokens);
        return sortedTokens1.every((token, index) => deepEquals(token, sortedTokens2[index]!));
        // 
        function compareTokens(token1: Token, token2: Token): number {
            return tokenKey(token1).localeCompare(tokenKey(token2));
        }
    }
}

function tokenKey(token: Token): string {
    switch (token.type) {
        case TokenType.LITERAL:
            return `literal:${token.value.toString()}`;
        case TokenType.VARIABLE:
            return `variable:${token.id}`;
        case TokenType.OPERATOR: {
            switch (token.operator) {
                case Operator.ADD:
                case Operator.MULTIPLY:
                    return `${token.operator}:[${token.operands.map(tokenKey).sort().join("|")}]`;
                case Operator.POWER:
                    return `${token.operator}:${tokenKey(token.base)}:[${token.exponents.map(tokenKey).sort().join("|")}]`;
                case Operator.ABSOLUTE_VALUE:
                case Operator.SINE:
                case Operator.COSINE:
                case Operator.TANGENT:
                case Operator.ARCSINE:
                case Operator.ARCCOSINE:
                case Operator.ARCTANGENT:
                    return `${token.operator}:${tokenKey(token.operand)}`;
            }
        }
    }
}

export function simplifyToken(rawToken: Token): Token {
    if (isLiteral(rawToken) || isVariable(rawToken)) { return rawToken; }
    let token: Token = rawToken;

    token = evaluateLiterals(token);
    if (isLiteral(token) || isVariable(token)) { return token; }

    token = combineLikeTerms(token);

    return token;
}

function evaluateLiterals(token: OperatorToken): Token {
    // 2 + 3 + 4 + x => 9 + x
    // 2 * 3 * 4 * x => 24 * x
    // 2 ^ 3 ^ 4 ^ x => 64 ^ x
    // x ^ 2 ^ 3 ^ 4 => x ^ 64

    switch (token.operator) {
        case Operator.ADD: {
            token.operands = token.operands.map(simplifyToken);
            const literals = token.operands.filter(operand => isLiteral(operand));
            const nonLiterals = token.operands.filter(operand => !isLiteral(operand));
            const literalSum = literals.reduce((sum, operand) => sum.plus(operand.value), new Decimal(0));

            if (nonLiterals.length === 0) { return TG.literal(literalSum); }
            if (literalSum.isZero()) {
                if (nonLiterals.length === 1) { return nonLiterals[0]!; }
                return TG.add(...nonLiterals);
            }
            return TG.add(
                ...nonLiterals,
                TG.literal(literalSum),
            );
        }
        case Operator.MULTIPLY: {
            token.operands = token.operands.map(simplifyToken);
            const literals = token.operands.filter(operand => isLiteral(operand));
            const nonLiterals = token.operands.filter(operand => !isLiteral(operand));
            const literalProduct = literals.reduce((product, operand) => product.times(operand.value), new Decimal(1));

            if (nonLiterals.length === 0) { return TG.literal(literalProduct); }
            if (literalProduct.isZero()) { return TG.literal(0); }
            if (literalProduct.eq(1)) {
                if (nonLiterals.length === 1) { return nonLiterals[0]!; }
                return TG.multiply(...nonLiterals);
            }
            return TG.multiply(
                ...nonLiterals,
                TG.literal(literalProduct),
            );
        }
        case Operator.POWER: {
            token.base = simplifyToken(token.base);
            token.exponents = token.exponents.map(simplifyToken);
            const exponent = simplifyToken(TG.multiply(...token.exponents));

            let literalExponent: LiteralToken = TG.literal(1);
            let nonLiteralExponents: (VariableToken | OperatorToken)[] = [];
            if (isLiteral(exponent)) {
                literalExponent = exponent;
            } else if (isVariable(exponent)) {
                nonLiteralExponents = [exponent];
            } else if (isOperator(exponent) && exponent.operator === Operator.MULTIPLY) {
                for (const operand of exponent.operands) {
                    if (isLiteral(operand)) {
                        throw new Error("Unexpected multiple literal exponents after simplification. This likely indicates a bug in the simplification logic.");
                    } else {
                        nonLiteralExponents.push(operand);
                    }
                }
            } else {
                nonLiteralExponents = [exponent];
            }

            if (literalExponent.value.eq(0)) {
                if (nonLiteralExponents.length === 0) { return token.base; }
                if (nonLiteralExponents.length > 0) { return TG.power(token.base, ...nonLiteralExponents); }
            }
            if (literalExponent.value.eq(1)) {
                const literalValue = literalExponent.value;
                if (literalValue.isZero()) { return TG.literal(1); }
                if (literalValue.eq(1)) {
                    if (nonLiteralExponents.length === 0) { return token.base; }
                    return TG.power(token.base, ...nonLiteralExponents);
                }
            }
            if (isLiteral(token.base)) {
                const baseValue = token.base.value;
                if (baseValue.isZero()) {
                    if (literalExponent.value.isPositive()) { return TG.literal(0); }
                    if (literalExponent.value.isNegative()) { throw new Error("Zero cannot be raised to a negative power."); }
                }
                if (baseValue.eq(1)) { return TG.literal(1); }
                return TG.literal(baseValue.pow(literalExponent.value));
            }
            if (nonLiteralExponents.length === 0) { return TG.power(token.base, literalExponent); }
            return TG.power(
                token.base,
                literalExponent,
                ...nonLiteralExponents,
            );
        }
        default: { return token; }
    }
}

function combineLikeTerms(token: OperatorToken): Token {
    // x + x + x => 3 * x
    // x * x * x => x ^ 3
    // a * b + a * c => a * (b + c)
    // a ^ b * a ^ c => a ^ (b + c)

    if (token.operator === Operator.ADD) {
        const termMap: Record<string, { coefficient: Decimal, term: Token }> = {};
        for (const operand of token.operands) {
            if (isLiteral(operand)) {
                const key = '1';
                if (!termMap[key]) {
                    termMap[key] = { coefficient: operand.value, term: TG.literal(1) };
                } else {
                    termMap[key].coefficient = termMap[key].coefficient.plus(operand.value);
                }
            } else if (isVariable(operand)) {
                const key = operand.id;
                if (!termMap[key]) {
                    termMap[key] = { coefficient: new Decimal(1), term: operand };
                } else {
                    termMap[key].coefficient = termMap[key].coefficient.plus(1);
                }
            } else if (isOperator(operand) && operand.operator === Operator.MULTIPLY) {
                const literalFactors = operand.operands.filter(isLiteral);
                const nonLiteralFactors = operand.operands.filter(op => !isLiteral(op));
                if (literalFactors.length === 0) { continue; }
                const coefficient = literalFactors.reduce((product, operand) => product.times(operand.value), new Decimal(1));
                const key = nonLiteralFactors.map(factor => JSON.stringify(factor)).sort().join('*');
                if (!termMap[key]) {
                    termMap[key] = { coefficient, term: nonLiteralFactors.length === 1 ? nonLiteralFactors[0]! : TG.multiply(...nonLiteralFactors) };
                } else {
                    termMap[key].coefficient = termMap[key].coefficient.plus(coefficient);
                }
            }
        }
        token.operands = Object.values(termMap).map(({ coefficient, term }) => {
            if (coefficient.isZero()) { return null; }
            if (term.type === TokenType.LITERAL && term.value.equals(1)) {
                return TG.literal(coefficient);
            }
            if (term.type === TokenType.LITERAL) {
                return TG.multiply(
                    TG.literal(coefficient.times(term.value)),
                    TG.literal(1),
                );
            }
            if (coefficient.equals(1)) {
                return term;
            }
            return TG.multiply(
                TG.literal(coefficient),
                term,
            );
        }).filter((operand): operand is Token => operand !== null);
        if (token.operands.length === 0) { return TG.literal(0); }
        if (token.operands.length === 1) { return token.operands[0]!; }
        return token;
    }
    if (token.operator === Operator.MULTIPLY) {
        let literalProduct = new Decimal(1);
        const factorMap: Record<string, { exponent: Decimal, term: Token }> = {};
        for (const operand of token.operands) {
            if (isLiteral(operand)) {
                literalProduct = literalProduct.times(operand.value);
            } else if (isVariable(operand)) {
                const key = tokenKey(operand);
                if (!factorMap[key]) {
                    factorMap[key] = { exponent: new Decimal(1), term: operand };
                } else {
                    factorMap[key].exponent = factorMap[key].exponent.plus(1);
                }
            } else if (isOperator(operand) && operand.operator === Operator.POWER) {
                const base = simplifyToken(operand.base);
                const exponent = simplifyToken(TG.multiply(...operand.exponents));
                if (isLiteral(exponent) && exponent.value.isZero()) {
                    continue;
                }

                const key = tokenKey(base);
                if (isLiteral(exponent)) {
                    if (!factorMap[key]) {
                        factorMap[key] = { exponent: new Decimal(exponent.value), term: base };
                    } else {
                        factorMap[key].exponent = factorMap[key].exponent.plus(exponent.value);
                    }
                } else {
                    if (!factorMap[key]) {
                        factorMap[key] = { exponent: new Decimal(1), term: TG.power(base, exponent) };
                    } else {
                        factorMap[key].exponent = factorMap[key].exponent.plus(1);
                    }
                }
            } else {
                const key = tokenKey(operand);
                if (!factorMap[key]) {
                    factorMap[key] = { exponent: new Decimal(1), term: operand };
                } else {
                    factorMap[key].exponent = factorMap[key].exponent.plus(1);
                }
            }
        }

        const factors = Object.values(factorMap).map(({ exponent, term }) => {
            if (exponent.isZero()) {
                return null;
            }
            if (exponent.eq(1)) {
                return term;
            }
            return TG.power(term, TG.literal(exponent));
        }).filter((factor): factor is Token => factor !== null);

        if (literalProduct.isZero()) {
            return TG.literal(0);
        }

        if (!literalProduct.eq(1)) {
            factors.unshift(TG.literal(literalProduct));
        }

        if (factors.length === 0) {
            return TG.literal(1);
        }
        if (factors.length === 1) {
            return factors[0]!;
        }
        return TG.multiply(...factors);
    }

    return token;
}