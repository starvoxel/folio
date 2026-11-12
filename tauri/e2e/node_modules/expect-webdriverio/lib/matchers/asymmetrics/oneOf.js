import { compareTextWithArray } from '../../utils.js';
import { WdioAsymmetricMatchers } from './asymmetricsUtils.js';
const ONE_OF_TAG = 'expect-webdriverio.oneOf';
const ONE_OF_SYMBOL = Symbol.for(ONE_OF_TAG);
export class OneOfMatcher extends WdioAsymmetricMatchers {
    [ONE_OF_SYMBOL] = true;
    options = {};
    constructor(...sample) {
        super(sample);
    }
    setOptions(options) {
        this.options = options;
        return this;
    }
    asymmetricMatch(actual) {
        if (actual === null) {
            return this.sample.includes(null);
        }
        else if (typeof actual !== 'string') {
            return false;
        }
        return compareTextWithArray(actual, this.sample.filter(s => s !== null), this.options).success;
    }
    withOptions(options) {
        return new OneOfMatcher(...this.sample).setOptions(options);
    }
    toAsymmetricMatcher() {
        let prefix = '';
        if (this.options.containing) {
            prefix = 'containing';
        }
        else if (this.options.atStart) {
            prefix = 'startingWith';
        }
        else if (this.options.atEnd) {
            prefix = 'endingWith';
        }
        else if (typeof this.options.atIndex === 'number') {
            prefix = `matchingAtIndex<${this.options.atIndex}>`;
        }
        const isArray = Array.isArray(this.sample);
        const samples = isArray ? this.sample : [this.sample];
        const formattedSamples = samples
            .map((s) => (s instanceof RegExp ? s.toString() : `"${s}"`))
            .join(', ');
        if (isArray) {
            prefix = prefix ? prefix + 'OneOf' : 'oneOf';
        }
        return prefix ? `${prefix}<${formattedSamples}>` : formattedSamples;
    }
}
export function oneOf(...sample) {
    return new OneOfMatcher(...sample);
}
export function isOneOfMatcher(oneOfMatcher) {
    return oneOfMatcher instanceof OneOfMatcher || oneOfMatcher?.[ONE_OF_SYMBOL] === true;
}
