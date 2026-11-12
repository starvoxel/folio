import { executeCommandBe } from '../../utils.js';
import { DEFAULT_OPTIONS } from '../../constants.js';
export async function toExist(received, options = DEFAULT_OPTIONS) {
    this.expectation = this.expectation || 'exist';
    this.verb = this.verb || '';
    this.allowEmptyElements = true;
    await options.beforeAssertion?.({
        matcherName: 'toExist',
        options,
    });
    const result = await executeCommandBe.call(this, received, el => el?.isExisting(), options);
    await options.afterAssertion?.({
        matcherName: 'toExist',
        options,
        result
    });
    return result;
}
export function toBeExisting(el, options) {
    this.expectation = 'existing';
    this.verb = 'be';
    return toExist.call(this, el, options);
}
export function toBePresent(el, options) {
    this.expectation = 'present';
    this.verb = 'be';
    return toExist.call(this, el, options);
}
