import type { NumericVector4 } from './cas';

/**
 * Minkowsi Metric Tensor eta_mu_nu (signature -+++)
 */
export const ETA = [
    [-1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
];

/**
 * Calculate the magnitude squared of a 4-vector V^mu using the Minkowski metric
 * V^2 = V^mu V_mu = eta_mu_nu V^mu V^nu = -(V^0)^2 + (V^1)^2 + (V^2)^2 + (V^3)^2
 */
export const magnitudeSquared = (V: NumericVector4): number => {
    return -Math.pow(V[0], 2) + Math.pow(V[1], 2) + Math.pow(V[2], 2) + Math.pow(V[3], 2);
};

/**
 * Calculate the invariant spacetime interval ds^2 between two events.
 */
export const calculateIntervalSquared = (event1: NumericVector4, event2: NumericVector4): number => {
    const deltaX: NumericVector4 = [
        event2[0] - event1[0],
        event2[1] - event1[1],
        event2[2] - event1[2],
        event2[3] - event1[3]
    ];
    return magnitudeSquared(deltaX);
};

/**
 * Calculate the spatial velocity vector component v = dx/dt from a 4-velocity U^mu
 * U^0 = dt/dtau = gamma
 * U^i = dx^i/dtau = gamma * v^i
 * Therefore v^i = U^i / U^0
 */
export const extract3Velocity = (U: NumericVector4): [number, number, number] => {
    if (Math.abs(U[0]) < 1e-10) return [0, 0, 0];
    return [
        U[1] / U[0],
        U[2] / U[0],
        U[3] / U[0]
    ];
};

/**
 * Validate physical causality of a 4-velocity vector.
 * 1. Checks U^mu U_mu ≈ -1 (timelike vector of magnitude -c^2 where c=1)
 * 2. Checks |v| < 1 (speed of light is 1)
 */
export const validateCausality = (U: NumericVector4): { isValid: boolean, reason?: string, U_squared: number, v_squared: number } => {
    const U_squared = magnitudeSquared(U);

    if (U[0] < 0) {
        return { isValid: false, reason: "U^0 must be positive (particle moving forward in time)", U_squared, v_squared: 0 };
    }

    // Due to floating point errors from CAS parsing, use a small epsilon
    const EPSILON = 1e-4;
    if (Math.abs(U_squared - (-1)) > EPSILON) {
        return { isValid: false, reason: `4-velocity invariant U^mu U_mu must equal -1, but got ${U_squared.toFixed(4)}`, U_squared, v_squared: 0 };
    }

    const v3 = extract3Velocity(U);
    const v_squared = Math.pow(v3[0], 2) + Math.pow(v3[1], 2) + Math.pow(v3[2], 2);

    if (v_squared >= 1) {
        return { isValid: false, reason: `Speed |v| must be strictly less than c (1), but got |v|^2 = ${v_squared.toFixed(4)}`, U_squared, v_squared };
    }

    return { isValid: true, U_squared, v_squared };
};

/**
 * Calculate Lorentz factor gamma from 3-velocity vector v.
 */
export const calculateGamma = (v3: [number, number, number]): number => {
    const v_squared = Math.pow(v3[0], 2) + Math.pow(v3[1], 2) + Math.pow(v3[2], 2);
    if (v_squared >= 1) return Infinity;
    return 1 / Math.sqrt(1 - v_squared);
};

/**
 * Calculate rapidity phi from 3-velocity vector v.
 */
export const calculateRapidity = (v3: [number, number, number]): number => {
    const v_squared = Math.pow(v3[0], 2) + Math.pow(v3[1], 2) + Math.pow(v3[2], 2);
    const v_mag = Math.sqrt(v_squared);
    return Math.atanh(v_mag); // Uses standard arctanh function
};

/**
 * Create a Lorentz boost matrix Lambda for a given 3-velocity vector v.
 * Used to transform from Lab frame to the rest frame moving at velocity v.
 * For an active reference frame with velocity vector v = (vx, vy, vz).
 */
export const getLorentzBoostMatrix = (v3: [number, number, number]): number[][] => {
    const v2 = Math.pow(v3[0], 2) + Math.pow(v3[1], 2) + Math.pow(v3[2], 2);

    if (v2 < 1e-10) {
        // Identity matrix for negligible velocity
        return [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ];
    }

    const gamma = calculateGamma(v3);
    const lambda = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ];

    // Lambda^0_0 = gamma
    lambda[0][0] = gamma;

    // Lambda^0_i = Lambda^i_0 = -gamma * v^i
    lambda[0][1] = -gamma * v3[0];
    lambda[1][0] = -gamma * v3[0];
    lambda[0][2] = -gamma * v3[1];
    lambda[2][0] = -gamma * v3[1];
    lambda[0][3] = -gamma * v3[2];
    lambda[3][0] = -gamma * v3[2];

    // Lambda^i_j = delta_ij + (gamma - 1) * v^i * v^j / v^2
    for (let i = 1; i <= 3; i++) {
        for (let j = 1; j <= 3; j++) {
            const delta = (i === j) ? 1 : 0;
            lambda[i][j] = delta + (gamma - 1) * (v3[i - 1] * v3[j - 1]) / v2;
        }
    }

    return lambda;
};

/**
 * Apply a Lorentz transformation matrix to a 4-vector
 */
export const applyLorentzTransformation = (Lambda: number[][], V: NumericVector4): NumericVector4 => {
    const result: NumericVector4 = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        let sum = 0;
        for (let j = 0; j < 4; j++) {
            sum += Lambda[i][j] * V[j];
        }
        result[i] = sum;
    }
    return result;
};

/**
 * Utility to transform a numeric coordinate array representing a worldline
 * coordinates structure: { t: number[], x: number[], y: number[], z: number[] }
 */
export const transformWorldlineCoordinates = (
    coords: { t: number[], x: number[], y: number[], z: number[] },
    Lambda: number[][],
    X_origin: NumericVector4 = [0, 0, 0, 0],
    tau: number = 0
): { t: number[], x: number[], y: number[], z: number[] } => {
    const transformed = { t: [] as number[], x: [] as number[], y: [] as number[], z: [] as number[] };

    const len = coords.t.length;
    for (let i = 0; i < len; i++) {
        const V: NumericVector4 = [
            coords.t[i] - X_origin[0],
            coords.x[i] - X_origin[1],
            coords.y[i] - X_origin[2],
            coords.z[i] - X_origin[3]
        ];
        const V_prime = applyLorentzTransformation(Lambda, V);
        transformed.t.push(V_prime[0] + tau);
        transformed.x.push(V_prime[1]);
        transformed.y.push(V_prime[2]);
        transformed.z.push(V_prime[3]);
    }

    return transformed;
};
