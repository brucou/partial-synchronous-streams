# Description
We introduce here a library for manipulating what we call partial synchronous pull streams. Such as streams, are characterized by :

- having an infinitely countable sequence of values
- which are ordered
- must be accessed in that order
- values are retrieved synchronously
- there exists a zero value (also referred to as `NO_OUTPUT`) to indicate that the stream value is not defined - think about the stream as producing values of type `Maybe T`. As the stream does not always produce a non-zero value, it is called partial, reusing the same terminology used for partial functions, which are functions that are not defined for all possible values of the specified type.

Such streams can be denoted as usual by $(x_i)_{i\in\mathbb{N}}$. Here follows some examples of partial streams, and some operations which can be defined on them :

| Partial stream |  |  |  |  |  |  | 
| -- | -- | -- | -- | -- | -- | -- | -- 
| nosig | -- | -- | -- | -- | -- | -- | -- | -- |
| x       | $x_0$|  -- | -- | $x_3$ | -- | -- | -- |
| y       | -- |  -- | $y_2$ | $y_3$ | -- | $y_5$ | -- |
| merge x y | -- |  -- | $y_2$ | $x_3$ | -- | $y_5$ | -- |
| next x | -- |  -- | $x_3$ | -- | -- | -- | -- |

Note that `--` denotes the zero value of the partial stream.

Partial streams naturally include total streams. Here follow similar examples :
| Total stream |  |  |  |  |  |  | 
| -- | -- | -- | -- | -- | -- | -- | -- 
| x       | $x_0$|  $x_1$ | $x_2$ | $x_3$ | $x_4$ | $x_5$ 
| y       | $y_0$|  $y_1$ | $y_2$ | $y_3$ | $y_4$ | $y_5$ 
| x fby y | $x_0$ |  $y_1$ | $y_2$ | $y_3$ | $y_4$ | $y_5$ 
| next x | $x_1$ | $x_2$ | $x_3$ | $x_4$ | $x_5$ | $x_6$

With the `fby` operator (followed-by) , one can write many useful recursive definitions where the recursive calls are guarded by `fby` and there is no real circularity. Below are some classic examples of such feedback through a delay.

```
pos = 0 fby pos + 1
sum x = x + (0 fby sum x)
diff x = x - (0 fby x)
ini x = x fby ini x
fact = 1 fby (fact * (pos + 1))
fibo = 0 fby (fibo + (1 fby fibo))
```

| Total stream |  |  |  |  |  |  | 
| -- | -- | -- | -- | -- | -- | -- | -- 
| pos       | 0 |1 | 2 | 3 | 4 | 5 
| sum pos   | 0 |1 | 3 | 6 | 10 | 15 
| diff pos   | 0 |1 | 1 | 1 | 1 | 1
| ini pos   | 0 | 0 | 0 | 0 | 0 | 0
| fact   | 1 | 1 | 2 | 6 | 24 | 120
| fibo   | 0 | 1 | 1 | 2 | 3 | 5

Partial streams are used in synchronous dataflow languages such as Lustre or Lucid Synchrome, designed for programming embedded reactive systems -- such as automatic control and monitoring systems -- as well as for describing hardware.  The reason behind that is that different signals may be on different clocks. Viewed as signals on the fastest (base) clock, they are not defined at every instant. They are only defined at those instants of the base clock that are also instants of their own clocks.

In the present library, streams are not extensionally constructed (which is impossible as the stream is countably infinite), but intensionally constructed, via the computational properties that they satisfy. A series of constructors will be presented in the remainder of the document.

The present library additionally enhance the partial streams with the following characteristics :
- stateful ability to cache previous computation
- using that cache to minimize the computational effort for deciding the next value

# Motivation
User-interfaces can be commonly expressed as reactive systems and implemented as such by expliciting the dataflows between the inputs and the outputs of the system.
When the output device is a screen, with a given clock frequency, the reactive nature of the system can lead to an oversampling when the input device frequency is significantly above the frequency of the output device (i.e. producing more updates that what can actually be processed by the device). The resulting unnecessary computations are a source of inefficiency that can in some cases adversely affect the real-time requirement of some applications.

To eliminate oversampling, a first strategy is to sample for inputs at the frequency of the output device. This however introduces another problem. In the cases when the input device has no changes in inputs for some large amount of time, we introduce inefficiencies related to sampling 'for nothing', and performing the same computation at every clock.

The experimented-on second strategy proposed here is to use partial synchronous pull streams, endowed with caching abilities, so that when inputs are recognized as not having changed, the associated computations are not performed but retrieved from the cache.

There are other, less generic strategies, which use what is known about the problem at hand (in particular throttling the inputs whose frequency of change is largely above that of the output device). Those strategies are out of scope of the present document.

# Example
Let's consider the case of a window which can be resized, and an application which displayed some messages which depends on the size of that window. The following dataflow holds :

![dataflow](http://i.imgur.com/9ZOhWxp.png)

The computation of the view displayed in the DOM is as follows :
- as the user resizes the window, the type of screen is computed
	- it can be either determined to be a desktop, mobile or tablet
- as the user presses keys on the keyboard
  - a username is build up from the concatenation of the pressed keys
 - from those two entities, the message to be displayed on screen is computed

Legend
:    orange boxes : synchronous pull streams 
:    yellow boxed : (reactive) events or behaviors

The corresponding implementation using the library would go as follows : 

```javascript
function getWindowHeight() {return window.innerHeight}
function getWindowWidth() {return window.innerWidth}

const height = fromFn(getWindowHeight);
const width = fromFn(getWindowWidth);

const screenType = combine((height, width) => {
  if (height / width > 1 / 2 && width > 280) {
    return DESKTOP
  }
  else if (height / width > 1 / 2 && width <= 280) {
    return TABLET
  }
  else return MOBILE
}, [height, width]);

const username$ = Rx.Observable.fromEvent(document.body, 'keypress')
  .map(evt => evt.keyCode || evt.which)
  .scan(...); // accumulate the pressed keys
  .startWith('');
  
const username = fromBehavior(username$);
const displayedDOM = combine((screenType, username) => {
  return `
  screen type : ${screenType} <br>
  user name : ${username}<br>
  `
}, [screenType, username]);
```

| First Header  | Second Header |
| ------------- | ------------- |
| Content Cell  | Content Cell  |
| Content Cell  | Content Cell  |

# API
## Constructors
### fromBehavior(behavior, settings)
fromFn

## Combinators
map
combine





Variable : value changing over time in uncontrolled ways
Behaviour/Signal : value changing over time in predefined ways

Class structure
- getValue
  - synchronous method

Constructors
- new Behavior (behaviorSubject, initialValue)
  - new Behavior (Rx.BehaviorSubject, initialValue)
- new Behaviour (eventSource)
  - new Behaviour (curry(someElement.addEventListener)('click'), initialValue)
- new Behaviour (observable)
  - new Behaviour (anyObs$, initialValue)
    - basically is `anyObs$.shareReplay(1)` but with an initial value
- new Behaviour (function)
  - new Behaviour (() => DOM.getElementById(someId).value)
  - new Behaviour (() => Math.random())
  - new Behaviour (() => window.someProperty)
  - new Behaviour ([deps], ([deps]) => someFunction(deps), initialValue)

Combinators
- combine :: Array<Behavior> -> CombineFn -> Behavior
- map :: Behavior -> Fn -> Behavior

I don't think there is any other operators possible, with this definition, as you only have one 
operation possible on the behaviour. So any other operators would be a combination of those two.

Active Behaviour/Signal : value changing over time in predefined ways, AND signalling changes 
in their values

Class structure
- getValue
  - synchronous method
- subscribe
  - as the active behaviour emits events, there need be a way to subscribe listeners

Constructors :
- new ActiveBehavior (behaviorSubject, initialValue)
  - new ActiveBehavior (Rx.BehaviorSubject, initialValue)
- new Behaviour (eventSource)
  - new Behaviour (curry(someElement.addEventListener)('click'), initialValue)
- new Behaviour (observable, value)
  - new Behaviour (anyObs$, initialValue)
    - basically is `anyObs$.shareReplay(1).startWith(initialValue)` immediately subscribed to

Note that `new Behaviour (function)` constructor disappears. There is no way to observe the 
changes of the value wrapped in the behaviour. We can only request a value. 
Note also that `ActiveBehavior` is both an observable and a `Behavior`

Combinators:
- foldl :: ActiveBehavior -> ReduceFn -> InitialValue -> ActiveBehavior
    - from `foldl`, `map`, filter`, `takeUntil`, `repeat` and a large number of operators can be 
    derived
- most of the standard operators working on observables anyways : we have an observable of change 
events we can manipulate. Just have to make sure we get a behaviour in output. In particular make
 sure we always have an initial value.

In case of the DOM driver/source/sinks:
- In the DOM driver, instead of `Stream<VTree>` we have `Behavior<VTree>`
- that `Behavior<VTree>` is build through the described combinators from the sources
  - for instance converting observables of events to active behaviors
  - for instance combining with other behaviors
- the DOM driver pulls the value from the behaviour at appropriate times as defined by rAF.
- DOM.select(..) can now, in addition to events, return behaviours, such as the content of a form 
field
  - remember how you currently have to duplicate DOM state and listen to every key press to 
  reconciliate your local copy of the field content with the DOM's?

In the general case :
- drivers should know whether they accept behaviours or streams (i.e. event streams), i.e. that 
information is part of their type
- the question is what do drivers output, and that is also going to be dependent on the specific 
driver.
  - DOM driver actually outputs an object, and through some mechanism could generate both event 
  streams, and behaviors (cf. DOM form field example)
  - Random driver could output only a behavior, and not take any input
  - you could also imagine a driver that receives a behavior from `main` and does not output 
  anything (a trace driver for example which accumulate information about the execution of the 
  program)

Last thing, this is obviously a change in semantics to be explicited. Before we had DOM updates 
ACTIONS or REQUESTS going through the DOM driver. Now we have the DOM representation directly 
waiting to be pulled. But that is obvious right, that is precisely the pull/push this thread is 
about.
