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

import {createVector} from "./index";
import {config} from "../automotive";

/**
 * Amount of positions we store in queue
 * @type {number}
 */

export default (data)=>{
    const startPosition = createVector(
        data.clientX + config.get('viewportOffsetX'),
        data.clientY + config.get('viewportOffsetY')
    );

    let identifier = data.identifier;
    let currentPosition = startPosition;
    let delta = createVector(0.0, 0.0);
    let moveRegistered = false;
    let moved = false;

    /**
     * flag if finger is part of pinching gesture
     * @type {boolean}
     */
    let pinching = false;

    /**
     * Cue that hold the last 10 touches to track
     * if two fingers make a pinch gesture
     * @type {Array}
     */
    const touchQueue = [];

    const update = (data) =>{
        currentPosition = createVector(
            data.clientX + config.get('viewportOffsetX'),
            data.clientY + config.get('viewportOffsetY')
        );
        delta = currentPosition.subtract(
            startPosition
        );
        if (Math.abs(delta.x) > 40 || Math.abs(delta.y) > 40) {
            if (!moveRegistered) {
                moved = true;
            }
        }
        touchQueue.unshift({
            position: currentPosition,
            time: Date.now()
        });

        // make sure we only hold last touch positions
        if(touchQueue.length > config.get('touchQueueMaxLength')){
            touchQueue.pop();
        }
    };

    return {
        update,
        get moved() {
            return moved;
        },
        get identifier() {
            return identifier;
        },
        get start() {
            return startPosition;
        },
        get end() {
            return currentPosition;
        },
        get position(){
            return currentPosition;
        },
        get delta() {
            return delta;
        },
        get queue(){
            return touchQueue;
        },
        get pinching(){
            return pinching;
        }
    }
}