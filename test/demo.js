import { combine, fromBehavior, fromFn } from "../src/partial_synchronous_streams"
import { STATES } from "../src/properties"
import * as Rx from "rx"

const PULL = 'pull';
const END = 'end';
const ERR = 'some error'
const { NEW, SAME, DONE, ERROR } = STATES;

function getWindowHeight() {return window.innerHeight}
function getWindowWidth() {return window.innerWidth}

const height = fromFn(getWindowHeight);
const width = fromFn(getWindowWidth);
const DESKTOP = 'desktop';
const TABLET = 'tablet';
const MOBILE = 'mobile';

const screenType = combine((height, width) => {
  if (height / width > 1 / 2 && width > 280) {
    return DESKTOP
  }
  else if (height / width > 1 / 2 && width <= 280) {
    return TABLET
  }
  else return MOBILE
}, [height, width]);

const el = document.getElementById('app');
const keysPressed = [];
const keyPressed = Rx.Observable.fromEvent(document.body, 'keypress')
  .map(evt => evt.keyCode || evt.which)
  .startWith('-')
  .do(charCode => keysPressed.push(String.fromCharCode(charCode)));
const displayedMessage = fromBehavior(keyPressed);
const displayedDOM = combine((screenType, keyPressed) => {
  return `
  screen type : ${screenType} <br>
  user name : ${keysPressed.join('')}<br>
  `
}, [screenType, displayedMessage]);

let start = null;
let acc = [];
var element = document.getElementById('app');
element.style.position = 'absolute';
function step(timestamp) {
  if (!start) start = timestamp;
  const progress = timestamp - start;
  displayedDOM.pull();
  const controlState = displayedDOM.get().controlState;
  acc.push(controlState);
  // If there is no changes in the displayed message, no need to do anything
  if (controlState !== SAME) {
    element.innerHTML = displayedDOM.get().output + `<br>${acc.join('<br>')}`
  }

  if (progress < 3000) {
    window.requestAnimationFrame(step);
  }
}
window.requestAnimationFrame(step);
