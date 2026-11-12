import { DEFAULT_OPTIONS } from '../../constants.js';
import { executeCommandWithStrategy } from '../../util/executeCommand.js';
import { compareObject, enhanceError, waitUntil, wrapExpectedWithArray, } from '../../utils.js';
async function condition(el, size) {
    const actualSize = await el.getSize();
    return compareObject(actualSize, size);
}
export async function toHaveSize(received, expectedValue, options = DEFAULT_OPTIONS) {
    const { expectation = 'size', verb = 'have', isNot, matcherName = 'toHaveSize' } = this;
    await options.beforeAssertion?.({
        matcherName,
        expectedValue,
        options,
    });
    const { success: pass, actual: actualSize, subject: el, context: { isSome } = {} } = await waitUntil(async (iteration) => {
        return await executeCommandWithStrategy({
            unresolvedElements: received,
            expectedValues: expectedValue,
            singleElementCompare: (element, expectedSize) => condition(element, expectedSize),
            context: { isNot, iteration },
            strategy: 'NewStrictMultipleElements',
            strictConfiguration: { allowArrayWithSingleElement: false }
        });
    }, isNot, { wait: options.wait, interval: options.interval });
    const message = enhanceError(el, wrapExpectedWithArray(el, actualSize, expectedValue), actualSize, { isNot, isSome }, verb, expectation, '', options);
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
