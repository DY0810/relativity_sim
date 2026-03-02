import { solveFromPosition, evaluateVectorAtTau } from './src/engine/cas';
import { validateCausality } from './src/engine/physics';

const expr2 = 'sqrt(1 + (sinh(tau))^2)';
const V = solveFromPosition(['sinh(tau)', expr2, '0', '0']);

let foundNaN = false;
let tauRange = 50;
let STEPS = 500;
let step = (tauRange * 2) / STEPS;

for (let tau = -tauRange; tau <= tauRange; tau += step) {
    const val = evaluateVectorAtTau(V.X, tau);
    if (val.some(v => isNaN(v) || !isFinite(v))) {
        console.log('NaN found at tau =', tau, val);
        foundNaN = true;
        break;
    }
}
console.log('Finished 500 steps, foundNaN:', foundNaN);

// Also check velocity for checkCausalityViolation
let foundFTL = false;
for(let tau = -50; tau <= 50; tau += 1) {
    const U = evaluateVectorAtTau(V.U, tau);
    const valid = validateCausality(U);
    if (!valid.isValid) {
        foundFTL = true;
        break;
    }
}
console.log('validateCausality loop FTL:', foundFTL);
