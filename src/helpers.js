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

import {getApplication} from "./automotive";
import createVector from "./models/vector";

/**
 * Return element with the highest zIndex for a map of fingers
 * @param fingers
 * @returns {Array}
 */
export const getTouchedElements = (fingers) => {
    return getElementsAtPosition(fingers);
};

/**
 * Returns an array of all elements that collide
 * with the fingers zIndex is ignored
 */
export const getAllTouchedElements = (fingers) => {
    return getElementsAtPosition(fingers, true);
};

/**
 * Collect elements that collide with fingers
 * @param fingers
 * @param collectAll
 * @returns {Array}
 */
const getElementsAtPosition = (fingers, collectAll) => {
    const touched = [];
    for (let finger of fingers.values()) {
        const collection = getAtPosition(finger.start.x, finger.start.y);
        if (collection?.length) {
            if (collectAll) {
                touched.push(...collection);
            } else {
                // push element with highest zIndex
                touched.push(collection.slice(-1)[0]);
            }
        }
    }
    return touched;
};

/**
 * Return sorted list of elements that are at a given x / y position
 * elements are sorted by z-index (DESC) or by creation id (DESC)
 * @param x
 * @param y
 * @returns {Array}
 */
export const getAtPosition = (x, y) => {
    const rootElements = getApplication().children;
    const activeElements = findChildren([], rootElements);
    const touched = inRange(activeElements, x, y) || [];

    if (touched.length) {
        touched.sort((a, b) => {
            // Sort by zIndex and then id
            if (a.zIndex > b.zIndex) {
                return -1;
            } else if (a.zIndex < b.zIndex) {
                return 1;
            } else {
                return a.id > b.id ? -1 : 1;
            }
        });
        return touched;
    }
};

/**
 * Return a flat array of all children that have one of the initial
 * provided parents as parent
 * @param bucket
 * @param parents
 * @returns {*}
 */
const findChildren = (bucket, parents) => {
    let n = parents.length;
    while (n--) {
        const parent = parents[n];
        // only add active children
        if (parent.__active) {
            // potentially slow
            // add collision flag?
            bucket.push(parent);
            if (parent.hasChildren()) {
                findChildren(bucket, parent.children);
            }
        }
    }
    return bucket;
};

/**
 * Return list of elements that collide with the given point (x / y)
 * @param affected
 * @param x
 * @param y
 * @returns {Array}
 */
const inRange = (affected, x, y) => {
    let n = affected.length;
    const candidates = [];
    const stage = getApplication().stage;

    // loop through affected children
    // and perform collision detection
    while (n--) {
        const child = affected[n];
        const precision = stage.getRenderPrecision();
        const ctx = child.core._worldContext;

        const cx = ctx.px * precision;
        const cy = ctx.py * precision;
        const cw = child.finalW * ctx.ta * precision;
        const ch = child.finalH * ctx.td * precision;
        const rcx = cx + cw / 2;
        const rcy = cy + ch / 2;

        let isColliding = false;

        if (cx > stage.w || cy > stage.h) {
            continue;
        }

        if (child.parent.core._scissor && !testCollision(x, y, ...child.parent.core._scissor)) {
            continue;
        }

        if (child.rotation) {
            const origin = createVector(rcx, rcy);
            // inverse rectangle point rotation
            const rp = rotatePoint(origin.x, origin.y, -child.rotation, {
                x: ctx.px, y: ctx.py
            });
            // apply same inversion on touch point
            const p = rotatePoint(origin.x, origin.y, -child.rotation, {
                x, y
            });
            isColliding = collide(cw, ch, 0, rp.x + cw / 2, rp.y + ch / 2, p.x, p.y);
        } else {
            isColliding = collide(cw, ch, child.rotation, rcx, rcy, x, y);
        }

        if (isColliding) {
            candidates.push(child);
        }
    }
    return candidates;
};

/**
 * Point - rectangle collision detection
 * @param px
 * @param py
 * @param cx
 * @param cy
 * @param cw
 * @param ch
 * @returns {boolean}
 */
const testCollision = (px, py, cx, cy, cw, ch) => {
    return px >= cx && px <= cx + cw && py >= cy && py <= cy + ch;
};

/**
 * Calculate distance between 2 vectors
 * @param v1
 * @param v2
 * @returns {number}
 */
export const distance = (v1, v2) => {
    const a = v1.x - v2.x;
    const b = v1.y - v2.y;
    return Math.sqrt(a * a + b * b);
};

/**
 * Smoothstep interpolation function
 * @param min
 * @param max
 * @param value
 * @returns {number}
 */
export const smoothstep = (min, max, value) => {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
};

/**
 * Point to rotated rectangle collision detection
 * @param rw
 * @param rh
 * @param angle
 * @param rcx
 * @param rcy
 * @param px
 * @param py
 * @returns {boolean}
 */
export const collide = (rw, rh, angle, rcx, rcy, px, py) => {
    if (angle === 0) {
        return Math.abs(rcx - px) < rw / 2 && Math.abs(rcy - py) < rh / 2;
    }

    const c = Math.cos(angle);
    const s = Math.sin(angle);

    const tx = c * px - s * py;
    const ty = c * py + s * px;

    const cx = c * rcx - s * rcy;
    const cy = c * rcy + s * rcx;

    return Math.abs(cx - tx) < rw / 2 && Math.abs(cy - ty) < rh / 2;
};

/**
 * Rotate point around rect origin
 * @param cx
 * @param cy
 * @param angle
 * @param p
 * @returns {*}
 */
export const rotatePoint = (cx, cy, angle, p) => {
    const s = Math.sin(angle);
    const c = Math.cos(angle);

    p.x -= cx;
    p.y -= cy;

    const xn = p.x * c - p.y * s;
    const yn = p.x * s + p.y * c;
    p.x = xn + cx;
    p.y = yn + cy;

    return p;
};

export const getLocalPosition = (component, recording) =>{
    const {core:{renderContext}} = component;
    const local = new Map();
    if(isObject(renderContext)){
        const {px, py} = renderContext;
        for(const [id, {position}] of recording.fingers.entries()){
            local.set(id, createVector(
                position.x - px, position.y - py
            ));
        }
    }
    return {
        first: local.values().next().value,
        all: local
    };
}

/**
 * Return set of accepted engine flags
 * @param settings
 * @returns {*}
 */
export const getConfigMap = (settings) => {
    return [
        "bridgeCloseTimeout",
        "tapDelay",
        "doubleTapActive",
        "beforeDoubleTapDelay",
        "flagAsHoldDelay",
        "doubleTapMaxDistance",
        "externalTouchScreen",
        "componentBlockBroadcast",
        "swipeXTreshold",
        "swipeYTreshold",
        "viewportOffsetX",
        "viewportOffsetY",
        "dragInterval",
        "ipad"
    ].reduce((config, key) => {
        config.set(key, settings[key]);
        return config;
    }, new Map());
};

export const isFunction = v => {
    return typeof v === 'function';
};

export const isArray = v => {
    return Array.isArray(v);
};

export const isString = v => {
    return typeof v === 'string';
};

export const isObject = v => {
    return typeof v === 'object' && v !== null
}



