import {Registry, Log} from "@lightningjs/sdk";
import {createRecording, createVector} from "./models";
import {analyzeEnded, resetRecordings, getHorizontalForce, getVerticalForce} from "./analyzer";
import {
    getAllTouchedElements,
    isFunction,
    isArray,
    isString,
    distance,
    smoothstep,
    getConfigMap,
} from "./helpers";

let application = null;
export let config = new Map();
export let offsetX = 0;
export let offsetY = 0;

const init = (app, cfg) => {
    disableBrowserBehavior();
    setup(document, app);

    config = getConfigMap(cfg);

    offsetX = config.get('viewportOffsetX') * -1 || 0;
    offsetY = config.get('viewportOffsetY') * -1 || 0;
};

/**
 * Since every finger that touches the screen triggers it's own 'touchstart' event
 * we need to flag if one finger is already pressing the screen while the listener
 * get executed
 * @type {boolean}
 */
let touchStarted = false;

/**
 * flag if the bridge to accept new fingers on screen is open
 * @type {boolean}
 */
let bridgeOpen = true;

/**
 * timeout id
 * @type {number}
 */
let bridgeTimeoutId = 0;

/**
 * Since every finger fires one 'touchstart' event we're always storing the last one fired
 * so our recording can use the touches (fingers) as it's starting point
 * @type {null}
 */
let lastTouchStartEvent = null;

/**
 * Timestamp when the first finger lands on the screen
 * @type {number}
 */
let timestampTouchStarted = 0;

/**
 * Array of recordings that is being used to analyze the users gesture
 * @type {Object}
 */
let activeRecording = {};

/**
 * The elements that the user is holding / dragging
 * @type {Array}
 */
let stickyElements = [];

/**
 * Elements that user last touched
 * @type {Array}
 */
let lastTouchedElements = [];

/**
 * Events that are currently being blocked
 * @type {Set<string>}
 */
const blockedEvents = new Set();

/**
 * Called when user start touching dashboard touchscreen
 * @param event
 */
const handleTouchStart = (event) => {
    if (!isTouchStarted()) {
        openBridge();
    }
    if (isBridgeOpen()) {
        lastTouchStartEvent = event;
    } else {
        Log.warn(`Not accepting new finger identifiers as long touchend hasn't fired`);
    }
};

/**
 * Called for every finger that stopped touching the screen
 * @param event
 */
const handleTouchEnd = () => {
    // if touchend occurs while bridge is still open
    // we create a new recording
    if (isBridgeOpen()) {
        closeBridge();
    }

    Log.info(`touchend`);
    touchStarted = false;

    // store end time
    activeRecording.endtime = Date.now();

    // start analyzing
    analyzeEnded(activeRecording);

    // reset sticky element
    stickyElements.length = 0;
};

/**
 * Called for every move the n amount of fingers do on screen
 * @param event
 */
const handleTouchMove = (event) => {
    if (activeRecording.starttime) {
        activeRecording.update(event);
    }
};


const disableBrowserBehavior = () => {
    try {
        // disable chrome scroll to refresh
        document.body.style.overscrollBehavior = 'none';

        // disable chrome contextmenu on longpress
        document.body.oncontextmenu = () => false;

        // prevent double tap zoom in on chrome
        const element = document.createElement('meta');
        element.name = 'viewport';
        element.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0';

        // append meta element
        document.head.appendChild(element);
    } catch (e) {
        // silent
    }
};

/**
 * Open bridge for fingers to identify themself
 */
const openBridge = () => {
    // store timestamp
    timestampTouchStarted = Date.now();

    // flag that first finger has landed
    touchStarted = true;

    // flag bridge open
    bridgeOpen = true;

    // schedule timeout
    bridgeTimeoutId = Registry.setTimeout(
        closeBridge, config.get('bridgeCloseTimeout')
    );
};

/**
 * close bridge so no new fingers can enter
 */
const closeBridge = () => {
    bridgeOpen = false;
    // start new recording session
    activeRecording = startRecording(lastTouchStartEvent);
};

/**
 * Returns a new recording session
 * @param event
 * @returns {}
 */
const startRecording = (event) => {
    return createRecording(event);
};

/**
 * return if a new touchStart recording has started
 * @returns {boolean}
 */
const isTouchStarted = () => {
    return touchStarted;
};
/**
 * return if we still accept new fingers
 * @returns {boolean}
 */
const isBridgeOpen = () => {
    return bridgeOpen;
};

/**
 * Setup correct event handlers
 */
const setup = (target, app) => {
    // store Lightning.Application instance
    application = app;

    ['touchstart', 'touchmove', 'touchend'].forEach((name) => {
        target.addEventListener(name, (event) => {
            if (handlers[name]) {
                if (config.get('externalTouchScreen') && event.sourceCapabilities) {
                    return;
                }
                handlers[name](event);
            }
        });
    });
};

/**
 * Call event on touched elements
 * @todo: handle explicit false for bubble
 *
 * @param event
 * @param recording
 * @param reset
 */
export const dispatch = (event, recording) => {
    if (blockedEvents.has(event)) {
        return;
    }

    const touched = getAllTouchedElements(recording.fingers);
    if (touched.length) {
        touched.forEach((element) => {
            if (isFunction(element[event])) {
                element[event](recording);
            }
        });
        lastTouchedElements = touched;
    }
    // clean up recording
    resetRecordings();
};

/**
 * Keep dispatching event on that we started the hold / drag on
 * @todo: do we want to accept false explicit for event bubble?
 *
 * @param event
 * @param recording
 */
export const sticky = (event, recording) => {
    // return true so we prevent unhandled sticky events
    // from being broadcasted to the app globally
    if (blockedEvents.has(event)) {
        return true;
    }

    let handled = false;
    // on first fire after a new recording has started
    // we collect the elements;
    if (!stickyElements.length) {
        stickyElements = getAllTouchedElements(recording.fingers).filter((element) => {
            return element[event];
        });
    }
    if (stickyElements.length) {
        stickyElements.forEach((element) => {
            if (isFunction(element[event]) && !handled) {
                element[event](recording);
                handled = true;
            }
        });
    }
    return handled;
};

export const handlers = {
    touchstart: handleTouchStart,
    touchmove: handleTouchMove,
    touchend: handleTouchEnd
};

export const getApplication = () => {
    return application;
};

export const activeTouchedElements = () => {
    return stickyElements;
};

export const getLastTouchedElements = () => {
    return lastTouchedElements;
};

/**
 * Block events from being emitted
 * from broadcast
 * @param events
 */
const block = (events = []) => {
    if (!isArray(events)) {
        events = [events];
    }
    events.forEach(
        event => blockedEvents.add(event)
    );
};

/**
 * Allow blocked event to be emitted
 * from broadcast
 * @param events
 */
const release = (events) => {
    if (!isArray(events)) {
        if (isString(events)) {
            blockedEvents.delete(events);
            return;
        } else {
            events = [events];
        }
    }
    events.forEach(
        event => blockedEvents.delete(event)
    );
};

export default {
    start: init, block, release, createVector, distance, smoothstep, getHorizontalForce, getVerticalForce
};









