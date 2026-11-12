import { DEFAULT_OPTIONS } from '../constants.js';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const waitUntil = async (condition, isNot = false, { wait = DEFAULT_OPTIONS.wait, interval = DEFAULT_OPTIONS.interval } = {}) => {
    if (wait === 0) {
        return await condition(0);
    }
    let error;
    let result;
    let iteration = 0;
    try {
        const start = Date.now();
        while (true) {
            if (Date.now() - start > wait) {
                throw new Error('timeout');
            }
            try {
                result = await condition(iteration++);
                const passed = isNot !== result?.success;
                error = undefined;
                if (passed) {
                    break;
                }
                else if (result?.abort) {
                    return { ...result, success: isNot };
                }
                await sleep(interval);
            }
            catch (err) {
                error = err;
                await sleep(interval);
            }
        }
        if (error) {
            throw error;
        }
        return { ...result, success: !isNot };
    }
    catch {
        if (error) {
            throw error;
        }
        return { ...result, subject: result?.subject, success: isNot, actual: result?.actual };
    }
};
