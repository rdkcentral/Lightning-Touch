# AutoMotive

## com.metrological.ui.Automotive

### Getting started

> Before you follow the steps below, make sure you have the
[Lightning-CLI](https://rdkcentral.github.io/Lightning-CLI/#/) installed _globally_ only your system

```
npm install -g @lightningjs/cli
```

#### Running the App

1. Install the NPM dependencies by running `npm install`

2. Build the App using the _Lightning-CLI_ by running `lng build` inside the root of your project

3. Fire up a local webserver and open the App in a browser by running `lng serve` inside the root of your project

#### Developing the App

During development you can use the **watcher** functionality of the _Lightning-CLI_.

- use `lng watch` to automatically _rebuild_ your App whenever you make a change in the `src` or  `static` folder
- use `lng dev` to start the watcher and run a local webserver / open the App in a browser _at the same time_

#### Documentation

This Library provides examples on how to build interactivity for a multi-touch touchscreen. The library
records and analyzes all fingers and it's movement ( there seems to be a hard limit in browser that it tacks max 10 fingers)

Once the analyser recognizes a gesture it tries to dispatch that event on one of the active touched elements. De first argument of the function is the `record` instance that holds a lot  of data of the recording
(startposition / duration / data for every finger etc)

### Available events

##### _onSingleTap()

Will be called when one finger quickly touches this element

##### _onMultiTap()

Will be called when mutliple fingers quickly touches this element

##### _onDoubleTap()

When one finger quickly double taps the same element

##### _onLongpress()

Will be invoked if one or more fingers are pressing this element for < 800ms. For  now the recording data holds data for all the fingers so it could be that 3 fingers are touching 3 individual elements they all receive

##### _onDrag()

Will be invoked when you touch an element and start moving your finger

##### _onDragEnd()

When you stop dragging an element

---

### Global events:

Beside the local events described above there are a couple of global events your app can Listen to.

This app uses an **unreleased** version of the Lightning-SDK that contains an `Events` plugin that will become part of a future Lightning-SDK release.

It can be imported into you App as follows:

```js
import { Events } from "@lightningjs/sdk"
```

In any component where you've imported the `Events`-plugin you can _listen_ to different events _broadcasted_ by the touch functionality.

The `Events.listen`-method accepts 3 arguments, `namespace`, `event` and a `callback`-function.

- `namespace` always needs be `App`
- `event` can be any of the events described below (i.e `swipeLeft`, `swipeUp`)
- `callback` needs to be a function that will receive a `recording`-object as it's parameter

##### swipeLeft

```js
Events.listen('App', 'swipeLeft', (recording) => {
    const page = Router.getActivePage();
    page.animation({
        duration: 2, actions: [
            {p: 'x', v: {0: 0, 0.1: -1920, 0.8: -1920, 1: 0}}
        ]
    }).start();    
    this.tag("Label").text = `${recording.fingersTouched} FINGERS SWIPE LEFT`;
});
```

##### swipeRight

```js
Events.listen('App', 'swipeRight', (recording) => { ... });
```

##### swipeUp

```js
Events.listen('App', 'swipeUp', (recording) => { ... });
```

##### swipeDown

```js
Events.listen('App', 'swipeUp', (recording) => { ... });

```

##### pinch

```js
Events.listen('App', 'pinch', ({distance, angle}) => { });

```

##### pinchEnd

```js
Events.listen('App', 'pinchEnd', (recording) => { ... });

```



It's also possible to block the global event by adding the eventname
as a class member to a component as adding `"componentBlockBroadcast": true` to 
the platform settings

### Platform settings:


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