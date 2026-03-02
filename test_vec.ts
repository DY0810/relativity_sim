import { solveFromPosition, evaluateVectorAtTau, checkCausalityViolation } from './src/engine/cas';
import { validateCausality } from './src/engine/physics';

const expr1 = 'sinh(tau)';
const expr2 = 'sqrt(1 + (sinh(tau))^2)';
const V = solveFromPosition([expr1, expr2, '0', '0']);
console.log('X expr:', V.X);
console.log('U expr:', V.U);

let failed = false;
for (let tau = -5; tau <= 5; tau += 1) {
    const U = evaluateVectorAtTau(V.U, tau);
    const valid = validateCausality(U);
    if (!valid.isValid) {
        console.log('Causality failed at tau=', tau, 'U=', U, valid.reason);
        failed = true;
        break;
    }
}
if (!failed) console.log('validateCausality passed all tau');

console.log('checkCausalityViolation says:', checkCausalityViolation(V.U));
