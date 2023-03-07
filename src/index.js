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
    getLocalPosition,
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
        element.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

        // append meta element
        document.head.appendChild(element);

        // prevent element region manipulation
        document.body.style.touchAction = 'none';

        // prevent window scroll
        document.body.style.overflow = 'hidden';

        if(config.get("ipad")){
            // prevent safari body position issue on refresh
            document.body.style.position = 'fixed';
            document.body.style.left = "0px";
            document.body.style.top = "0px";

            // prevent longpress select
            document.body.style.webkitUserSelect = 'none'

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

const updateConfig = (k, v) =>{
    if(config.has(k)){
        config.set(k, v);
    }else{
        Log.warn('Touch',`unable to update ${k} to ${v}`)
    }
}

/**
 * Call event on touched elements
 *
 * @param event
 * @param recording
 * @param reset
 */
export const dispatch = (event, recording) => {
    if (isBlocked(event)) {
        return;
    }

    const touched = getAllTouchedElements(recording.fingers);
    if (touched.length) {
        for(let i = 0; i < touched.length; i++){
            const local = getLocalPosition(touched[i], recording);
            if (isFunction(touched[i][event])) {
                const bubble = touched[i][event](recording, local);
                // if false is returned explicitly we let event bubble
                if(bubble !== false){
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
            const local = getLocalPosition(element, recording);
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
    if(whitelist.size){
        if(!whitelist.has(event)){
            return true
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










