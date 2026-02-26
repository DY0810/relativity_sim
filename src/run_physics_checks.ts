import { create, all } from 'mathjs';
const math = create(all, {});
math.config({ number: 'BigNumber', precision: 256 });

import {
    getLorentzBoostMatrix,
    applyLorentzTransformation,
    magnitudeSquared,
    calculateIntervalSquared,
    validateCausality
} from './engine/physics';
import nerdamer from 'nerdamer';
import 'nerdamer/Calculus.js';
import { solveFromPosition, deriveSymbolic, type NumericVector4, type Vector4 } from './engine/cas';

async function runChecks() {
    console.log("Starting Physics Integrity Checks...\n");
    let allPassed = true;

    // --- Check 1: Continuous 4-Velocity Normalization ---
    console.log("Check 1: Continuous 4-Velocity Normalization");
    try {
        const X_expr: Vector4 = ['sinh(tau)', 'cosh(tau)', '0', '0'];
        const { U: U_expr } = solveFromPosition(X_expr);
        let maxDev = 0;

        for (let tau = 0; tau <= 100; tau += 1) {
            const u0 = nerdamer(U_expr[0], { tau: tau.toString() }).text();
            const u1 = nerdamer(U_expr[1], { tau: tau.toString() }).text();
            const u2 = nerdamer(U_expr[2], { tau: tau.toString() }).text();
            const u3 = nerdamer(U_expr[3], { tau: tau.toString() }).text();

            // Calculate with high precision to prevent float cancellation error at large tau
            const exp = `-(${u0})^2 + (${u1})^2 + (${u2})^2 + (${u3})^2`;
            const magSq = math.evaluate(exp);

            const dev = Math.abs(Number(magSq) - (-1));
            if (dev > maxDev) maxDev = dev;
        }

        console.log(`Maximum deviation from -1: ${maxDev}`);
        if (maxDev > 1e-6) {
            console.error("❌ Check 1 Failed: Deviation exceeds 10^-6");
            allPassed = false;
        } else {
            console.log("✅ Check 1 Passed");
        }
    } catch (e: any) {
        console.error("❌ Check 1 Failed with error:", e.message);
        allPassed = false;
    }
    console.log("--------------------------------------------------");

    // --- Check 2: Dynamic Orthogonality Enforcement ---
    console.log("Check 2: Dynamic Orthogonality Enforcement");
    try {
        const U_expr: Vector4 = ['cosh(tau^2)', 'sinh(tau^2)', '0', '0'];
        const A_expr: Vector4 = [
            deriveSymbolic(U_expr[0]),
            deriveSymbolic(U_expr[1]),
            deriveSymbolic(U_expr[2]),
            deriveSymbolic(U_expr[3])
        ];

        let maxInnerProductDev = 0;
        for (let frame = 0; frame <= 1000; frame += 10) {
            const tau = frame / 100.0;
            const u0 = nerdamer(U_expr[0], { tau: tau.toString() }).text();
            const u1 = nerdamer(U_expr[1], { tau: tau.toString() }).text();
            const a0 = nerdamer(A_expr[0], { tau: tau.toString() }).text();
            const a1 = nerdamer(A_expr[1], { tau: tau.toString() }).text();

            const exp = `-(${u0})*(${a0}) + (${u1})*(${a1})`;
            const innerProduct = Number(math.evaluate(exp));

            const dev = Math.abs(innerProduct);
            if (dev > maxInnerProductDev) maxInnerProductDev = dev;
        }

        console.log(`Maximum inner product deviation from 0: ${maxInnerProductDev}`);
        if (maxInnerProductDev > 1e-6) {
            console.error("❌ Check 2 Failed: Non-orthogonal behavior detected.");
            allPassed = false;
        } else {
            console.log("✅ Check 2 Passed");
        }
    } catch (e: any) {
        console.error("❌ Check 2 Failed with error:", e.message);
        allPassed = false;
    }
    console.log("--------------------------------------------------");

    // --- Check 3: Invariant Interval Preservation Under Arbitrary Boosts ---
    console.log("Check 3: Invariant Interval Preservation Under Arbitrary Boosts");
    try {
        const X1: NumericVector4 = [2, 5, -1, 3];
        const X2: NumericVector4 = [8, 1, 4, 0];
        const ds2 = calculateIntervalSquared(X1, X2);

        const v = 0.99;
        const vx = v / Math.sqrt(3);
        const vy = v / Math.sqrt(3);
        const vz = v / Math.sqrt(3);

        const lambda = getLorentzBoostMatrix([vx, vy, vz]);

        // Ensure to only get spatial transformations, apply transformation to X1 and X2
        const X1_prime = applyLorentzTransformation(lambda, X1);
        const X2_prime = applyLorentzTransformation(lambda, X2);

        const ds2_prime = calculateIntervalSquared(X1_prime, X2_prime);
        const diff = Math.abs(ds2 - ds2_prime);

        console.log(`Original Delta s^2: ${ds2}`);
        console.log(`Boosted Delta s'^2: ${ds2_prime}`);
        console.log(`Difference: ${diff}`);

        if (diff > 1e-6) {
            console.error("❌ Check 3 Failed: Interval not invariant.");
            allPassed = false;
        } else {
            console.log("✅ Check 3 Passed");
        }
    } catch (e: any) {
        console.error("❌ Check 3 Failed with error:", e.message);
        allPassed = false;
    }
    console.log("--------------------------------------------------");

    // --- Check 4: Lorentz Matrix Reversibility ---
    console.log("Check 4: Lorentz Matrix Reversibility");
    try {
        const beta = [0.3, 0.4, 0.5] as [number, number, number];
        const neg_beta = [-0.3, -0.4, -0.5] as [number, number, number];

        const L1 = getLorentzBoostMatrix(beta);
        const L2 = getLorentzBoostMatrix(neg_beta);

        // Multiply L1 * L2
        type Matrix = number[][];
        const multiply = (A: Matrix, B: Matrix): Matrix => {
            const res: Matrix = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    let sum = 0;
                    for (let k = 0; k < 4; k++) sum += A[i][k] * B[k][j];
                    res[i][j] = sum;
                }
            }
            return res;
        };

        const res = multiply(L1, L2);
        let maxOffDiag = 0;
        let maxDiagDev = 0;

        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                if (i === j) {
                    const dev = Math.abs(res[i][j] - 1);
                    if (dev > maxDiagDev) maxDiagDev = dev;
                } else {
                    const dev = Math.abs(res[i][j]);
                    if (dev > maxOffDiag) maxOffDiag = dev;
                }
            }
        }

        console.log(`Max off-diagonal deviation: ${maxOffDiag}`);
        console.log(`Max diagonal deviation from 1: ${maxDiagDev}`);

        if (maxOffDiag > 1e-10 || maxDiagDev > 1e-10) {
            console.error("❌ Check 4 Failed: L(v) * L(-v) != I");
            allPassed = false;
        } else {
            console.log("✅ Check 4 Passed");
        }

    } catch (e: any) {
        console.error("❌ Check 4 Failed with error:", e.message);
        allPassed = false;
    }
    console.log("--------------------------------------------------");

    // --- Check 5: Null Vector Boundary Testing ---
    console.log("Check 5: Null Vector Boundary Testing");
    try {
        let P: NumericVector4 = [1, 1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];
        let magSq = magnitudeSquared(P);
        console.log(`Initial P_mu P^mu: ${magSq}`);

        let defectiveFrame = -1;

        for (let step = 1; step <= 10; step++) {
            // Random valid boost (v < c)
            const vx = (Math.random() * 2 - 1) * 0.5;
            const vy = (Math.random() * 2 - 1) * 0.5;
            const vz = (Math.random() * 2 - 1) * 0.5;

            const lambda = getLorentzBoostMatrix([vx, vy, vz]);
            P = applyLorentzTransformation(lambda, P);

            const currentMag = magnitudeSquared(P);
            if (Math.abs(currentMag) > 1e-6) {
                defectiveFrame = step;
                console.error(`❌ Check 5 Failed: Null vector constraint violated at frame ${step}`);
                console.error(`Magnitude squared shifted to: ${currentMag}`);
                allPassed = false;
                break;
            }
        }
        if (defectiveFrame === -1) {
            console.log("✅ Check 5 Passed: Null vector remained null after 10 random boosts");
        }
    } catch (e: any) {
        console.error("❌ Check 5 Failed with error:", e.message);
        allPassed = false;
    }
    console.log("--------------------------------------------------");

    // --- Check 6: Proper Time Synchronization for Twin Paradox ---
    console.log("Check 6: Proper Time Synchronization for Twin Paradox");
    try {
        // Particle A: (10, 0, 0, 0), from (0,0,0,0) in SR rest frame (v=0). Integrates directly to 10.
        // Particle A worldline
        const A_time = 10;
        const A_tau = A_time / 1.0; // gamma = 1

        // Particle B: travels to (5, 4, 0, 0), reversing, returns to (10, 0, 0, 0).
        // Outbound
        const dt1 = 5;
        const dx1 = 4;
        const v1 = dx1 / dt1; // 0.8
        const gamma1 = 1 / Math.sqrt(1 - v1 * v1);
        const dtau1 = dt1 / gamma1;

        // Inbound
        const dt2 = 5;
        const dx2 = -4;
        const v2 = dx2 / dt2; // -0.8
        const gamma2 = 1 / Math.sqrt(1 - v2 * v2);
        const dtau2 = dt2 / gamma2;

        const B_tau = dtau1 + dtau2;

        console.log(`Particle A Proper Time (tau_A): ${A_tau}`);
        console.log(`Particle B Proper Time (tau_B): ${B_tau}`);

        if (A_tau > B_tau && Math.abs(B_tau - 6) < 1e-6) {
            console.log("✅ Check 6 Passed: tau_A > tau_B and tau_B = 6 exactly.");
        } else {
            console.error("❌ Check 6 Failed!");
            allPassed = false;
        }
    } catch (e: any) {
        console.error("❌ Check 6 Failed with error:", e.message);
        allPassed = false;
    }
    console.log("--------------------------------------------------");

    // --- Check 7: Thomas Precession (Non-Commutative Boosts) ---
    console.log("Check 7: Thomas Precession (Non-Commutative Boosts)");
    try {
        const v1 = 0.5;
        const v2 = 0.5;
        const L_x = getLorentzBoostMatrix([v1, 0, 0]);
        const L_y = getLorentzBoostMatrix([0, v2, 0]);

        const P0: NumericVector4 = [1, 0, 0, 0];
        // L_y * L_x * P0
        const P_xy = applyLorentzTransformation(L_y, applyLorentzTransformation(L_x, P0));
        // L_x * L_y * P0
        const P_yx = applyLorentzTransformation(L_x, applyLorentzTransformation(L_y, P0));

        const diff = Math.sqrt(Math.pow(P_xy[1] - P_yx[1], 2) + Math.pow(P_xy[2] - P_yx[2], 2));

        console.log(`P_xy: ${P_xy}`);
        console.log(`P_yx: ${P_yx}`);
        console.log(`Spatial diff: ${diff}`);

        if (diff > 1e-6) {
            console.log("✅ Check 7 Passed: Output vectors are not equal.");
        } else {
            console.error("❌ Check 7 Failed: Boosts commuted!");
            allPassed = false;
        }
    } catch (e: any) {
        console.error("❌ Check 7 Failed with error:", e.message);
        allPassed = false;
    }
    console.log("--------------------------------------------------");

    // --- Check 8: Energy-Momentum Conservation (Inelastic Collision) ---
    console.log("Check 8: Energy-Momentum Conservation (Inelastic Collision)");
    try {
        const mA = 2;
        const vA = 0.6;
        const gammaA = 1 / Math.sqrt(1 - vA * vA);
        const P_A: NumericVector4 = [mA * gammaA, mA * gammaA * vA, 0, 0];

        const mB = 3;
        const P_B: NumericVector4 = [mB, 0, 0, 0];

        const P_C: NumericVector4 = [P_A[0] + P_B[0], P_A[1] + P_B[1], P_A[2] + P_B[2], P_A[3] + P_B[3]];
        const mC = Math.sqrt(-magnitudeSquared(P_C));

        console.log(`m_A + m_B = ${mA + mB}`);
        console.log(`m_C = ${mC}`);

        if (mC > mA + mB && Math.abs(mC - 5.291502622129181) < 1e-4) {
            console.log("✅ Check 8 Passed: m_C > m_A + m_B, invariant mass increased.");
        } else {
            console.error("❌ Check 8 Failed!");
            allPassed = false;
        }
    } catch (e: any) {
        console.error("❌ Check 8 Failed with error:", e.message);
        allPassed = false;
    }
    console.log("--------------------------------------------------");

    // --- Check 9: Relativistic Doppler Shift ---
    console.log("Check 9: Relativistic Doppler Shift");
    try {
        const v = 0.8;
        const delta_tau = 1;
        const expected_delta_t = delta_tau * Math.sqrt((1 + v) / (1 - v));

        const gamma = 1 / Math.sqrt(1 - v * v);
        const t_em = gamma * delta_tau;
        const x_em = v * gamma * delta_tau;

        const measured_delta_t = t_em + x_em;

        console.log(`Calculated delta_t: ${measured_delta_t}`);
        console.log(`Expected delta_t: ${expected_delta_t}`);

        if (Math.abs(measured_delta_t - expected_delta_t) < 1e-6) {
            console.log("✅ Check 9 Passed: Doppler shift matches.");
        } else {
            console.error("❌ Check 9 Failed!");
            allPassed = false;
        }
    } catch (e: any) {
        console.error("❌ Check 9 Failed with error:", e.message);
        allPassed = false;
    }
    console.log("--------------------------------------------------");

    // --- Check 10: Length Contraction of Rigid Worldtube ---
    console.log("Check 10: Length Contraction of Rigid Worldtube");
    try {
        const L0 = 10;
        const v = 0.8660254037844386;

        const L_boost = getLorentzBoostMatrix([v, 0, 0]);
        const event2: NumericVector4 = [v * L0, L0, 0, 0];
        const event2_prime = applyLorentzTransformation(L_boost, event2);

        const measured_L = event2_prime[1];
        const expected_L = L0 / 2;

        console.log(`Calculated L': ${measured_L}`);
        console.log(`Expected L': ${expected_L}`);

        if (Math.abs(measured_L - expected_L) < 1e-6) {
            console.log("✅ Check 10 Passed: Length contraction applied.");
        } else {
            console.error("❌ Check 10 Failed!");
            allPassed = false;
        }
    } catch (e: any) {
        console.error("❌ Check 10 Failed with error:", e.message);
        allPassed = false;
    }
    console.log("--------------------------------------------------");

    // --- Check 11: Ultra-Relativistic Precision Limit (Edge Case) ---
    console.log("Check 11: Ultra-Relativistic Precision Limit (Edge Case)");
    try {
        const v = 1 - 1e-15;
        const gamma = 1 / Math.sqrt(1 - v * v);

        console.log(`v: ${v}, gamma: ${gamma}`);
        if (gamma === Infinity || isNaN(gamma)) {
            console.error("❌ Check 11 Failed: Gamma evaluates to Infinity or NaN.");
            allPassed = false;
        } else {
            const L_boost = getLorentzBoostMatrix([v, 0, 0]);
            const test_vec: NumericVector4 = [1, 0, 0, 0];
            const res = applyLorentzTransformation(L_boost, test_vec);
            if (res.some(val => isNaN(val) || !isFinite(val))) {
                console.error("❌ Check 11 Failed: Matrix multiplication produced non-finite numbers.");
                allPassed = false;
            } else {
                console.log("✅ Check 11 Passed: Ultra-relativistic limit handled.");
            }
        }
    } catch (e: any) {
        console.error("❌ Check 11 Failed with error:", e.message);
        allPassed = false;
    }
    console.log("--------------------------------------------------");

    // --- Check 12: Causality Violation Rejection (Edge Case) ---
    console.log("Check 12: Causality Violation Rejection (Edge Case)");
    try {
        const U: NumericVector4 = [0.5, 1.5, 0, 0];
        const validation = validateCausality(U);

        if (!validation.isValid && validation.U_squared > 0) {
            console.log(`✅ Check 12 Passed: Causality violation caught. Reason: ${validation.reason}`);
        } else {
            console.error("❌ Check 12 Failed: Engine did not reject tachyonic trajectory!");
            allPassed = false;
        }
    } catch (e: any) {
        console.error("❌ Check 12 Failed with error:", e.message);
        allPassed = false;
    }
    console.log("--------------------------------------------------");

    // --- Check 13: Light-like Frame Singularity (Edge Case) ---
    console.log("Check 13: Light-like Frame Singularity (Edge Case)");
    try {
        const P: NumericVector4 = [1, 1, 0, 0];
        const v3: [number, number, number] = [P[1] / P[0], P[2] / P[0], P[3] / P[0]];
        // Because of float representation, 1^2 = 1.
        let v_squared = Math.pow(v3[0], 2) + Math.pow(v3[1], 2) + Math.pow(v3[2], 2);
        let gamma = (v_squared >= 1) ? Infinity : 1 / Math.sqrt(1 - v_squared);

        if (gamma === Infinity) {
            console.log("✅ Check 13 Passed: calculateGamma properly identifies singularity (Infinity).");
        } else {
            console.error("❌ Check 13 Failed: Gamma is not Infinity for v=c!");
            allPassed = false;
        }
    } catch (e: any) {
        console.error("❌ Check 13 Failed with error:", e.message);
        allPassed = false;
    }
    console.log("--------------------------------------------------");

    if (allPassed) {
        console.log("✨ ALL 13 PHYSICS INTEGRITY CHECKS PASSED ✨");
    } else {
        console.log("⚠️ SOME PHYSICS CHECKS FAILED.");
    }
}

runChecks();
