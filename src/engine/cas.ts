import nerdamer from 'nerdamer';
import 'nerdamer/Calculus';
import { compile } from 'mathjs';

export type Vector4 = [string, string, string, string];
export type NumericVector4 = [number, number, number, number];

// Global cache for compiled expressions to massively improve evaluation performance in rendering loops
const expressionCache = new Map<string, any>();

export const getCompiledExpression = (expr: string) => {
    if (!expr || expr.trim() === '') return { evaluate: () => 0 };
    if (!expressionCache.has(expr)) {
        try {
            // Only substitute constants (lightweight string replace), then compile directly with mathjs
            expressionCache.set(expr, compile(substituteConstants(expr)));
        } catch (e) {
            console.warn("Failed to compile expression:", expr, e);
            expressionCache.set(expr, { evaluate: () => 0 });
        }
    }
    return expressionCache.get(expr);
};

/**
 * Physical and mathematical constants.
 * In natural units: c = 1, but we keep it so users can write c explicitly.
 */
export const CONSTANTS: Record<string, string> = {
    c: '1',
    g: '9.80665',
    hbar: '1',
    kb: '1',
    phi: '1.6180339887',
};

/**
 * Substitute known constants into an expression string before passing to nerdamer.
 * Wraps each constant in parentheses to preserve operator precedence.
 */
const substituteConstants = (expr: string): string => {
    let result = expr;
    // Sort by length descending so 'hbar' is replaced before 'h'
    const sorted = Object.entries(CONSTANTS).sort((a, b) => b[0].length - a[0].length);
    for (const [name, value] of sorted) {
        // Use word boundary regex to avoid replacing inside function names
        const regex = new RegExp(`\\b${name}\\b`, 'g');
        result = result.replace(regex, `(${value})`);
    }
    return result;
};

export interface ParticleState {
    id: string;
    name: string;
    color: string;
    mass: number;
    initialPosition: NumericVector4;
    initialVelocity: NumericVector4;
    inputPosition?: Vector4;
    inputVelocity?: Vector4;
    inputAcceleration?: Vector4;
    positionExpr: Vector4;
    velocityExpr: Vector4;
    accelerationExpr: Vector4;
    showClock?: boolean;
}

/**
 * Validates if an expected symbolic variable exists without triggering nerdamer errors.
 */
export const validateExpression = (expr: string): boolean => {
    try {
        nerdamer(substituteConstants(expr));
        return true;
    } catch (e) {
        return false;
    }
};

/**
 * Symbolically differentiate an expression with respect to variable tau
 */
export const deriveSymbolic = (expr: string, variable: string = 'tau'): string => {
    if (!expr || expr.trim() === '' || expr.trim() === '0') return '0';
    return nerdamer(`diff(${expr}, ${variable})`).text();
};

/**
 * Symbolically integrate an expression with respect to variable tau,
 * then add the required constant of integration C.
 */
export const integrateSymbolic = (expr: string, constant: number, variable: string = 'tau'): string => {
    if (!expr || expr.trim() === '' || expr.trim() === '0') return constant.toString();
    const integrated = nerdamer(`integrate(${expr}, ${variable})`).text();
    // Evaluate the integrated expression at tau = 0 to find the offset
    const evaluatedAtZero = nerdamer(integrated, { tau: '0' }).text();
    const adjustedExpr = nerdamer(`${integrated} - (${evaluatedAtZero}) + (${constant})`).text();
    return adjustedExpr;
};

/**
 * Take 4-position strings and calculate derivation.
 */
export const solveFromPosition = (X: Vector4): { X: Vector4, U: Vector4, A: Vector4 } => {
    const U: Vector4 = [
        deriveSymbolic(X[0]),
        deriveSymbolic(X[1]),
        deriveSymbolic(X[2]),
        deriveSymbolic(X[3])
    ];
    const A: Vector4 = [
        deriveSymbolic(U[0]),
        deriveSymbolic(U[1]),
        deriveSymbolic(U[2]),
        deriveSymbolic(U[3])
    ];
    return { X, U, A };
};

/**
 * Take 4-velocity strings and an initial position, calculate integration & derivation.
 */
export const solveFromVelocity = (U: Vector4, X0: NumericVector4): { X: Vector4, U: Vector4, A: Vector4 } => {
    const X: Vector4 = [
        integrateSymbolic(U[0], X0[0]),
        integrateSymbolic(U[1], X0[1]),
        integrateSymbolic(U[2], X0[2]),
        integrateSymbolic(U[3], X0[3])
    ];
    const A: Vector4 = [
        deriveSymbolic(U[0]),
        deriveSymbolic(U[1]),
        deriveSymbolic(U[2]),
        deriveSymbolic(U[3])
    ];
    return { X, U, A };
};

/**
 * Take 4-acceleration strings, initial velocity and initial position, calculate integration.
 */
export const solveFromAcceleration = (A: Vector4, U0: NumericVector4, X0: NumericVector4): { X: Vector4, U: Vector4, A: Vector4 } => {
    const U: Vector4 = [
        integrateSymbolic(A[0], U0[0]),
        integrateSymbolic(A[1], U0[1]),
        integrateSymbolic(A[2], U0[2]),
        integrateSymbolic(A[3], U0[3])
    ];
    const X: Vector4 = [
        integrateSymbolic(U[0], X0[0]),
        integrateSymbolic(U[1], X0[1]),
        integrateSymbolic(U[2], X0[2]),
        integrateSymbolic(U[3], X0[3])
    ];
    return { X, U, A };
};

/**
 * Evaluate a vector expression at a given tau value
 */
export const evaluateVectorAtTau = (V: Vector4, tau: number): NumericVector4 => {
    try {
        const scope = { tau };
        const res = [
            Number(getCompiledExpression(V[0]).evaluate(scope)),
            Number(getCompiledExpression(V[1]).evaluate(scope)),
            Number(getCompiledExpression(V[2]).evaluate(scope)),
            Number(getCompiledExpression(V[3]).evaluate(scope))
        ] as NumericVector4;
        if (res.some(Number.isNaN)) return [0, 0, 0, 0];
        return res;
    } catch (e) {
        console.warn("Failed to evaluate vector at tau", V, tau, e);
        return [0, 0, 0, 0];
    }
};

export const findTauForLabTime = (positionExpr: Vector4, target_t: number, searchRange: number = 200): number => {
    let low = -searchRange;
    let high = searchRange;

    // Pre-compile the time component once for the entire search
    const compT = getCompiledExpression(positionExpr[0]);

    // First check boundaries to ensure we're searching the right domain
    const t_low = Number(compT.evaluate({ tau: low }));
    const t_high = Number(compT.evaluate({ tau: high }));

    if (!Number.isNaN(t_low) && !Number.isNaN(t_high)) {
        if (target_t < t_low) return low;
        if (target_t > t_high) return high;
    }

    let closest_tau = 0;
    let min_diff = Infinity;

    // Binary search since t(tau) is strictly monotonically increasing (dt/dtau = gamma >= 1)
    for (let iter = 0; iter < 50; iter++) {
        const mid = (low + high) / 2;
        const t_mid = Number(compT.evaluate({ tau: mid }));

        if (Number.isNaN(t_mid)) {
            if (Math.abs(low) > Math.abs(high)) low = mid;
            else high = mid;
            continue;
        }

        const diff = Math.abs(t_mid - target_t);
        if (diff < min_diff) {
            min_diff = diff;
            closest_tau = mid;
        }

        if (diff < 1e-4) return mid;

        if (t_mid < target_t) low = mid;
        else high = mid;
    }

    return closest_tau;
};

/**
 * Sweeps over a range of tau to aggressively check if the particle 
 * violates causality (Faster-Than-Light limit |v| > c).
 * Results are memoized on the velocity expression key.
 */
const causalityCache = new Map<string, boolean>();

export const checkCausalityViolation = (velocityExpr: Vector4): boolean => {
    const key = velocityExpr.join('|');
    if (causalityCache.has(key)) return causalityCache.get(key)!;

    let result = false;
    for (let tau = -50; tau <= 50; tau += 1) {
        const U = evaluateVectorAtTau(velocityExpr, tau);
        if (Math.abs(U[0]) < 1e-6) {
            if (Math.abs(U[1]) > 1e-6 || Math.abs(U[2]) > 1e-6 || Math.abs(U[3]) > 1e-6) { result = true; break; }
            continue;
        }
        const v2 = (U[1] * U[1] + U[2] * U[2] + U[3] * U[3]) / (U[0] * U[0]);
        if (v2 > 1.05 || isNaN(v2)) { result = true; break; }
    }

    causalityCache.set(key, result);
    return result;
};

/** Clear the causality cache (call when expressions change) */
export const clearCausalityCache = () => causalityCache.clear();
