import {Registry, Events} from "@lightningjs/sdk";
import {dispatch, config, sticky} from "../index";
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
        const analyzed = getSwipe(recording);

        // if we recognized a swipe
        if (analyzed) {
            let blocked = false;
            if (config.get('componentBlockBroadcast')) {
                blocked = sticky(
                    analyzed.event, analyzed.recording
                );
            }
            // if the event is not being handled by an touched component
            // or the function return false explicit broadcast the event
            if (blocked === false) {
                Events.broadcast(analyzed.event, analyzed.recording);
            }
        }
    }
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
 * Analyses the finger's position queue in search for
 * the last straight line it made before touch ended
 * @param finger
 */
export const findSlope = (finger, axis = 'x')=>{
    const queue = finger.queue;
    const len = queue.length;
    let last = 0;
    let affected = 0;

    for(let i = 0; i < len - 4; i++){
        const dis = Math.abs(
            queue[0].position[axis] - queue[i].position[axis]
        );
        if(dis >= last){
            last = dis;
            affected = i;
        }else{
            break;
        }
    }
    const duration = queue[0].time - queue[affected].time;
    return {
        duration, distance: last
    }

}



