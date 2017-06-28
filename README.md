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
