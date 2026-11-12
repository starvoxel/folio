import { AsymmetricMatcher } from 'expect';
import { isAsymmetricMatcher } from '../../utils.js';
export const buildWdioAsymmetricMatchersWithOptions = (expectedValue, options) => {
    if (options) {
        if (Array.isArray(expectedValue)) {
            return expectedValue.map((value) => buildOneAsymmetricMatcherWithOptions(value, options));
        }
        return buildOneAsymmetricMatcherWithOptions(expectedValue, options);
    }
    return expectedValue;
};
const buildOneAsymmetricMatcherWithOptions = (expectedValue, options) => {
    if (options) {
        if (isAsymmetricMatcher(expectedValue) && 'withOptions' in expectedValue && typeof expectedValue.withOptions === 'function') {
            return expectedValue.withOptions(options);
        }
    }
    return expectedValue;
};
export class WdioAsymmetricMatchers extends AsymmetricMatcher {
    toString() {
        return this.toAsymmetricMatcher();
    }
}
