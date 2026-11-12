import { isStrictlyElementArray } from './elementsUtil.js';
export const refetchElements = async (elements) => {
    if (elements
        && isStrictlyElementArray(elements)
        && elements.parent && elements.foundWith && elements.foundWith in elements.parent) {
        const browser = elements.parent;
        const $$ = browser[elements.foundWith];
        return await $$.call(browser, elements.selector, ...elements.props);
    }
    return elements;
};
export const syncronizeElements = async (subject, refetchedElements) => {
    if (subject instanceof Promise) {
        await syncronizeChainableElementArray(subject, refetchedElements);
    }
    else if (isStrictlyElementArray(subject)) {
        synchronizeElementArray(subject, refetchedElements);
    }
};
export const syncronizeChainableElementArray = async (subject, refetchedElements) => {
    const awaitedSubject = await subject;
    if (isStrictlyElementArray(awaitedSubject) && refetchedElements) {
        synchronizeElementArray(await awaitedSubject.getElements(), refetchedElements);
    }
};
export const synchronizeElementArray = (subject, refetchedElements) => {
    subject.length = refetchedElements.length;
    for (let index = 0; index < refetchedElements.length; index++) {
        subject[index] = refetchedElements[index];
    }
};
export const refreshElementArray = async (subject) => {
    const refetchedElements = await refetchElements(subject);
    synchronizeElementArray(subject, refetchedElements);
};
