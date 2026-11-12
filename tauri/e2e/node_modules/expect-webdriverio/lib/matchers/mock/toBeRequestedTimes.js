import { waitUntil, enhanceError } from '../../utils.js';
import { DEFAULT_OPTIONS } from '../../constants.js';
import { validateNumberAndExtractOptions } from '../../util/numberOptionsUtil.js';
export async function toBeRequestedTimes(received, expectedValue, options = DEFAULT_OPTIONS) {
    const { verb = 'be', isNot, matcherName = 'toBeRequestedTimes', expectation = `called${typeof expectedValue === 'number' ? ' ' + expectedValue : ''} time${expectedValue !== 1 ? 's' : ''}`, } = this;
    await options.beforeAssertion?.({
        matcherName,
        expectedValue,
        options,
    });
    const { numberMatcher: expectedNumber, commandOptions } = validateNumberAndExtractOptions(expectedValue, options);
    const { success: pass, actual } = await waitUntil(async () => {
        const actual = received.calls.length;
        return { success: expectedNumber.asymmetricMatch(actual), subject: received, actual };
    }, isNot, { wait: commandOptions.wait, interval: commandOptions.interval });
    const message = enhanceError('mock', expectedNumber, actual, this, verb, expectation, '', commandOptions);
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
