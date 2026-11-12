import { DEFAULT_OPTIONS } from '../../constants.js';
import { wrapExpectedWithArray } from '../../util/elementsUtil.js';
import { executeCommandWithStrategy } from '../../util/executeCommand.js';
import { validateNumberArrayAndExtractOptions } from '../../util/numberOptionsUtil.js';
import { enhanceError, waitUntil, } from '../../utils.js';
async function condition(el, expectedNumber) {
    const actualWidth = await el.getSize('width');
    return {
        success: expectedNumber?.asymmetricMatch(actualWidth) ?? false,
        actual: actualWidth
    };
}
export async function toHaveWidth(received, expectedValue, options = DEFAULT_OPTIONS) {
    const { expectation = 'width', verb = 'have', isNot, matcherName = 'toHaveWidth' } = this;
    await options.beforeAssertion?.({
        matcherName,
        expectedValue,
        options,
    });
    const { numberMatcher: expectedNumber, commandOptions } = validateNumberArrayAndExtractOptions(expectedValue, options);
    const { success: pass, actual: actualWidth, subject: elements, context: { isSome } = {} } = await waitUntil(async (iteration) => {
        return await executeCommandWithStrategy({
            unresolvedElements: received,
            expectedValues: expectedNumber,
            singleElementCompare: (element, expectedNumber) => condition(element, expectedNumber),
            context: { isNot, iteration },
            strategy: 'NewStrictMultipleElements',
            strictConfiguration: { allowArrayWithSingleElement: false }
        });
    }, isNot, { wait: commandOptions.wait, interval: commandOptions.interval });
    const expectedValues = wrapExpectedWithArray(elements, actualWidth, expectedNumber);
    const message = enhanceError(elements, expectedValues, actualWidth, { isNot, isSome }, verb, expectation, '', commandOptions);
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
