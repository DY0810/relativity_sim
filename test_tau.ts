import { solveFromPosition, findTauForLabTime, evaluateVectorAtTau, Vector4 } from './src/engine/cas';
import { validateCausality } from './src/engine/physics';

const expr2 = 'sqrt(1 + (sinh(tau))^2)';
const V = solveFromPosition(['sinh(tau)', expr2, '0', '0']);

console.log('X:', V.X);
console.log('findTauForLabTime(0) =', findTauForLabTime(V.X, 0));
console.log('findTauForLabTime(5) =', findTauForLabTime(V.X, 5));
console.log('evaluateVectorAtTau(5) =', evaluateVectorAtTau(V.X, findTauForLabTime(V.X, 5)));
