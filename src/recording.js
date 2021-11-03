/**
 * Recordings per toucharea
 * @type {Map}
 */
const recordings = new Map();

/**
 * recordings per area that already have been analyzed
 * we only store one per area
 * @type {Map}
 */
const analyzed = new Map();

/**
 * Active fingers touching the surface
 * @type {Map}
 */
const fingers = new Map();

export const hasRecording = (key) => {
    if (!key) {
        return;
    }
    return recordings.has(key);
};

export const getRecording = (key) => {
    if (hasRecording(key)) {
        return recordings.get(key);
    }
};

export const addRecording = (key, recording) => {
    recordings.set(key, recording);
};

export const removeRecording = (key) => {
    if (hasRecording(key)) {
        // @todo: better implementation
        analyzed.set(key, getRecording(key));
        recordings.delete(key);
    }
};

export const hasFinger = (identifier) => {
    return fingers.has(identifier);
};

export const getFinger = (identifier) => {
    if (hasFinger(identifier)) {
        return fingers.get(identifier);
    }
};

export const addFinger = (identifier, areaId) => {
    fingers.set(identifier, areaId);
};

export const removeFinger = (identifier) => {
    fingers.delete(identifier);
};

export const getFingersOnArea = (areaId) => {
    return [...fingers.values()].filter((id) => id === areaId);
};

export const getAreaByFingerId = (identifier) => {
    return getFinger(identifier);
};

export const getAnalyzed = (areaId) => {
    if (analyzed.has(areaId)) {
        return analyzed.get(areaId);
    }
};


