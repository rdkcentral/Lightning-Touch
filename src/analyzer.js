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

import {Registry} from "@lightningjs/sdk";
import {dispatch, config, sticky} from ".";
import {getSwipe} from "./gestures";
import {distance} from "./helpers";

/**
 * Timeout id for dispatching onTap on touched screen element
 * @type {number}
 */
let tapFireTimeoutId = 0;

/**
 * Reference to last recording so we can identify
 * double tap
 * @type {{}}
 */
let lastRecording = {};
/**
 * Analyze a recording that has ended
 * @param recording
 */
export const analyzeEnded = (recording) => {
    if (recording.analyzed) {
        return;
    }
    if (isTap(recording)) {
        if (recording.fingersTouched === 1) {
            handleTap(recording);
        } else if (!recording.moved && !recording.isHold) {
            dispatch('_onMultiTap', recording);
            lastRecording = null;
        }
    } else if (!recording.moved) {
        // if we passed tap delay and we haven't moved
        dispatch('_onLongpress', recording);
    } else {
        // start analyzing as a swipe
        const result = getSwipe(recording);
        if (result) {
            const {type, direction} = result;
            const touchesEvent = `${type}${recording.fingersTouched}f${direction}`;
            const defaultEvent = `${type}${direction}`;
            let handled = false;
            [touchesEvent, defaultEvent].forEach((event) => {
                if (!handled) {
                    handled = callEvent(event, recording);
                }
            });
        }

    }

    // flag so it will not be analyzed again
    recording.analyzed = true;
};

const callEvent = (event, recording) => {
    return dispatch(event, recording);
};

const handleTap = (recording) => {
    // flag recording as tap
    recording.isTap = true;

    // if the Ui is not using double tap
    // we can dispatch tap event immediately
    if (!config.get('doubleTapActive')) {
        dispatch('_onSingleTap', recording);
        return;
    }

    if (lastRecording && lastRecording.isTap) {
        // test if both taps are close to each other
        const dis = distance(
            recording.startposition, lastRecording.startposition
        );
        if (Math.abs(dis) < config.get('doubleTapMaxDistance')) {
            Registry.clearTimeouts();
            dispatch('_onDoubleTap', recording);
            recording.isTap = false;
        }
    } else {
        // if no new tap is clearing this timeout
        // we emit onSingleTap
        tapFireTimeoutId = Registry.setTimeout(() => {
            dispatch('_onSingleTap', recording);
            recording.isTap = false;
        }, config.get('beforeDoubleTapDelay'));
    }
    lastRecording = recording;
};

export const resetRecordings = () => {
    lastRecording = null;
};

const isTap = (recording) => {
    return recording.endtime - recording.starttime <= config.get('tapDelay') && !recording.moved;
};

/**
 * @param finger
 * @returns {{duration, distance}}
 */
export const getHorizontalForce = (finger) => {
    return calculateForce(
        findSlope(finger, 'x')
    );
};

/**
 * @param finger
 * @returns {{duration, distance}}
 */
export const getVerticalForce = (finger) => {
    return calculateForce(
        findSlope(finger, 'y')
    );
};


const calculateForce = ({duration, distance})=>{
    if(distance === 0 && duration < config.get('maxZeroDistanceDuration')){
        return config.get('maxForce') || 10;
    }
    const power = distance / duration;
    return isFinite(power) ? power : 0;
}

/**
 * Analyses the finger's position queue in search for
 * the last straight line it made before touch ended
 * @param finger
 * @param axis
 * @returns {{duration: number, distance: number}}
 */
export const findSlope = (finger, axis = 'x') => {
    const queue = finger.queue;
    const len = queue.length;
    let last = 0;
    let affected = 0;

    for (let i = 0; i < len - 4; i++) {
        const dis = Math.abs(
            queue[0].position[axis] - queue[i].position[axis]
        );
        if (dis >= last) {
            last = dis;
            affected = i;
        } else {
            break;
        }
    }
    const duration = queue[0].time - queue[affected].time;
    return {
        duration, distance: last
    };

};



