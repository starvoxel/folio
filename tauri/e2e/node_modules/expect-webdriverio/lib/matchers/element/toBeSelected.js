import { executeCommandBe } from '../../utils.js';
import { DEFAULT_OPTIONS } from '../../constants.js';
export async function toBeSelected(received, options = DEFAULT_OPTIONS) {
    this.expectation = this.expectation || 'selected';
    this.matcherName = this.matcherName || 'toBeSelected';
    await options.beforeAssertion?.({
        matcherName: this.matcherName,
        options,
    });
    const result = await executeCommandBe.call(this, received, el => el?.isSelected(), options);
    await options.afterAssertion?.({
        matcherName: this.matcherName,
        options,
        result
    });
    return result;
}
export async function toBeChecked(received, options = DEFAULT_OPTIONS) {
    this.expectation = 'checked';
    this.matcherName = 'toBeChecked';
    const result = await toBeSelected.call(this, received, options);
    return result;
}
