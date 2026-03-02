import { solveFromPosition, evaluateVectorAtTau, findTauForLabTime } from './src/engine/cas';
import { getLorentzBoostMatrix, transformWorldlineCoordinates, extract3Velocity } from './src/engine/physics';

const expr2 = 'sqrt(1 + (sinh(tau))^2)';
const V = solveFromPosition(['sinh(tau)', expr2, '0', '0']);

console.log("Testing animationTime 0.0 to 1.0");
for (let t_lab = 0; t_lab <= 1; t_lab += 0.5) {
    const ptau = findTauForLabTime(V.X, t_lab);
    const X_origin = evaluateVectorAtTau(V.X, ptau);
    const U = evaluateVectorAtTau(V.U, ptau);
    const v3 = extract3Velocity(U);
    const Lambda = getLorentzBoostMatrix(v3);

    console.log(`t_lab=${t_lab.toFixed(1)} -> v3_x=${v3[0].toFixed(4)}`);
}
