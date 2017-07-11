# Description
We introduce here a library for manipulating what we call partial synchronous pull streams. Such streams, are characterized by :

- having an infinitely countable sequence of values
- which are ordered
- must be accessed in that order
- values are retrieved synchronously
- there exists a zero value (also referred to as `NO_OUTPUT`) to indicate that the stream value is not defined - think about the stream as producing values of type `Maybe T`. As the stream does not always produce a non-zero value, it is called partial, reusing the same terminology used for partial functions, which are functions that are not defined for all possible values of the specified type.

Such streams can be denoted as usual by $(x_i)_{i\in\mathbb{N}}$. Here follows some examples of partial streams, and some operations which can be defined on them :

| Partial stream |   |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- |
| nosig | -- | -- | -- | -- | -- | -- | -- | -- |
| x       | $x_0$|  -- | -- | $x_3$ | -- | -- | -- |
| y       | -- |  -- | $y_2$ | $y_3$ | -- | $y_5$ | -- |
| merge x y | -- |  -- | $y_2$ | $x_3$ | -- | $y_5$ | -- |
| next x | -- |  -- | $x_3$ | -- | -- | -- | -- |

Note that `--` denotes the zero value of the partial stream.

Partial streams naturally include total streams. Here follow similar examples :

| Total stream |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- |
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
| --- | --- | --- | --- | --- | --- | --- |
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

The displaying could be handled like this :

```
function step(timestamp) {
  if (!start) start = timestamp;
  const progress = timestamp - start;

  displayedDOM.pull();
  const controlState = displayedDOM.get().controlState;
  // If there is no changes in the displayed message, no need to do anything
  if (controlState === NEW) {
    console.log('updating DOM');
    element.innerHTML = displayedDOM.get().output;
  }

  if (progress < 5000) {// silly conditions to stop at some point (5s)
    window.requestAnimationFrame(step);
  }
}

window.requestAnimationFrame(step);
```

# API
## Constructors
### fromFn(fn, settings)
#### Description
Constructs and returns an object from which a value of the constructed synchronous stream can be read (idempotent read), and generated. The constructed synchronous streams has for `i`th value the value returned by the `i`th call of the generating function. The constructed object (which we will refer to as iterator in what follows) has two properties :

- `get` from which the current value of the stream defined in the object can be retrieved
- `pull` from which the object computes and stores the next value of the stream

Note that it is possible to define a `DONE` value to indicate termination of the producing process for the stream. When a generating function `fn` has computed a  `DONE` value, the corresponding iterator will no longer evaluate the function `fn` and systematically returns `DONE` for any subsequent call to `pull`.

The same applies when an error is thrown when computing `fn`. The iterator will pass an output with a control state set to `ERROR`, and a value which encodes the raised exception. The iterator will systematically return `ERROR` outputs for any subsequent pulls.

Caching
:    If `pull` is called twice or more on the same iterator and the associated generating function returns the same value the control state for the output of such iterator will be `SAME`. While the function was still evaluated, this serves to avoid downstream recomputation based on the same input values.

#### Types
The following signature applies :

- `fromFn :: ( () -> T ) -> Nullable Settings -> Iterator`

where :

- `Settings :: Record {`
- `  fn :: () -> T`  *(mandatory)*
- `  done :: String`
- `  equals :: T -> T -> Boolean`
- `}`

- `Iterator :: Record {`
- `  get :: () -> IteratorOutput`
- `  pull :: () -> ()`
- `}`

- `IteratorOutput :: Record {`
- `  controlState :: STATES`
- `  output :: T`
- `}`

- `STATES :: NEW | SAME  | DONE | ERROR `

### fromBehavior(behavior, settings)
#### Description
Constructs and returns an object from which a value of the constructed synchronous stream can be read (idempotent read), and generated. The constructed synchronous streams has for `i`th value the current value of the associated behaviour at the time of the `i`th pull. The constructed object (which we will refer to as iterator in what follows) has two properties :

- `get` from which the current value of the stream defined in the object can be retrieved
- `pull` from which the object computes and stores the next value of the stream

Note that when the behavior emits a `DONE` message, i.e. terminates, the corresponding iterator will systematically returns `DONE` for any subsequent call to `pull`.
The same behavior holds when the behavior emits an `ERROR` message.

Caching
:    If `pull` is called twice or more on the same iterator while no messages were emitted by the associated behavior, the control state for the output of such iterator will be `SAME` for all `pull` call after the first one. There is no further computation beyond retrieving and passing on the value from the cache.

#### Types
The following signature applies :

- `fromBehavior :: Behavior -> Nullable Settings -> Iterator`
- no use is made as of now of `Settings`

## Combinators
### map
#### Description
Maps a synchronous streams to another one, applying pointwise a mapping function.

Caching
:    If subsequent pulls shows a repetition of the output from the source iterator, the cached value is reused, and no recomputation is performed.

#### Types
The following signature applies :

- `map :: Iterator -> (T -> U) -> Iterator`

### combine

#### Description
Compute a synchronous streams from an array of synchronous streams by applying point-wise a combining function.

Caching
:    If subsequent pulls shows a repetition of the output from the source iterators, the cached value is reused, and no recomputation is performed.

#### Types
The following signature applies :

- `combine :: (... -> T)-> [Iterator] -> Iterator`

# Tests
Tests are in the test directory, and are run in the browser with QUnit.

```
npm run build node test
npm run test
```

then open `test-index.html` in your favorite local webserver.

# References
[Uustalu T., Vene V. (2006) The Essence of Dataflow Programming.](https://link.springer.com/chapter/10.1007/11894100_5)
