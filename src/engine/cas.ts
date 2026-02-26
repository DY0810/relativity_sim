import nerdamer from 'nerdamer';
import 'nerdamer/Calculus';
import { evaluate as mathEval } from 'mathjs';

export type Vector4 = [string, string, string, string];
export type NumericVector4 = [number, number, number, number];

/**
 * Physical and mathematical constants.
 * In natural units: c = 1, but we keep it so users can write c explicitly.
 */
export const CONSTANTS: Record<string, string> = {
    // Speed of light (natural units)
    c: '1',
    // Gravitational acceleration (m/s² in SI, but here as natural unit approximation)
    g: '9.80665',
    // Reduced Planck constant (natural units)
    hbar: '1',
    // Boltzmann constant (natural units)
    kb: '1',
    // Golden ratio
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
        // e.g. "cosh" should not have "c" replaced
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
    initialVelocity: NumericVector4; // Valid when acceleration is provided
    // One of these inputs must be provided by user mathematically:
    inputPosition?: Vector4;
    inputVelocity?: Vector4;
    inputAcceleration?: Vector4;

    // Derived symbolic expressions mapped to proper time tau
    positionExpr: Vector4;
    velocityExpr: Vector4;
    accelerationExpr: Vector4;
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

    // The result with constant will be: integrated_expr - integrated_value_at_0 + constant
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
        const tauStr = tau.toString();
        const res = [
            Number(mathEval(nerdamer(substituteConstants(V[0]), { tau: tauStr }).text())),
            Number(mathEval(nerdamer(substituteConstants(V[1]), { tau: tauStr }).text())),
            Number(mathEval(nerdamer(substituteConstants(V[2]), { tau: tauStr }).text())),
            Number(mathEval(nerdamer(substituteConstants(V[3]), { tau: tauStr }).text()))
        ] as NumericVector4;
        if (res.some(Number.isNaN)) return [0, 0, 0, 0];
        return res;
    } catch (e) {
        console.warn("Failed to evaluate vector at tau", V, tau, e);
        return [0, 0, 0, 0];
    }
};

export const findTauForLabTime = (positionExpr: Vector4, target_t: number): number => {
    let low = -1000;
    let high = 1000;

    // Binary search since t(tau) is strictly monotonically increasing (dt/dtau = gamma >= 1)
    for (let iter = 0; iter < 100; iter++) {
        const mid = (low + high) / 2;
        const t_mid = evaluateVectorAtTau(positionExpr, mid)[0];
        if (Number.isNaN(t_mid)) return 0; // Fallback to avoid propagating NaN
        if (Math.abs(t_mid - target_t) < 1e-4) return mid;
        if (t_mid < target_t) low = mid;
        else high = mid;
    }
    const result_tau = (low + high) / 2;
    const t_final = evaluateVectorAtTau(positionExpr, result_tau)[0];
    // If the binary search failed to converge to the target global time (e.g., non-monotonic causality violating trajectory), 
    // clamp it to REST frame origin to prevent the active graph view passing ±500k scale and disappearing.
    if (Math.abs(t_final - target_t) > 100) return 0;
    return result_tau;
};

/**
 * Sweeps over a range of tau to aggressively check if the particle 
 * violates causality (Faster-Than-Light limit |v| > c).
 */
export const checkCausalityViolation = (velocityExpr: Vector4): boolean => {
    for (let tau = -50; tau <= 50; tau += 1) {
        const U = evaluateVectorAtTau(velocityExpr, tau);
        if (Math.abs(U[0]) < 1e-6) {
            // zero time component but non-zero spatial is infinite velocity (FTL)
            if (Math.abs(U[1]) > 1e-6 || Math.abs(U[2]) > 1e-6 || Math.abs(U[3]) > 1e-6) return true;
            continue;
        }
        const v2 = (U[1] * U[1] + U[2] * U[2] + U[3] * U[3]) / (U[0] * U[0]);
        // Fast test allowance for precision boundary conditions
        if (v2 > 1.05 || isNaN(v2)) return true;
    }
    return false;
};
