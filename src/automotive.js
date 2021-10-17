/*
 * If not stated otherwise in this file or this component's LICENSE file the
 * following copyright and licenses apply:
 *
 * Copyright 2020 Metrological
 *
 * Licensed under the Apache License, Version 2.0 (the License);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Log} from "@lightningjs/sdk";
import {createFinger, createRecording, createVector} from "./models";
import {analyzeEnded, resetRecordings, getHorizontalForce, getVerticalForce} from "./analyzer";
import {
    getAllTouchedElements,
    isFunction,
    isArray,
    isString,
    distance,
    smoothstep,
    getConfigMap,
    getLocalPosition, getTouchedElements,
} from "./helpers";


let application = null;
export let config = new Map();

const init = (app, cfg) => {
    config = getConfigMap(cfg);

    disableBrowserBehavior();
    setup(document, app);
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
 * Recordings per textarea
 * @type {Map<any, any>}
 */
const recordings = new Map();

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
 * Events in this list will not be allowed to pass-through
 * @type {Set<string>}
 */
const blacklist = new Set();

/**
 * If this list.size > 0 we only allow those events to pass-through
 * if size = 0 we allow all events.
 * @type {Set<string>}
 */
const whitelist = new Set();

/**
 * Called when user start touching dashboard touchscreen
 * @param event
 */
const handleTouchStart = (event) => {
    const {changedTouches} = event;

    // to prevent the need to wait for a recording to close
    // or a gestures that start emitting events we always
    // call onTouchStart event on the elements we collide with on start.
    // this provide the possibility to do a quick visual response.
    if (changedTouches.length) {
        const finger = createFinger(changedTouches[0]);
        const touched = getAllTouchedElements(finger);
        if (touched.length) {
            for (let i = 0; i < touched.length; i++) {
                const element = touched[i];
                if (isFunction(element['_onTouchStart'])) {
                    element['_onTouchStart'](
                        getLocalPosition(element, finger)
                    );
                }
            }
        }
    }

    if (!isTouchStarted()) {
        openBridge();
    }
    if (isBridgeOpen()) {
        lastTouchStartEvent = event;
    } else if (config.get('syncTouch')) {
        // list of Touches for every point of contact
        // which contributed to the event.
        const changed = event.changedTouches;
        if (changed.length) {
            activeRecording.add(changed);
        }
    }
};

/**
 * Called for every finger that stopped touching the screen
 * @param event
 */
const handleTouchEnd = (event) => {
    // if touchend occurs while bridge is still open
    // we create a new recording
    if (isBridgeOpen()) {
        closeBridge();
    }

    if (config.get('syncTouchRelease')) {
        // list of Touches for every point of contact
        // which contributed to the event.
        const changed = event.changedTouches;
        // list of Touches for every point of contact
        // currently touching the surface
        const touches = event.touches;

        if (touches.length > changed.length) {
            activeRecording.remove(changed);
            dispatch('_onFingerRemoved', activeRecording);
        } else if (changed.length === touches.length) {
            endRecording();
        }
    } else {
        endRecording();
    }
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

/**
 * Open bridge for fingers to identify themself
 */
const openBridge = () => {
    timestampTouchStarted = Date.now();

    // flag that first finger has landed
    touchStarted = true;

    bridgeOpen = true;
    bridgeTimeoutId = setTimeout(
        closeBridge, config.get('bridgeCloseTimeout')
    );
};

const endRecording = () => {
    analyzeEnded(activeRecording);

    stickyElements.length = 0;
    touchStarted = false;
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
        element.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

        // append meta element
        document.head.appendChild(element);

        // prevent element region manipulation
        document.body.style.touchAction = 'none';

        // prevent window scroll
        document.body.style.overflow = 'hidden';

        if (config.get("ipad")) {
            // prevent safari body position issue on refresh
            document.body.style.position = 'fixed';
            document.body.style.left = "0px";
            document.body.style.top = "0px";

            // prevent longpress select
            document.body.style.webkitUserSelect = 'none';

            // fullscreen support on ipad homescreen pin
            const element = document.createElement('meta');
            element.name = 'apple-mobile-web-app-capable';
            element.content = 'yes';

            // append meta element
            document.head.appendChild(element);
        }

    } catch (e) {
        // silent
    }
};


/**
 * close bridge so no new fingers can enter
 */
const closeBridge = () => {
    bridgeOpen = false;

    // start new recording session
    activeRecording = startRecording(
        lastTouchStartEvent
    );
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

const updateConfig = (k, v) => {
    if (config.has(k)) {
        config.set(k, v);
    } else {
        Log.warn('Automotive', `unable to update ${k} to ${v}`);
    }
};

/**
 * Call event on touched elements
 * @param event
 * @param recording
 * @return {*}
 */
export const dispatch = (event, recording) => {
    if (isBlocked(event)) {
        return;
    }

    const touched = getAllTouchedElements(recording.fingers);
    const handled = [];

    if (touched.length) {
        for (let i = 0; i < touched.length; i++) {
            const element = touched[i];
            const local = getLocalPosition(element, recording.fingers);
            if (isFunction(touched[i][event])) {
                const bubble = touched[i][event](recording, local);
                handled.push(element);

                // if false is returned explicitly we let event bubble
                if (bubble !== false) {
                    break;
                }
            }
        }
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
    if (isBlocked(event)) {
        return;
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
            const local = getLocalPosition(element, recording.fingers);
            if (isFunction(element[event]) && !handled) {
                element[event](recording, local);
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
 * Prevent events from being emitted
 * from broadcast
 * @param events
 */
const block = (events = []) => {
    return add(blacklist, events);
};

/**
 * Allow blocked event to be emitted
 * from broadcast
 * @param events
 */
const release = (events) => {
    return remove(blacklist, events);
};

/**
 * Only allow events from this type to be emitted
 * @param events
 */
const lock = (events) => {
    return add(whitelist, events);
};

/**
 * Remove event type from whitelist
 * @param events
 */
const unlock = (events) => {
    return remove(whitelist, events);
};

const add = (list, items = []) => {
    if (!isArray(items)) {
        items = [items];
    }
    items.forEach(
        item => list.add(item)
    );
};

const remove = (list, items = []) => {
    if (!isArray(items)) {
        if (isString(items)) {
            list.delete(items);
            return;
        } else {
            items = [items];
        }
    }
    items.forEach(
        item => list.delete(item)
    );
};

const isBlocked = (event) => {
    if (whitelist.size) {
        if (!whitelist.has(event)) {
            return true;
        }
    }
    return blacklist.has(event);
};

export default {
    start: init,
    block,
    release,
    lock,
    unlock,
    createVector,
    distance,
    smoothstep,
    getHorizontalForce,
    getVerticalForce,
    updateConfig,
};










