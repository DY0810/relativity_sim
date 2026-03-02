import { solveFromPosition, findTauForLabTime, evaluateVectorAtTau } from './src/engine/cas';
import { getLorentzBoostMatrix, transformWorldlineCoordinates, extract3Velocity } from './src/engine/physics';

const expr2 = 'sqrt(1 + (sinh(tau))^2)';
const V = solveFromPosition(['sinh(tau)', expr2, '0', '0']);

const tauRange = 5;
const STEPS = 50;
const step = (tauRange * 2) / STEPS;

for (let animTime of [0, 1, 2]) {
    const ptau = findTauForLabTime(V.X, animTime);
    const X_origin = evaluateVectorAtTau(V.X, ptau);
    const U = evaluateVectorAtTau(V.U, ptau);
    const v3 = extract3Velocity(U);
    const Lambda = getLorentzBoostMatrix(v3);

    const t_lab: number[] = [], x_lab: number[] = [], y_lab: number[] = [], z_lab: number[] = [];
    for (let tau = -tauRange; tau <= tauRange; tau += step) {
        const val = evaluateVectorAtTau(V.X, tau);
        t_lab.push(val[0]); x_lab.push(val[1]); y_lab.push(val[2]); z_lab.push(val[3]);
    }

    const tr = transformWorldlineCoordinates({ t: t_lab, x: x_lab, y: y_lab, z: z_lab }, Lambda, X_origin, ptau);

    let minDiff = Infinity;
    let closestIndex = 0;
    for (let i = 0; i < tr.t.length; i++) {
        if (Math.abs(t_lab[i] - animTime) < minDiff) {
            minDiff = Math.abs(t_lab[i] - animTime);
            closestIndex = i;
        }
    }

    console.log(`\nAnimTime=${animTime} (ptau=${ptau.toFixed(4)})`);
    console.log(`v=${v3[0].toFixed(4)}`);
    for (let i = closestIndex - 1; i <= closestIndex + 1; i++) {
        if (i >= 0 && i < tr.t.length) {
            console.log(`  plot point i=${i}: x_lab=${x_lab[i].toFixed(4)}, t_lab=${t_lab[i].toFixed(4)} -> x'=${tr.x[i].toFixed(6)}, t'=${tr.t[i].toFixed(6)}`);
        }
    }
}
