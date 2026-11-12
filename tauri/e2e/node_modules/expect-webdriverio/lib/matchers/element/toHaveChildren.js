import { DEFAULT_OPTIONS } from '../../constants.js';
import { executeCommandWithStrategy } from '../../util/executeCommand.js';
import { isEmptyOrLegacyNumberOptions, validateNumberArrayAndExtractOptions } from '../../util/numberOptionsUtil.js';
import { enhanceError, waitUntil, wrapExpectedWithArray } from '../../utils.js';
async function condition(el, expectedValue) {
    const children = await el.$$('./*').getElements();
    if (expectedValue === undefined) {
        return { success: false, actual: children?.length };
    }
    return {
        success: expectedValue?.asymmetricMatch(children?.length) ?? false,
        actual: children?.length
    };
}
export async function toHaveChildren(received, expectedValueOrOptions, options = DEFAULT_OPTIONS) {
    const { expectation = 'children', verb = 'have', isNot, matcherName = 'toHaveChildren' } = this;
    const paramsCount = arguments.length;
    if (paramsCount > 1 && (expectedValueOrOptions === undefined || isEmptyOrLegacyNumberOptions(expectedValueOrOptions))) {
        console.warn('Passing undefined or NumberOptions as the second argument to toHaveChildren is deprecated. Use a NumberMatcher instead. For example, `expect(el).toHaveChildren({ gte: 1 }, options)`');
    }
    await options.beforeAssertion?.({
        matcherName,
        expectedValue: expectedValueOrOptions,
        options,
    });
    const { numberMatcher: expectedNumber, commandOptions } = validateNumberArrayAndExtractOptions(expectedValueOrOptions, options, { supportDefaultAsGteThen1: true });
    const { success: pass, actual: children, subject, context: { isSome } = {} } = await waitUntil(async (iteration) => {
        return await executeCommandWithStrategy({
            unresolvedElements: received,
            expectedValues: expectedNumber,
            singleElementCompare: (element, expectedValue) => condition(element, expectedValue),
            context: { isNot, iteration },
            strategy: 'NewStrictMultipleElements',
        });
    }, isNot, { wait: commandOptions.wait, interval: commandOptions.interval });
    const expectedArray = wrapExpectedWithArray(subject, children, expectedNumber);
    const message = enhanceError(subject, expectedArray, children, { isNot, isSome }, verb, expectation, '', commandOptions);
    const result = {
        pass,
        message: () => message
    };
    await options.afterAssertion?.({
        matcherName,
        expectedValue: expectedValueOrOptions,
        options,
        result
    });
    return result;
}
