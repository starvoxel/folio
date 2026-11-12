import { waitUntil, enhanceError, isAsymmetricMatcher, getAsymmetricMatcherValue } from '../../utils.js';
import { equals } from '../../jasmineUtils.js';
import { DEFAULT_OPTIONS } from '../../constants.js';
const STR_LIMIT = 80;
const KEY_LIMIT = 12;
function reduceHeaders(headers) {
    return Object.entries(headers).reduce((acc, [, value]) => {
        acc[value.name] = value.value.value;
        return acc;
    }, {});
}
export async function toBeRequestedWith(received, expectedValue = {}, options = DEFAULT_OPTIONS) {
    const { expectation = 'called with', verb = 'be', isNot, matcherName = 'toBeRequestedWith' } = this;
    await options.beforeAssertion?.({
        matcherName,
        expectedValue,
        options,
    });
    const hasPayloadExpectation = expectedValue.postData !== undefined || expectedValue.response !== undefined;
    const waitForPayloadOnNot = isNot && hasPayloadExpectation;
    const parseCache = new Map();
    let payloadNeverCollected = false;
    const { success: pass, actual } = await waitUntil(async () => {
        let lastCall;
        let hasPendingPayloadCandidate = false;
        for (const call of received.calls) {
            lastCall = call;
            const matchesNonPayloadCriteria = methodMatcher(call.request.method, expectedValue.method) &&
                statusCodeMatcher(call.response.status, expectedValue.statusCode) &&
                urlMatcher(call.request.url, expectedValue.url) &&
                headersMatcher(reduceHeaders(call.request.headers), expectedValue.requestHeaders) &&
                headersMatcher(reduceHeaders(call.response.headers), expectedValue.responseHeaders);
            if (!matchesNonPayloadCriteria) {
                continue;
            }
            if (bodyMatcher(call.postData, expectedValue.postData, parseCache) &&
                bodyMatcher(call.body, expectedValue.response, parseCache)) {
                return { success: true, subject: call, actual: call };
            }
            if ((expectedValue.postData !== undefined && call.postData === undefined) ||
                (expectedValue.response !== undefined && call.body === undefined)) {
                hasPendingPayloadCandidate = true;
            }
        }
        payloadNeverCollected = hasPendingPayloadCandidate;
        return {
            success: false,
            subject: lastCall,
            actual: lastCall,
            abort: waitForPayloadOnNot && !hasPendingPayloadCandidate,
        };
    }, waitForPayloadOnNot ? false : isNot, { ...options, wait: (isNot && !waitForPayloadOnNot) ? 0 : options.wait });
    const message = enhanceError('mock', minifyRequestedWith(expectedValue), minifyRequestMock(actual, expectedValue, parseCache) || 'was not called', this, verb, expectation, '', options) + (!pass && !isNot && payloadNeverCollected ? payloadCollectionHint(expectedValue) : '');
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
const payloadCollectionHint = (expectedValue) => {
    const fields = [
        expectedValue.postData !== undefined ? 'postData' : undefined,
        expectedValue.response !== undefined ? 'response' : undefined,
    ].filter(Boolean).join(' and ');
    return `

A request matched every other criterion, but its body was never collected, so ${fields} could not be compared.
This usually means either:
  - webdriverio is older than v9.28.0, which did not populate \`mock.calls[].postData\` (upgrade to v9.28.0 or later), or
  - body collection is turned off via \`maxSpyCollectedBodySize: 0\` in your config (it defaults to 10MB - remove the override or raise it).`;
};
const methodMatcher = (method, expected) => {
    if (expected === undefined) {
        return true;
    }
    if (!Array.isArray(expected)) {
        expected = [expected];
    }
    return expected
        .map((m) => {
        if (typeof m !== 'string') {
            return console.error('expect.toBeRequestedWith: unsupported value passed to method ' + m);
        }
        return m.toUpperCase();
    })
        .includes(method);
};
const statusCodeMatcher = (statusCode, expected) => {
    if (expected === undefined) {
        return true;
    }
    if (!Array.isArray(expected)) {
        expected = [expected];
    }
    return expected.includes(statusCode);
};
const urlMatcher = (url, expected) => {
    if (expected === undefined) {
        return true;
    }
    if (typeof expected === 'function') {
        return expected(url);
    }
    return equals(url, expected);
};
const headersMatcher = (headers, expected) => {
    if (expected === undefined ||
        typeof expected === 'object' && Object.keys(expected).length === 0) {
        return true;
    }
    if (typeof expected === 'function') {
        return expected(headers);
    }
    return equals(headers, expected);
};
const bodyMatcher = (body, expected, parseCache) => {
    if (typeof expected === 'undefined') {
        return true;
    }
    if (typeof expected === 'function') {
        return expected(body);
    }
    if (typeof body === 'undefined') {
        return false;
    }
    let parsedBody = body;
    if (body instanceof Buffer) {
        parsedBody = body.toString();
    }
    if (typeof parsedBody === 'string' && isExpectedJsonLike(expected)) {
        const parsed = parseJsonOnce(parsedBody, parseCache);
        if (!parsed.ok) {
            return false;
        }
        parsedBody = parsed.value;
    }
    return equals(parsedBody, expected);
};
const JSON_LIKE_ANY_CONSTRUCTORS = new Set([Number, Boolean, Array, Object]);
const isExpectedJsonLike = (expected) => {
    if (typeof expected === 'undefined') {
        return false;
    }
    const actualSample = isAsymmetricMatcher(expected)
        ? getAsymmetricMatcherValue(expected)
        : expected;
    return (actualSample === null ||
        typeof actualSample === 'boolean' ||
        typeof actualSample === 'number' ||
        Array.isArray(actualSample) ||
        JSON_LIKE_ANY_CONSTRUCTORS.has(actualSample) ||
        (typeof actualSample === 'object' &&
            actualSample !== null &&
            actualSample instanceof RegExp === false));
};
const parseJsonOnce = (jsonString, cache) => {
    const cached = cache.get(jsonString);
    if (cached) {
        return cached;
    }
    let result;
    try {
        result = { ok: true, value: JSON.parse(jsonString) };
    }
    catch {
        result = { ok: false };
    }
    cache.set(jsonString, result);
    return result;
};
const resolveBodyForDisplay = (raw, expectedForField, parseCache) => {
    if (typeof raw !== 'string' || !isExpectedJsonLike(expectedForField)) {
        return raw;
    }
    const parsed = parseJsonOnce(raw, parseCache);
    return parsed.ok ? parsed.value : raw;
};
const minifyRequestMock = (requestMock, requestedWith = {}, parseCache = new Map()) => {
    if (requestMock === undefined) {
        return requestMock;
    }
    const r = {
        url: requestMock.request.url,
        method: requestMock.request.method,
        requestHeaders: requestMock.request.headers,
        responseHeaders: requestMock.response.headers,
        postData: resolveBodyForDisplay(requestMock.postData, requestedWith.postData, parseCache),
        response: resolveBodyForDisplay(requestMock.body, requestedWith.response, parseCache),
    };
    deleteUndefinedValues(r, requestedWith);
    return minifyRequestedWith(r);
};
const minifyRequestedWith = (r) => {
    const result = {
        url: requestedWithParamToString(r.url),
        method: r.method,
        requestHeaders: requestedWithParamToString(r.requestHeaders, shortenJson),
        responseHeaders: requestedWithParamToString(r.responseHeaders, shortenJson),
        postData: requestedWithParamToString(r.postData, shortenJson),
        response: requestedWithParamToString(r.response, shortenJson),
    };
    deleteUndefinedValues(result);
    return result;
};
const requestedWithParamToString = (param, transformFn) => {
    if (param === undefined) {
        return;
    }
    if (typeof param === 'function') {
        param = param.toString();
    }
    else if (isAsymmetricMatcher(param)) {
        const sample = getAsymmetricMatcherValue(param);
        const sampleString = typeof sample === 'string' ? sample : sample instanceof RegExp ? sample.toString() : JSON.stringify(sample) || sample?.toString();
        return `${param.constructor.name} ${sampleString || ''}`;
    }
    else if (transformFn && typeof param === 'object' && param !== null) {
        param = transformFn(param);
    }
    if (typeof param === 'string') {
        param = shortenString(param);
    }
    return param;
};
const shortenJson = (obj, lengthLimit = STR_LIMIT * 2, keyLimit = KEY_LIMIT) => {
    if (JSON.stringify(obj).length < lengthLimit) {
        return obj;
    }
    if (Array.isArray(obj)) {
        const firstItem = typeof obj[0] === 'object' && obj[0] !== null
            ? shortenJson(obj[0], lengthLimit / 2, keyLimit / 4)
            : shortenString(JSON.stringify(obj[0]));
        return [firstItem, `... ${obj.length - 1} more items`];
    }
    const minifiedObject = {};
    const entries = Object.entries(obj);
    if (keyLimit >= 4) {
        entries.slice(0, keyLimit).forEach(([k, v]) => {
            if (typeof v === 'object' && v !== null) {
                v = shortenJson(v, lengthLimit / 2, keyLimit / 4);
            }
            else if (typeof v === 'string') {
                v = shortenString(v, 16);
            }
            minifiedObject[shortenString(k, 24)] = v;
        });
    }
    if (entries.length > keyLimit) {
        minifiedObject['...'] = `${entries.length} items in total`;
    }
    return minifiedObject;
};
const shortenString = (str, limit = STR_LIMIT) => {
    return str.length > limit ? str.substring(0, limit / 2 - 1) + '..' + str.substr(1 - limit / 2) : str;
};
const deleteUndefinedValues = (obj, baseline = obj) => {
    Object.keys(obj).forEach((k) => {
        if (baseline[k] === undefined) {
            delete obj[k];
        }
    });
};
export function toBeRequestedWithResponse(...args) {
    return toBeRequestedWith.call(this, ...args);
}
