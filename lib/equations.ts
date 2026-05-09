import Decimal from "decimal.js";

enum TokenType {
    LITERAL = 'literal',
    VARIABLE = 'variable',
    OPERATOR = 'operator',
}

enum Operator {
    ADD = 'add',
    SUBTRACT = 'subtract',
    MULTIPLY = 'multiply',
    DIVIDE = 'divide',
    POWER = 'power',
    NEGATE = 'negate',
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
    operator: Operator.SUBTRACT | Operator.DIVIDE,
    left: Token,
    right: Token,
} | {
    operator: Operator.NEGATE | Operator.SINE | Operator.COSINE | Operator.TANGENT | Operator.ARCSINE | Operator.ARCCOSINE | Operator.ARCTANGENT,
    operand: Token,
});

type Token = LiteralToken | VariableToken | OperatorToken;

type Equation = { //! always = 0
    id: string,
    expression: Token,
}

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
    public static subtract(left: Token, right: Token): Token & { type: TokenType.OPERATOR, operator: Operator.SUBTRACT } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.SUBTRACT,
            left,
            right,
        };
    }
    public static multiply(...operands: Token[]): Token & { type: TokenType.OPERATOR, operator: Operator.MULTIPLY } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.MULTIPLY,
            operands,
        };
    }
    public static divide(left: Token, right: Token): Token & { type: TokenType.OPERATOR, operator: Operator.DIVIDE } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.DIVIDE,
            left,
            right,
        };
    }
    public static power(base: Token, ...exponents: Token[]): Token & { type: TokenType.OPERATOR, operator: Operator.POWER } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.POWER,
            base,
            exponents,
        };
    }
    public static negate(operand: Token): Token & { type: TokenType.OPERATOR, operator: Operator.NEGATE } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.NEGATE,
            operand,
        };
    }
    public static sine(operand: Token): Token & { type: TokenType.OPERATOR, operator: Operator.SINE } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.SINE,
            operand,
        };
    }
    public static cosine(operand: Token): Token & { type: TokenType.OPERATOR, operator: Operator.COSINE } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.COSINE,
            operand,
        };
    }
    public static tangent(operand: Token): Token & { type: TokenType.OPERATOR, operator: Operator.TANGENT } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.TANGENT,
            operand,
        };
    }
    public static arcsine(operand: Token): Token & { type: TokenType.OPERATOR, operator: Operator.ARCSINE } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.ARCSINE,
            operand,
        };
    }
    public static arccosine(operand: Token): Token & { type: TokenType.OPERATOR, operator: Operator.ARCCOSINE } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.ARCCOSINE,
            operand,
        };
    }
    public static arctangent(operand: Token): Token & { type: TokenType.OPERATOR, operator: Operator.ARCTANGENT } {
        return {
            type: TokenType.OPERATOR,
            operator: Operator.ARCTANGENT,
            operand,
        };
    }
}

function solveSystemOfEquations(equations: Equation[]): Record<string, Decimal> {
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
        if (token.operator === Operator.NEGATE || token.operator === Operator.SINE || token.operator === Operator.COSINE || token.operator === Operator.TANGENT || token.operator === Operator.ARCSINE || token.operator === Operator.ARCCOSINE || token.operator === Operator.ARCTANGENT) {
            variableIDs.push(...enumerateVariables(token.operand));
        }
        if (token.operator === Operator.SUBTRACT || token.operator === Operator.DIVIDE) {
            variableIDs.push(...enumerateVariables(token.left));
            variableIDs.push(...enumerateVariables(token.right));
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
            case Operator.SUBTRACT:
            case Operator.DIVIDE:
                // @ts-ignore
                return deepEquals(token1.left, token2.left) && deepEquals(token1.right, token2.right);
            case Operator.NEGATE:
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
                case Operator.SUBTRACT:
                case Operator.DIVIDE:
                    return `${token.operator}:${tokenKey(token.left)}:${tokenKey(token.right)}`;
                case Operator.NEGATE:
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
    if (isLiteral(token) || isVariable(token)) { return token; }
    let t = token;

    // ! collapse high level operators
    // a - b => a + b * -1
    // a / b => a * b ^ -1
    // -a => a * -1
    if (t.operator === Operator.SUBTRACT) {
        t = TG.add(
            simplifyToken(t.left),
            TG.multiply(
                simplifyToken(t.right),
                TG.literal(-1),
            ),
        );
    }
    if (t.operator === Operator.DIVIDE) {
        t = TG.multiply(
            simplifyToken(t.left),
            TG.power(
                simplifyToken(t.right),
                TG.literal(-1)
            )
        );
    }
    if (t.operator === Operator.NEGATE) {
        t = TG.multiply(
            simplifyToken(t.operand),
            TG.literal(-1),
        );
    }

    // ! literal evaluation
    // 2 + 3 + 4 + x => 9 + x
    // 2 * 3 * 4 * x => 24 * x
    // 2 ^ 3 ^ 4 ^ x => 64 ^ x
    // x ^ 2 ^ 3 ^ 4 => x ^ 64
    if (t.operator === Operator.ADD) {
        t.operands = t.operands.map(simplifyToken);
        const literals = t.operands.filter(operand => isLiteral(operand));
        const nonLiterals = t.operands.filter(operand => !isLiteral(operand));
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
    if (t.operator === Operator.MULTIPLY) {
        t.operands = t.operands.map(simplifyToken);
        const literals = t.operands.filter(operand => isLiteral(operand));
        const nonLiterals = t.operands.filter(operand => !isLiteral(operand));
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
    if (t.operator === Operator.POWER) {
        t.base = simplifyToken(t.base);
        t.exponents = t.exponents.map(simplifyToken);
        const exponent = simplifyToken(TG.multiply(...t.exponents));

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
            if (nonLiteralExponents.length === 0) { return t.base; }
            if (nonLiteralExponents.length > 0) { return TG.power(t.base, ...nonLiteralExponents); }
        }
        if (literalExponent.value.eq(1)) {
            const literalValue = literalExponent.value;
            if (literalValue.isZero()) { return TG.literal(1); }
            if (literalValue.eq(1)) {
                if (nonLiteralExponents.length === 0) { return t.base; }
                return TG.power(t.base, ...nonLiteralExponents);
            }
        }
        if (isLiteral(t.base)) {
            const baseValue = t.base.value;
            if (baseValue.isZero()) {
                if (literalExponent.value.isPositive()) { return TG.literal(0); }
                if (literalExponent.value.isNegative()) { throw new Error("Zero cannot be raised to a negative power."); }
            }
            if (baseValue.eq(1)) { return TG.literal(1); }
            return TG.literal(baseValue.pow(literalExponent.value));
        }
        if (nonLiteralExponents.length === 0) { return TG.power(t.base, literalExponent); }
        return TG.power(
            t.base,
            literalExponent,
            ...nonLiteralExponents,
        );
    }

    // ! combine like terms
    // x + x + x => 3 * x
    // x * x * x => x ^ 3
    // a * b + a * c => a * (b + c)
    // a ^ b * a ^ c => a ^ (b + c)

    return t;
}

/* -------------------------------------------------------------------------- */

solveSystemOfEquations([
    {
        id: "eq1",
        expression: TG.subtract(
            TG.add(TG.variable("x"), TG.literal(2)),
            TG.literal(5)
        )
    },
    {
        id: "eq2",
        expression: TG.subtract(
            TG.multiply(TG.variable("x"), TG.variable("y")),
            TG.literal(6)
        )
    }
]);