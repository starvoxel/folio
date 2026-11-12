import { AsymmetricMatcher } from 'expect';
import { isDefinedPlainObject } from './commandOptionsUtils.js';
export const isNumber = (value) => typeof value === 'number' && !isNaN(value);
export const isDefinedNotNumber = (value) => value !== undefined && !isNumber(value);
export const isDefinedNumberOrNonEmptyObject = (value) => typeof value === 'number' || (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0);
export function validateNumberAndExtractOptions(expectedValue, commandOptions, { supportDefaultAsGteThen1 } = {}) {
    let defaultExpectedValue = undefined;
    if (supportDefaultAsGteThen1 && (expectedValue === undefined || (isDefinedPlainObject(expectedValue) && expectedValue.eq === undefined && expectedValue.gte === undefined && expectedValue.lte === undefined))) {
        defaultExpectedValue = new NumberMatcher({ gte: 1 });
    }
    else if (isNumber(expectedValue)) {
        return { numberMatcher: new NumberMatcher({ eq: expectedValue }), commandOptions };
    }
    else if (!isDefinedNumberOrNonEmptyObject(expectedValue) || isDefinedNotNumber(expectedValue.eq) || isDefinedNotNumber(expectedValue.gte) || isDefinedNotNumber(expectedValue.lte)
        || (expectedValue.eq === undefined && expectedValue.gte === undefined && expectedValue.lte === undefined)) {
        throw new Error(`Invalid NumberMatcher. Received: ${JSON.stringify(expectedValue)}`);
    }
    const { eq, gte, lte, ...restCommandOptions } = expectedValue ?? {};
    if (isNumber(gte) && isNumber(lte) && gte > lte) {
        throw new Error(`Invalid NumberMatcher range: 'gte' (${gte}) cannot be greater than 'lte' (${lte}).`);
    }
    return {
        numberMatcher: defaultExpectedValue ?? new NumberMatcher({ eq, gte, lte }),
        commandOptions: { ...commandOptions, ...restCommandOptions }
    };
}
export function validateNumberArrayAndExtractOptions(expectedValues, commandOptions, { supportDefaultAsGteThen1 } = {}) {
    if (Array.isArray(expectedValues)) {
        const allNumbers = expectedValues.map((value) => validateNumberAndExtractOptions(value, commandOptions, { supportDefaultAsGteThen1 }));
        return { numberMatcher: allNumbers.map(({ numberMatcher }) => numberMatcher), commandOptions };
    }
    return validateNumberAndExtractOptions(expectedValues, commandOptions, { supportDefaultAsGteThen1 });
}
export class NumberMatcher extends AsymmetricMatcher {
    sample;
    constructor(sample) {
        super(sample);
        this.sample = sample;
    }
    asymmetricMatch(actual) {
        if (actual === undefined) {
            return false;
        }
        if (isNumber(this.sample)) {
            return actual === this.sample;
        }
        if (isNumber(this.sample.eq)) {
            return actual === this.sample.eq;
        }
        if (isNumber(this.sample.gte) && isNumber(this.sample.lte)) {
            return actual >= this.sample.gte && actual <= this.sample.lte;
        }
        if (isNumber(this.sample.gte)) {
            return actual >= this.sample.gte;
        }
        if (isNumber(this.sample.lte)) {
            return actual <= this.sample.lte;
        }
        return false;
    }
    toAsymmetricMatcher() {
        if (isNumber(this.sample)) {
            return `${this.sample}`;
        }
        if (isNumber(this.sample.eq)) {
            return `${this.sample.eq}`;
        }
        if (isNumber(this.sample.gte) && isNumber(this.sample.lte)) {
            return `>= ${this.sample.gte} && <= ${this.sample.lte}`;
        }
        if (isNumber(this.sample.gte)) {
            return `>= ${this.sample.gte}`;
        }
        if (isNumber(this.sample.lte)) {
            return `<= ${this.sample.lte}`;
        }
        return 'Incorrect number options provided';
    }
    toString() {
        return this.toAsymmetricMatcher();
    }
    jasmineToString() {
        return this.toString();
    }
}
export const isEmptyOrLegacyNumberOptions = (value) => {
    if (!isDefinedPlainObject(value)) {
        return false;
    }
    const keys = Object.keys(value);
    return keys.length === 0 || keys.filter((key) => !['eq', 'gte', 'lte'].includes(key)).length > 0;
};
