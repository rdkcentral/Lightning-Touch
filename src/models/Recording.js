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
import {createFinger, createVector} from "./index";
import {sticky, dispatch, config} from "../automotive";
import {distance} from "../helpers";

export default (event) => {
    const starttime = Date.now();
    const touches = event.touches;
    const fingers = new Map();
    const len = touches.length;

    let endtime = Date.now();
    let isTap = false;
    /**
     * Is user long holding the screen
     * @type {boolean}
     */
    let isHold = false;

    /**
     * Did one of the fingers in this recording move
     * @type {boolean}
     */
    let moved = false;

    let dragStarted = false;
    let pinchStarted = false;
    let isPinched = false;
    let pinch = null;
    let pinchStartDistance = 0;
    let analyzed = false;

    // register every finger
    for (let i = 0; i < len; i++) {
        const touch = touches[i];
        fingers.set(touch.identifier, createFinger(touch));
    }

    // we schedule a timeout in which this recording flags
    // itself as a 'hold'. A touchend can clear the timeout
    // if callback hasn't fired
    Registry.setTimeout(() => {
        if (!isHold) {
            isHold = true;
            Registry.setInterval(() => {
                endtime = Date.now();
                if (!dragStarted) {
                    sticky('_onDragStart', record);
                    dragStarted = true;
                }
                sticky('_onDrag', record);
            }, 1);
        }
    }, config.get('flagAsHoldDelay'));

    /**
     * Update current with recording with data collected from
     * a touchmove event
     * @param event
     */
    const update = (event) => {
        const touches = event.touches;
        const len = touches.length;

        for (let i = 0; i < len; i++) {
            const touch = touches[i];
            if (fingers.has(touch.identifier)) {
                const finger = fingers.get(touch.identifier);
                // update new event data
                finger.update(touch);
            }
        }

        // if finger has moved we start emitting dragEvent early
        // drag always initiated by one finger
        if (!isHold && hasFingerMoved()) {
            isHold = true;
            moved = true;
            Registry.clearTimeouts();
            Registry.setInterval(() => {
                endtime = Date.now();
                if (!dragStarted) {
                    sticky('_onDragStart', record);
                    dragStarted = true;
                }
                sticky('_onDrag', record);
            }, config.get('dragInterval') || 1.5);
        }

        const pinch = getPinch();

        if (pinch) {
            record.pinch = pinch;
            if (!pinchStarted) {
                sticky('_onPinchStart', record);
                pinchStarted = true;
            }
            sticky('_onPinch', record);
            isPinched = true;
        }
    };

    const hasFingerMoved = () => {
        for (let finger of fingers.values()) {
            if (finger.moved) {
                return true;
            }
        }
        return false;
    };

    const getPinch = () => {
        if (fingers.size !== 2) {
            return false;
        }
        let f1, f2;
        for (let finger of fingers.values()) {
            if (!f1) {
                f1 = finger;
            } else {
                f2 = finger;
            }
        }

        if (f1.queue.length < 10 || f2.queue.length < 10) {
            return false;
        }

        const {queue: f1q, start: f1s, position: f1p} = f1;
        const {queue: f2q, start: f2s, position: f2p} = f2;
        const f1hDis = distance(f1q[0].position, f1q[~~(f1q.length / 2)].position);
        const f2hDis = distance(f2q[0].position, f2q[~~(f2q.length / 2)].position);
        const f1Dis = distance(f1q[0].position, f1q[f1q.length - 1].position);
        const f2Dis = distance(f2q[0].position, f2q[f2q.length - 1].position);
        const sDis = distance(f1s, f2s);
        const cDis = distance(f1p, f2p);
        const rDis = cDis - sDis;

        if (Math.abs(rDis) > 30 && f1Dis > f1hDis && f2Dis > f2hDis) {
            if (!pinchStartDistance) {
                pinchStartDistance = rDis;
            }
            const angle = Math.atan2(f1p.y - f2p.y, f1p.x - f2p.x);
            const start = Math.atan2(f1s.y - f2s.y, f1s.x - f2s.x);
            return {
                distance: rDis - pinchStartDistance,
                angle: angle - start
            };
        }
        return false;
    };

    const record = {
        update,
        get starttime() {
            return starttime;
        },
        get fingers() {
            return fingers;
        },
        get fingersTouched() {
            return fingers.size;
        },
        set endtime(ms) {
            endtime = ms;

            Registry.clearTimeouts();
            Registry.clearIntervals();

            if (isHold) {
                sticky('_onDragEnd', record);
            }

            if (isPinched) {
                sticky('_onPinchEnd', record);
            }

        },
        get endtime() {
            return endtime;
        },
        get duration() {
            return endtime - starttime;
        },
        set isTap(v) {
            isTap = v;
        },
        get isTap() {
            return isTap;
        },
        set isHold(v) {
            isHold = v;
        },
        get moved() {
            return moved;
        },
        set moved(v) {
            moved = v;
        },
        get isHold() {
            return isHold;
        },
        /**
         * return if fingers have moved
         */
        hasFingerMoved() {
            for (let finger of fingers.values()) {
                if (finger.moved) {
                    return true;
                }
            }
            return false;
        },
        /**
         * Returns the first finger startposition
         */
        get startposition() {
            return fingers?.values()?.next()?.value?.start;
        },
        /**
         * returns delta between start and current position
         * for first finger
         */
        get delta() {
            const finger = fingers?.values()?.next()?.value;
            if (finger) {
                return finger.delta;
            } else {
                return createVector(0.0, 0.0);
            }
        },
        get firstFinger() {
            return fingers?.values()?.next()?.value || null;
        },
        get analyzed() {
            return analyzed;
        },
        set analyzed(v) {
            analyzed = v;
        },
        set pinch(v) {
            pinch = v;
        },
        get pinch() {
            return pinch;
        },
        add(touches) {
            const len = touches.length;
            for (let i = 0; i < len; i++) {
                const finger = createFinger(touches.item(i));
                fingers.set(finger.identifier, finger);
                dispatch("_onFingerAdded", record);
            }
        },
        remove(touches) {
            const len = touches.length;
            for (let i = 0; i < len; i++) {
                const {identifier} = touches.item(i);
                fingers.delete(identifier);
                dispatch("_onFingerRemoved", record);
            }
        }
    };
    return record;
}
