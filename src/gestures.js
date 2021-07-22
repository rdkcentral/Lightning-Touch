import {config} from "../index";

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
            type: 'swipe', direction
        };
    } else {
        return false;
    }
};