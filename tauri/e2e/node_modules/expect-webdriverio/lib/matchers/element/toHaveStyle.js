import { DEFAULT_OPTIONS } from '../../constants.js';
import { executeCommandWithStrategy } from '../../util/executeCommand.js';
import { compareStyle, enhanceError, waitUntil, wrapExpectedWithArray } from '../../utils.js';
async function condition(el, style, options) {
    if (style === undefined) {
        return { success: false, actual: undefined };
    }
    return compareStyle(el, style, options);
}
export async function toHaveStyle(received, expectedValue, options = DEFAULT_OPTIONS) {
    const { expectation = 'style', verb = 'have', isNot, matcherName = 'toHaveStyle' } = this;
    await options.beforeAssertion?.({
        matcherName,
        expectedValue,
        options,
    });
    const { success: pass, actual: actualStyle, subject: el, context: { isSome } = {} } = await waitUntil(async (iteration) => {
        return await executeCommandWithStrategy({
            unresolvedElements: received,
            expectedValues: expectedValue,
            singleElementCompare: (element, expectedValues) => condition(element, expectedValues, options),
            context: { isNot, iteration },
            strategy: 'NewStrictMultipleElements',
            strictConfiguration: { allowArrayWithSingleElement: false }
        });
    }, isNot, { wait: options.wait, interval: options.interval });
    const expected = wrapExpectedWithArray(el, actualStyle, expectedValue);
    const message = enhanceError(el, expected, actualStyle, { isNot, isSome }, verb, expectation, '', options);
    const result = {
        pass,
        message: () => message
    };
    await options.afterAssertion?.({
        matcherName,
        expectedValue,
        options,
        result
    });
    return result;
}
