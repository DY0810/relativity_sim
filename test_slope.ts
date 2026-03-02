import { solveFromPosition, findTauForLabTime, evaluateVectorAtTau } from './src/engine/cas';
import { getLorentzBoostMatrix, transformWorldlineCoordinates, extract3Velocity } from './src/engine/physics';

const expr2 = 'sqrt(1 + (sinh(tau))^2)';
const V = solveFromPosition(['sinh(tau)', expr2, '0', '0']);

const animTime = 2; // t_lab = 2
const ptau = findTauForLabTime(V.X, animTime);
const X_origin = evaluateVectorAtTau(V.X, ptau);
const U = evaluateVectorAtTau(V.U, ptau);
const v3 = extract3Velocity(U);
const Lambda = getLorentzBoostMatrix(v3);

// Let's generate points very close to ptau to measure the exact slope dx'/dt'
const eps = 1e-4;
const t_lab = [], x_lab = [], y_lab = [], z_lab = [];
for (let tau of [ptau - eps, ptau, ptau + eps]) {
    const val = evaluateVectorAtTau(V.X, tau);
    t_lab.push(val[0]); x_lab.push(val[1]); y_lab.push(val[2]); z_lab.push(val[3]);
}

const tr = transformWorldlineCoordinates({ t: t_lab, x: x_lab, y: y_lab, z: z_lab }, Lambda, X_origin, ptau);

console.log("Central point x':", tr.x[1].toFixed(10), "t':", tr.t[1].toFixed(10));
console.log("dt' (future) =", (tr.t[2] - tr.t[1]).toFixed(10));
console.log("dx' (future) =", (tr.x[2] - tr.x[1]).toFixed(10));
console.log("Derivative dx'/dt' at origin =", ((tr.x[2] - tr.x[1]) / (tr.t[2] - tr.t[1])).toFixed(10));
