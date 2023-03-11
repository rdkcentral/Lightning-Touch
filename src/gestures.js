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

import {config} from ".";

export const getSwipe = (recording) => {
    let identified;
    let direction;

    const fingers = recording.fingers;
    const xTreshold = config.get('swipeXTreshold');
    const yTreshold = config.get('swipeYTreshold');

    for (let finger of fingers.values()) {
        const x1 = finger.start.x;
        const y1 = finger.start.y;
        const x2 = finger.end.x;
        const y2 = finger.end.y;
        const rDisx = x2 - x1;
        const rDisy = y2 - y1;
        const aDisx = Math.abs(rDisx);
        const aDisy = Math.abs(rDisy);
        const diff = aDisx > aDisy ? aDisy / aDisx : aDisx / aDisy;
        let valid = false;

        if (aDisx > aDisy) {
            direction = rDisx <= 0 ? 'Left' : 'Right';
            valid = xTreshold < aDisx;
        } else {
            direction = rDisy <= 0 ? 'Up' : 'Down';
            valid = yTreshold < aDisy;
        }

        // @todo: do we really want to test for normalized distance?
        if (valid && diff < 0.4) {
            identified = true;
            break;
        }
    }

    if (identified) {
        return {
            type: '_onSwipe', direction
        };
    } else {
        return false;
    }
};