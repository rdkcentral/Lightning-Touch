# AutoMotive Touch Engine

### Getting started

Update your project's dependency and run `npm install`

```
"dependencies": {
    "@lightningjs/automotive": "git+ssh://git@github.com/mlapps/Lightning-Automotive.git",
}
```

### Example Ui implementation

https://github.com/mlapps/com.metrological.ui.Automotive

### Getting started 

If you want to enrich your app with Automotive touch-support you first import the Library into your app. 

```js
import {Automotive} from '@lightningjs/automotive'
```

Next step is to start the automotive engine, in this example we implement it into a Routed App, and `start` it
right after the component get's attached to the render-tree ( `_setup` lifecycle event)

```js

export default class App extends Router.App {
    _setup(){
        Automotive.start(
            this.application, settings
        )
    }
}

```

### Documentation

This Library provides examples on how to build interactivity for a multi-touch touchscreen. The library
records and analyzes all fingers and it's movement.

Once the analyser recognizes a gesture it tries to dispatch that event on one of the active touched elements. De first argument of the function is the `record` instance that holds a lot  of data of the recording
(startposition / duration / data for every finger etc)

#### Types 

There are 2 main types that provide a lot of information on the started / active and ended touch event. 

##### Record 

Every `touchstart` will start the creation of a new `Record` that will be available and update during the lifespan of 
the current touch action (press / swipe / drag  pinch etc.)

```js
type Record = {  
    startime: number;
    endtime: number;
    fingers: Map;
    fingersTouched: number;
    duration: number;
    isTap: boolean;
    isHold: boolean;
    moved: boolean;
    hasFingerMoved: ()=> boolean;
    startposition: Vector;
    delta: Vector;
    firstFinger: Finger;
    analyzed:boolean;    
}
```

##### Finger

This library tracks each individual `Finger` that it pressing the screen. Each `Record` stores a `Map` with data for every finger
that's currently on the screen and will keep track of their current position. By doing this, the library can make a distinction on
a `Swipe` with one or multiple fingers. While building your App or Ui you can call `recordInstance.fingers` getter to receive the 
`Map` with with each `Finger` instance.


```js
type Finger = {
    moved: boolean;
    identifier: number;
    start: Vector;
    end: Vector;
    position: Vector;
    delta: Vector;
    queue: {position:Vector, time: number}[];
    pinching: boolean;
}
```

#### Touch Gestures

When one or more `Finger`'s are touching the screen this library will try to analyze it's intent. This library ships 
support for the following gestures: 

- Single tap
- Double tap
- Multi-finger tap
- Single longpress
- Multi-finger longpress
- Pinch (zoom and rotation)
- Spread (zoom and rotation)
- Swipe left
- Swipe right
- Swipe up
- Swipe down
- Multi-finger directional swipe

This library tries to recognize one (or more) of this gestures when a `Record`ing has ended or when one more `Finger`s 
are moving across the screen. Once a gesture is recognized the touch ending will search for all the on-screen `Components` 
that are rendered at the position where one of your fingers is positioned. When collision is detected it will order
the `Components` by z-index (so highest order first) and try to call a corresponding `Event` on that component. If a `Component` 
is not handling that specific event it will try to call it on the lower positioned (z-index) `Component`. 

This will enable you to add touch life-cycle events on i.e: a List `Component` but still render the `Items` on a higher level. 

### Available events

In addition to Lightning's lifecycle events, this Library provide a set of new events that you can attach on your `Component` 
to enable and listen to `touch` behaviour.

##### _onSingleTap

Will be called when one finger quickly touches this element

```js
_onSingleTap(recording){ }
```

##### _onMultiTap

Will be called when mutliple fingers quickly touches this element

```js
_onSingleTap(recording){ }
```


##### _onDoubleTap

When one finger quickly double taps the same element

```js
_onDoubleTap(recording){ }
```

##### _onLongpress()

Will be invoked if one or more fingers are pressing this element for < 800ms. For  now the recording data holds data for 
all the fingers so it could be that 3 fingers are touching 3 individual elements they all receive

```js
_onLongpress(recording){ }
```

##### _onDragStart()

Will be invoked when you start dragging an element

```js
_onDragStart(recording){ }
```


##### _onDrag()

Will be invoked when you touch an element and start moving your finger

```js
_onDrag(recording){ }
```

##### _onDragEnd()

When you stop dragging an element


##### _onSwipeLeft

When one of more fingers perform a swipe to the left (moving along the x-axis where startposition > endposition) 

```js
_onSwipeLeft(recording){ }
```

##### _onSwipeRight

When one of more fingers perform a swipe to the right (moving along the x-axis where startposition < endposition) 

```js
_onSwipeRight(recording){ }
```

##### _onSwipeUp

When one of more fingers perform a swipe up (moving along the y-axis where startposition > endposition) 

```js
_onSwipeUp(recording){ }
```

##### _onSwipeDown

When one of more fingers perform a swipe up (moving along the y-axis where startposition < endposition) 

```js
_onSwipeDown(recording){ }
```

#### Multi-finger swipes

As noted above, the first `parameter` of the method is the `Record` instance, this will enable you to do some extra
calculation based on duration / force / amount of fingers. But sometimes you want to listen to (in example) a `swipeLeft`
but only if the `gestures` was performed by 2 fingers.

To prevent this pattern:

```js
_onSwipeLeft(recording){ 
    if(recording.fingersTouched === 2){
        // execute some logic
    }
}
```

the library provides an swipe event for multiple finger count:
`swipe + finger count + direction`

##### _onSwipe2fLeft()

This will be invoked when 2 fingers perform a swipe left on a certain `Component` (could als be a `Page`)

```js
_onSwipe2fLeft(recording){ }
```

##### _onSwipe4Up()

This will be invoked when 4 fingers perform a swipe up.

```js
_onSwipe4Up(recording){ }
```


##### _onSwipe8right()

This will be invoked when 8 fingers perform a swipe to the right

```js
_onSwipe8right(recording){ }
```

#### Invocation order

There is a certain order of invocation; The engine will first to call the multi finger event 
before falling back to default version. 

So if you perform a swipe up with 4 fingers the engine will first try to invoke `swipe4fUp` and if it's not being
handled by any `Component` it will try to invoke `swipeUp`. This enables you to extract logic for a certain multi-finger gesture.

---

## Available methods

##### start()

Start automotive touch engine. `app` is a reference to a `Lightning.Component` instance
that will be the `parent` which the children will be tested for collision detection against
different points.

`config` is a settings object that can hold different [automotive settings](#platform-settings)

```js
Automotive.start(app, config)
```

##### block()

Prevent one or more [events](#available-events) from being called on touched `Component`s 

```js
// block one
Automotive.block('_onSingleTap')

// block multiple
Automotive.block(['_onMultiTap', '_onLongpress'])
```

#### release()

Allow one or more [events](#available-events) to be called again if they're currently blocked.

```js
// release one
Automotive.release('_onMultiTap')

// release multiple
Automotive.release(['_onSingleTap', '_onLongpress'])
```

##### lock()

Place one or more [events](#available-events) on a `whitelist`. If this list.size > 0 we only allow those events 
to pass-through, if the list is empty we allow all events again (unless they're blocked)

```js
// block one
Automotive.lock('_onDoubleTap')

// block multiple
Automotive.lock(['_onSwipeLeft', '_onSwipeRight'])
```

#### unlock()

Remove one or more [events](#available-events) from the `whitelist`. if the list is empty we allow all events again 
(unless they're blocked)

```js
// release one
Automotive.unlock('_onSwipeLeft')

// release multiple
Automotive.unlock(['_onDoubleTap', '_onSwipeRight'])
```

#### createVector(x, y)

Will return a new `Vector` instance to do additional vector calculation.

```js
const center = Automotive.createVector( 960, 540 )
```

#### distance(v1, v2)

A small helper function that returns the distance between 2 vectors

```js
const dis = Automotive.distance(finger.start, finger.end);
```

#### smoothstep(min, max, value)

Perform interpolation between 2 values

```js
// returns 0.5
const v = Automotive.smoothstep(0.0, 0.8, 0.4)
```

#### getHorizontalForce(finger)

Return the force which the finger did during the last swipe in the same direction along the x-axis. 
by dividing the traveled distance between the swipe duration. For performance reasons
we only store the last 70 positions per finger.


```js
const force = Automotive.getHorizontalForce(finger);
```

#### getVerticalForce(finger)

Return the force which the finger did during the last swipe in the same direction along the y-axis. 
by dividing the traveled distance between the swipe duration. For performance reasons
we only store the last 70 positions per finger.


```js
const force = Automotive.getVerticalForce(finger);
```

## Automotive settings:


##### bridgeCloseTimeout

The amount of milliseconds we keep the 'bridge' open for new new fingers to touch
the screen. All touches within the list while the bridge is open will be recorded.


##### tapDelay
Max Amount of milliseconds between touchstart / end to be flagged


##### doubleTapActive

Flag if the Ui needs to listen to `doubleTap` (the benefit for disabling is a more snappy Ui since a tap can immediately be invoked)

##### beforeDoubleTapDelay

Max amount of milliseconds that a touchstart can start after a tap flag to be flagged as a double tap

##### doubleTapMaxDistance

Max distance between 2 taps to be flagged as double tap

##### externalTouchScreen

Are you using an external touchscreen. This feature has been specially added for beetronics screens
under OSX.

##### componentBlockBroadcast

Define if components an block global events by adding it to itself as class member

##### flagAsHoldDelay

Amount of milliseconds that need to be passed to start flagging recording as a hold; for drag / pinch / long hold

##### swipeXTreshold

Minimal amount of pixel one or more fingers need to travel before it's gets recognized as a swipe along the x-axis

##### swipeYTreshold

Minimal amount of pixel one or more fingers need to travel before it's gets recognized as a swipe along the y-axis

##### touchQueueMaxLength

Amount of position vectors we store during finger (pointer) movement, a higher number will lead to better precision. 
Defaults to `70`

##### maxForce

For force calculation (i.e `getHorizontalForce()`) we divide the `distance` a finger has traveled by the 
`duration` between the first and last `touchQueue` element. Due to duration calculation and the fact that
a finger needs to make a small movement to be flagged as `moving`, it's possible that we end up with swipe `distace` of `0 pixels`
and a short duration. In this situation we return the `maxForce`

##### maxZeroDistanceDuration

Sets the `duration` a zero-distance gesture can take to be flagged and return `maxForce`


##### example

```js
const settings = {
    bridgeCloseTimeout: 110,
    tapDelay: 120,
    doubleTapActive: true,
    beforeDoubleTapDelay: 180,
    flagAsHoldDelay: 800,
    doubleTapMaxDistance: 40,
    externalTouchScreen: false,
    componentBlockBroadcast: true,
    swipeXTreshold: 30,
    swipeYTreshold: 30,
    viewportOffsetX: 0,
    viewportOffsetY: 57,
    touchQueueMaxLength: 80,
    maxForce: 10,
    maxZeroDistanceDuration: 50
}
```


---