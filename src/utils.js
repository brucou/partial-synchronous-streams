// NOTE : this is a copy, get it from latest version of rx-component-combinator
import {
  addIndex, all, allPass, both, curry, defaultTo, difference, either, equals, flatten, flip,
  intersection, isEmpty, isNil, keys, map, mapObjIndexed, pipe, reduce, reduced, reject, uniq,
  values, where
} from "ramda"
import * as Rx from "rx"
import toHTML from "snabbdom-to-html"
import { StandardError } from "standard-error"
import formatObj from "fmt-obj"

const $ = Rx.Observable;
const mapIndexed = addIndex(map);
export const ERROR_MESSAGE_PREFIX = 'ERROR : '

// Type checking typings
/**
 * @typedef {String} ErrorMessage
 */
/**
 * @typedef {Boolean|Array<ErrorMessage>} SignatureCheck
 * Note : The booleam can only be true
 */

// Component typings
/**
 * @typedef {String} SourceName
 */
/**
 * @typedef {String} SinkName
 */
/**
 * @typedef {Observable} Source
 */
/**
 * @typedef {Observable|Null} Sink
 */
/**
 * @typedef {Object.<string, Source>} Sources
 */
/**
 * @typedef {Object.<string, Sink>} Sinks
 */
/**
 * @typedef {?Object.<string, ?Object>} Settings
 */
/**
 * @typedef {function(Sink, Array<Sink>, Settings):Sink} mergeSink
 */
/**
 * @typedef {Object} DetailedComponentDef
 * @property {?function(Sources, Settings)} makeLocalSources
 * @property {?function(Settings)} makeLocalSettings
 * @property {?function(Sources, Settings):Sinks} makeOwnSinks
 * @property {Object.<SinkName, mergeSink> | function} mergeSinks
 * @property {function(Sinks):Boolean} sinksContract
 * @property {function(Sources):Boolean} sourcesContract
 */
/**
 * @typedef {Object} ShortComponentDef
 * @property {?function(Sources, Settings)} makeLocalSources
 * @property {?function(Settings)} makeLocalSettings
 * @property {?function(Sources, Settings):Sinks} makeOwnSinks
 * @property {function(Component, Array<Component>, Sources, Settings)}
 * computeSinks
 * @property {function(Sinks):Boolean} sinksContract
 * @property {function(Sources):Boolean} sourcesContract
 */
/**
 * @typedef {function(Sources, Settings):Sinks} Component
 */

///////
// Helpers

/**
 * Throws an exception if the arguments parameter fails at least one
 * validation rule
 * Note that all arguments are mandatory, i.e. the function does not deal with
 * optional arguments
 * @param {String} fnName
 * @param {Array<*>} _arguments
 * @param {[Array<Object.<string, Predicate|PredicateWithError>>]} vRules
 * Validation rules.
 *
 * Given f(x, y) =  x + y, with x both int, in the body of `f`, include
 * function f(x, y) {
   *   assertSignature ('f', arguments, [{x:isInteger},{y:isInteger}],
   *                  'one of the parameters is not an integer!')
   *   ...
   * }
 */
function assertSignature(fnName, _arguments, vRules) {
  const argNames = flatten(map(keys, vRules))
  const ruleFns = flatten(map(function (vRule) {
    return values(vRule)[0]
  }, vRules))

  const args = mapIndexed(function (vRule, index) {
    return _arguments[index]
  }, vRules)

  const validatedArgs = mapIndexed((value, index) => {
    const ruleFn = ruleFns[index]
    return ruleFn(value)
  }, args)

  const hasFailed = reduce((acc, value) => {
    return isFalse(value) || acc
  }, false, validatedArgs)

  if (hasFailed) {
    const validationMessages = mapIndexed((errorMessageOrBool, index) => {
        const argName = argNames[index]

        return isTrue(errorMessageOrBool) ?
          '' :
          [
            `${fnName}: argument ${argName} fails rule ${vRules[index][argName].name}`,
            isBoolean(errorMessageOrBool) ? '' : errorMessageOrBool
          ].join(': ')
      }, validatedArgs
    ).join('\n')

    const errorMessage = ['assertSignature:', validationMessages].join(' ')
    throw errorMessage
  }

  return !hasFailed
}

function assertSignatureContract(fnName, args, signatureDef) {
  let isContractFailing = false
  const argChecks = mapIndexed((paramStruct, index) => {
    const paramName = keys(paramStruct)[0]
    const [paramContract, contractErrorMessage] = paramStruct[paramName]
    if (isTrue(paramContract.call(null, args[index]))) {
      // contract is fulfilled
      return true
    }
    else {
      isContractFailing = true
      return `${paramName} fails contract ${paramContract.name} : ${contractErrorMessage}`
    }
  }, signatureDef)

  if (isContractFailing) {
    const errorMessages = map(
      boolOrErrorMessage => isString(boolOrErrorMessage) ? boolOrErrorMessage : ""
      , argChecks)
      .join('\n')

    throw `${fnName} called with unexpected or erroneous arguments! \n ${errorMessages}`
  }


}

/**
 * Test against a predicate, and throws an exception if the predicate
 * is not satisfied
 * @param {function(*): (Boolean|String)} contractFn Predicate that must be
 * satisfy. Returns true if predicate is satisfied, otherwise return a
 * string to report about the predicate failure
 * @param {Array<*>} contractArgs
 * @param {String} errorMessage
 * @returns {Boolean}
 * @throws
 */
function assertContract(contractFn, contractArgs, errorMessage) {
  const boolOrError = contractFn.apply(null, contractArgs)
  const isPredicateSatisfied = isBoolean(boolOrError) && boolOrError;

  if (!isPredicateSatisfied) {
    void 0;
    throw `assertContract: fails contract ${contractFn.name}\n${errorMessage}\n ${boolOrError}`
  }
  return true
}

/**
 * Returns:
 * - `true` if the object passed as parameter passes all the predicates on
 * its properties
 * - an array with the concatenated error messages otherwise
 * @param obj
 * @param {Object.<string, Predicate>} signature
 * @param {Object.<string, string>} signatureErrorMessages
 * @param {Boolean=false} isStrict When `true` signals that the object
 * should not have properties other than the ones checked for
 * @returns {Boolean | Array<String>}
 */
function checkSignature(obj, signature, signatureErrorMessages, isStrict) {
  let arrMessages = [];
  let strict = !!isStrict;

  // Check that object properties in the signature match it
  mapObjIndexed((predicate, property) => {
    if (!predicate(obj[property])) {
      arrMessages.push(signatureErrorMessages[property])
    }
  }, signature);

  // Check that object properties are all in the signature if strict is set
  if (strict) {
    mapObjIndexed((value, property) => {
      if (!(property in signature)) {
        arrMessages.push(`Object cannot contain a property called ${property}`)
      }
    }, obj)
  }

  return isEmpty(arrMessages) ? true : arrMessages
}

/**
 * Returns an object whose keys :
 * - the first key found in `obj` for which the matching predicate was
 * fulfilled. Predicates are tested in order of indexing of the array.
 * - `_index` the index in the array where a predicate was fulfilled if
 * any, undefined otherwise
 * Ex : unfoldObjOverload('DOM', {sourceName: isString, predicate:
    * isPredicate})
 * Result : {sourceName : 'DOM'}
 * @param obj
 * @param {Array<Object.<string, Predicate>>} overloads
 * @returns {{}}
 */
function unfoldObjOverload(obj, overloads) {
  let result = {};
  let index = 0;

  overloads.some(overload => {
    // can only be one property
    const property = keys(overload)[0];
    const predicate = values(overload)[0];
    const predicateEval = predicate(obj);

    if (predicateEval) {
      result[property] = obj;
      result._index = index
    }
    index++;

    return predicateEval
  });
  return result
}

/**
 * Returns true iff the parameter is a boolean whose value is false.
 * This hence does both type checking and value checking
 * @param obj
 * @returns {boolean}
 */
function isFalse(obj) {
  return isBoolean(obj) ? !obj : false
}

/**
 * Returns true iff the parameter is a boolean whose value is false.
 * This hence does both type checking and value checking
 * @param obj
 * @returns {boolean}
 */
function isTrue(obj) {
  return isBoolean(obj) ? obj : false
}

function isMergeSinkFn(obj) {
  return isFunction(obj)
}

/**
 * Returns true iff the passed parameter is null or undefined OR a POJO
 * @param {Object} obj
 * @returns {boolean}
 */
function isNullableObject(obj) {
  // Note that `==` is used instead of `===`
  // This allows to test for `undefined` and `null` at the same time
  return obj == null || typeof obj === 'object'
}

/**
 *
 * @param obj
 * @returns {SignatureCheck}
 */
function isNullableComponentDef(obj) {
  // Note that `==` is used instead of `===`
  // This allows to test for `undefined` and `null` at the same time

  return isNil(obj) || checkSignature(obj, {
      makeLocalSources: either(isNil, isFunction),
      makeLocalSettings: either(isNil, isFunction),
      makeOwnSinks: either(isNil, isFunction),
      mergeSinks: mergeSinks => {
        if (obj.computeSinks) {
          return !mergeSinks
        }
        else {
          return either(isNil, either(isObject, isFunction))(mergeSinks)
        }
      },
      computeSinks: either(isNil, isFunction),
      checkPreConditions: either(isNil, isFunction),
      checkPostConditions: either(isNil, isFunction),
    }, {
      makeLocalSources: 'makeLocalSources must be undefined or a function',
      makeLocalSettings: 'makeLocalSettings must be undefined or a' +
      ' function',
      makeOwnSinks: 'makeOwnSinks must be undefined or a function',
      mergeSinks: 'mergeSinks can only be defined when `computeSinks` is' +
      ' not, and when so, it must be undefined, an object or a function',
      computeSinks: 'computeSinks must be undefined or a function',
      checkPreConditions: 'checkPreConditions must be undefined or a function',
      checkPostConditions: 'checkPostConditions must be undefined or a function'
    }, true)
}

function isUndefined(obj) {
  return typeof obj === 'undefined'
}

function isFunction(obj) {
  return typeof(obj) === 'function'
}

function isObject(obj) {
  return typeof(obj) === 'object'
}

function isBoolean(obj) {
  return typeof(obj) === 'boolean'
}

function isOneOf(strList) {
  return function (obj) {
    return isString(obj) && strList.indexOf(obj) !== -1
  }
}

function isString(obj) {
  return typeof(obj) === 'string'
}

function isArray(obj) {
  return Array.isArray(obj)
}

function isEmptyArray(obj) {
  return allPass([isEmpty, isArray])(obj);
}

/**
 * Returns a function which returns true if its parameter is an array,
 * and each element of the array satisfies a given predicate
 * @param {function(*):Boolean} predicateFn
 * @returns {function():Boolean}
 */
function isArrayOf(predicateFn) {
  if (typeof predicateFn !== 'function') {
    throw 'isArrayOf: predicateFn is not a function!!'
  }

  return function _isArrayOf(obj) {
    if (!Array.isArray(obj)) {
      return false
    }

    return all(predicateFn, obj)
  }
}

function isVNode(obj) {
  return ["children", "data", "elm", "key", "sel", "text"]
    .every(prop => prop in obj)
}

/**
 *
 * @param {Predicate} predicateKey
 * @param {Predicate} predicateValue
 * @returns {Predicate}
 * @throws when either predicate is not a function
 */
function isHashMap(predicateKey, predicateValue) {
  assertContract(isFunction, [predicateKey], 'isHashMap : first argument must be a' +
    ' predicate function!');
  assertContract(isFunction, [predicateValue], 'isHashMap : second argument must be a' +
    ' predicate function!');

  return both(
    pipe(keys, all(predicateKey)),
    pipe(values, all(predicateValue))
  );
}

/**
 * check that an object :
 * - does not have any extra properties than the expected ones (strictness)
 * - that its properties follow the defined specs
 * Note that if a property is optional, the spec must include that case
 * @param {Object.<String, Predicate>} recordSpec
 * @returns {Predicate}
 * @throws when recordSpec is not an object
 *
 * Example :
 * - isStrictRecordOf({a : isNumber, b : isString})({a:1, b:'2'}) -> true
 * - isStrictRecordOf({a : isNumber, b : isString})({a:1, b:'2', c:3}) -> false
 * - isStrictRecordOf({a : isNumber, b : isString})({a:1, b:2}) -> false
 */
function isStrictRecord(recordSpec) {
  assertContract(isObject, [recordSpec], 'isStrictRecord : record specification argument must be' +
    ' a valid object!');

  return allPass([
      // 1. no extra properties, i.e. all properties in obj are in recordSpec
      // return true if recordSpec.keys - obj.keys is empty
      pipe(keys, flip(difference)(keys(recordSpec)), isEmpty),
      // 2. the properties in recordSpec all pass their corresponding predicate
      // pipe(obj => mapR(key => recordSpec[key](obj[key]), keys(recordSpec)), all(identity)),
      where(recordSpec)
    ]
  )
}

/**
 * Returns true iff the parameter `obj` represents a component.
 * @param obj
 * @returns {boolean}
 */
function isComponent(obj) {
  // Without a type system, we just test that it is a function
  return isFunction(obj)
}

function isObservable(obj) {
  // duck typing in the absence of a type system
  return isFunction(obj.subscribe)
}

function isSource(obj) {
  return isObservable(obj)
}

function isSources(obj) {
  // We check the minimal contract which is not to be nil
  // In `cycle`, sources can have both regular
  // objects and observables (sign that the design could be improved).
  // Regular objects are injected dependencies (DOM, router?) which
  // are initialized in the drivers, and should be separated from
  // `sources`. `sources` could then have an homogeneous type which
  // could be checked properly
  return !isNil(obj)
}

function isOptSinks(obj) {
  // obj can be null
  return !obj || all(either(isNil, isObservable), values(obj))
}

function isArrayOptSinks(arrSinks) {
  return all(isOptSinks, arrSinks)
}

/**
 *
 * @param {Array<>} predicatesFn An array of predicates which must all be satisfied for the
 * check to pass, together with an error message in the form of a string for when the predicate
 * fails.
 * Those error messages are accumulated, the `errorMessage` is appended to them, and the
 * concatenation of those errors strings is returned.
 * @param {String} errorMessage
 * @returns {Function} function which returns a boolean or an error message string
 */
function checkAndGatherErrors(predicatesFn, errorMessage) {
  return function (...args) {
    let hasFailed = false;
    const accErrorMessages = reduce((acc, [predicateFn, _errorMessage]) => {
      const validationResultOrError = predicateFn.apply(predicateFn, args);

      if (isTrue(validationResultOrError)) {
        return acc
      }
      else {
        // Case when the predicate returns an error message - which can be empty
        _errorMessage && acc.push(_errorMessage);
        acc.push(`Predicate ${predicateFn.name} failed with arguments : ${formatArrayObj(args, ', ')}`)
        validationResultOrError && acc.push(validationResultOrError);
        hasFailed = true;
        return reduced(acc)
      }
    }, [], predicatesFn);

    if (!hasFailed) {
      // no errors - all checks passed
      return true
    }
    else {
      errorMessage && accErrorMessages.unshift(errorMessage);
      return accErrorMessages.join('\n')
    }
  }
}

/**
 * Cf. isStrictRecord. Adds the error messages accumulation aspect.
 * @param recordSpec
 */
function isStrictRecordE(recordSpec) {
  assertContract(isObject, [recordSpec], 'isStrictRecordE : record specification argument must' +
    ' be a valid object!');

  return allPassE([
      // 1. no extra properties, i.e. all properties in obj are in recordSpec
      // return true if recordSpec.keys - obj.keys is empty
      [
        pipe(keys, flip(difference)(keys(recordSpec)), isEmpty),
        `isStrictRecordE : unexpected properties were found on object! Object should have only have properties within a configured fixed set of properties : ${keys(recordSpec)}!`
      ],
      // 2. the properties in recordSpec all pass their corresponding predicate
      // pipe(obj => mapR(key => recordSpec[key](obj[key]), keys(recordSpec)), all(identity)),
      [
        whereE(recordSpec),
        `isStrictRecordE : At least one property of object failed its predicate!`
      ]
    ]
    , `isStrictRecordE > allPassE : fails!`)

}

const allPassE = checkAndGatherErrors;

function whereE(recordSpec) {
  // RecordSpec :: HashMap<Key, Predicate>
  const _keys = keys(recordSpec);

  return function whereE(...args) {

    const result = reduce((acc, key) => {
      const predicate = recordSpec[key];
      const arg = args[0];
      const booleanOrErrorMessage = predicate(arg[key]);

      if (isTrue(booleanOrErrorMessage)) {
        return acc
      }
      else {
        acc.push(`whereE : property ${key} fails predicate ${predicate.name}`);
        booleanOrErrorMessage && acc.push(`${booleanOrErrorMessage}`);

        return acc
      }
    }, [], _keys);

    return result.length === 0
      ? true
      : result.join('\n')
  }
}

/**
 * Test against a left predicate. If that predicate passes, returns true. Otherwise tests
 * against the right predicate. If that predicate passes, returns true. Otherwise, returns an
 * error message which is the concatenation of the possible error messages returned by the
 * left and right predicates
 * @param leftValidation
 * @param rightValidation
 * @returns {function(*) : Boolean | String}
 */
function eitherE(leftValidation, rightValidation) {
  return function (...args) {
    let errorMessages = [];

    const [leftPredicate, leftErrorMessage] = leftValidation;
    const [rightPredicate, rightErrorMessage] = rightValidation;
    const leftValidationResultOrMessage = leftPredicate.apply(leftPredicate, args);
    const rightValidationResultOrMessage = rightPredicate.apply(rightPredicate, args);

    if (isTrue(leftValidationResultOrMessage)) {
      return true
    }
    else {
      // left predicate fails -> check right predicate
      if (isTrue(rightValidationResultOrMessage)) {
        return true
      }
      else {
        errorMessages.push(`eitherE : both predicates (${leftPredicate.name}, ${rightPredicate.name}) failed! One of them must pass!`);
        leftErrorMessage && errorMessages.push('left: ' + leftErrorMessage);
        leftValidationResultOrMessage && errorMessages.push('left : ' + leftValidationResultOrMessage);
        rightErrorMessage && errorMessages.push('right: ' + rightErrorMessage);
        rightValidationResultOrMessage && errorMessages.push('right : ' + rightValidationResultOrMessage);

        return errorMessages.join('\n')
      }
    }
  }
}

/**
 * Cf. isHashMap. Decorates isHashMap with validation error messages
 * @param {Predicate} predicateKey
 * @param {Predicate} predicateValue
 * @returns {Predicate}
 * @throws when either predicate is not a function
 */
function isHashMapE(predicateKey, predicateValue) {
  assertContract(isFunction, [predicateKey], 'isHashMapE : first argument must be a' +
    ' predicate function!');
  assertContract(isFunction, [predicateValue], 'isHashMapE : second argument must be a' +
    ' predicate function!');

  return allPassE([
    [pipe(keys, allE(predicateKey)), `isHashMapE : at least one property key of the object failed its predicate!`],
    [pipe(values, allE(predicateValue)), `isHashMapE : at least one property's value of the object failed its predicate!`]
  ], null);
}

/**
 * Decorate `R.all` from ramda with validation error messages
 * @param predicate
 */
function allE(predicate) {
  return function (...args) {
    const arrayOfValues = args[0] || [];

    const result = reduce((acc, value) => {
      const booleanOrErrorMessage = predicate(value);

      if (isTrue(booleanOrErrorMessage)) {
        return acc
      }
      else {
        acc.push(`allE : predicate ${predicate.name} fails with arguments : ${format(value)}`);
        booleanOrErrorMessage && acc.push(booleanOrErrorMessage);
        return acc
      }
    }, [], arrayOfValues)

    return result.length === 0
      ? true
      : result.join('\n')
  }
}

function assertSourcesContracts([sources, settings], sourcesContract) {
  // Check sources contracts
  assertContract(isSources, [sources],
    'm : `sources` parameter is invalid');
  assertContract(sourcesContract, [sources, settings], 'm: `sources, settings`' +
    ' parameters fails contract ' + sourcesContract.name);
}

function assertSinksContracts(sinks, sinksContract) {
  assertContract(isOptSinks, [sinks],
    'mergeSinks must return a hash of observable sink');
  assertContract(sinksContract, [sinks],
    'fails custom contract ' + sinksContract.name);
}

function assertSettingsContracts(mergedSettings, settingsContract) {
  // Check settings contracts
  assertContract(settingsContract, [mergedSettings], 'm: `settings`' +
    ' parameter fails contract ' + settingsContract.name);
}

// from https://github.com/substack/deep-freeze/blob/master/index.js
function deepFreeze(o) {
  Object.freeze(o);

  Object.getOwnPropertyNames(o).forEach(function (prop) {
    if (o.hasOwnProperty(prop)
      && o[prop] !== null
      && (typeof o[prop] === "object" || typeof o[prop] === "function")
      && !Object.isFrozen(o[prop])) {
      deepFreeze(o[prop]);
    }
  });

  return o;
}

function makeErrorMessage(errorMessage) {
  return ERROR_MESSAGE_PREFIX + errorMessage;
}

/**
 * Adds `tap` logging/tracing information to all sinks
 * @param {Sinks} sinks
 * @returns {*}
 */
function trace(sinks) {
  // TODO BRC
  // return traceSinks(sinks)
  return sinks
}

function removeNullsFromArray(arr) {
  return reject(isNil, arr)
}

function removeEmptyVNodes(arrVNode) {
  return reduce((accNonEmptyVNodes, vNode) => {
    return (isNullVNode(vNode)) ?
      accNonEmptyVNodes :
      (accNonEmptyVNodes.push(vNode), accNonEmptyVNodes)
  }, [], arrVNode)
}

function isNullVNode(vNode) {
  return equals(vNode.children, []) &&
    equals(vNode.data, {}) &&
    isUndefined(vNode.elm) &&
    isUndefined(vNode.key) &&
    isUndefined(vNode.sel) &&
    isUndefined(vNode.text)
}

/**
 * For each element object of the array, returns the indicated property of
 * that object, if it exists, null otherwise.
 * For instance, `projectSinksOn('a', obj)` with obj :
 * - [{a: ..., b: ...}, {b:...}]
 * - result : [..., null]
 * @param {String} prop
 * @param {Array<*>} obj
 * @returns {Array<*>}
 */
function projectSinksOn(prop, obj) {
  return map(x => x ? x[prop] : null, obj)
}

/**
 * Returns an array with the set of sink names extracted from an array of
 * sinks. The ordering of those names should not be relied on.
 * For instance:
 * - [{DOM, auth},{DOM, route}]
 * results in ['DOM','auth','route']
 * @param {Array<Sinks>} aSinks
 * @returns {Array<String>}
 */
function getSinkNamesFromSinksArray(aSinks) {
  return uniq(flatten(map(getValidKeys, aSinks)))
}

function getValidKeys(obj) {
  let validKeys = []
  mapObjIndexed((value, key) => {
    if (value != null) {
      validKeys.push(key)
    }
  }, obj)

  return validKeys
}

/**
 * Turns a sink which is empty into a sink which emits `Null`
 * This is necessary for use in combination with `combineLatest`
 * As a matter of fact, `combineLatest(obs1, obs2)` will block till both
 * observables emit at least one value. So if `obs2` is empty, it will
 * never emit anything
 * @param sink
 * @returns {Observable|*}
 */
function emitNullIfEmpty(sink) {
  return isNil(sink) ?
    null :
    $.merge(
      sink,
      sink.isEmpty().filter(x => x).map(x => null)
    )
}

function makeDivVNode(x) {
  return {
    "children": undefined,
    "data": {},
    "elm": undefined,
    "key": undefined,
    "sel": "div",
    "text": x
  }
}

function _handleError(msg, e) {
  console.error(`${msg}`, e);
  throw e;
}

const handleError = curry(_handleError);

//IE workaround for lack of function name property on Functions
//getFunctionName :: (* -> *) -> String
const getFunctionName = (r => fn => {
  return fn.name || ((('' + fn).match(r) || [])[1] || 'Anonymous');
})(/^\s*function\s*([^\(]*)/i);

// cf.
// http://stackoverflow.com/questions/9479046/is-there-any-non-eval-way-to-create-a-function-with-a-runtime-determined-name
function NamedFunction(name, args, body, scope, values) {
  if (typeof args == "string")
    values = scope, scope = body, body = args, args = [];
  if (!Array.isArray(scope) || !Array.isArray(values)) {
    if (typeof scope == "object") {
      var keys = Object.keys(scope);
      values = keys.map(function (p) { return scope[p]; });
      scope = keys;
    } else {
      values = [];
      scope = [];
    }
  }
  return Function(scope, "function " + name + "(" + args.join(", ") + ") {\n" + body + "\n}\nreturn " + name + ";").apply(null, values);
}

// decorateWith(decoratingFn, fnToDecorate), where log :: fn -> fn such as both have same name
// and possibly throw exception if that make sense to decoratingFn
function decorateWithOne(decoratorSpec, fnToDecorate) {
  const fnToDecorateName = getFunctionName(fnToDecorate);

  return NamedFunction(fnToDecorateName, [], `
      const args = [].slice.call(arguments);
      const decoratingFn = makeFunctionDecorator(decoratorSpec);
      return decoratingFn(args, fnToDecorateName, fnToDecorate);
`,
    { makeFunctionDecorator, decoratorSpec, fnToDecorate, fnToDecorateName });
}

const decorateWith = curry(function decorateWith(decoratingFnsSpecs, fnToDecorate) {
  return decoratingFnsSpecs.reduce((acc, decoratingFn) => {
    return decorateWithOne(decoratingFn, acc)
  }, fnToDecorate)
});

/**
 * NOTE : incorrect declaration... TODO : correct one day
 * before(fnToDecorate, fnToDecorateName, args) or nil
 * after(fnToDecorate, fnToDecorateName, result) or nil
 * but not both nil
 * @returns {function(fnToDecorate: Function, fnToDecorateName:String, args:Array<*>)}
 */
function makeFunctionDecorator({ before, after, name }) {
  // we can have one of the two not specified, but if we have none, there is no decorator to make
  if ((typeof before !== 'function') && (typeof after !== 'function')) {
    throw `makeFunctionDecorator: you need to specify 'before' OR 'after' as decorating functions. You passed falsy values for both!`
  }

  const decoratorFnName = defaultTo('anonymousDecorator', name);

  // trick to get the same name for the returned function
  // cf.
  // http://stackoverflow.com/questions/9479046/is-there-any-non-eval-way-to-create-a-function-with-a-runtime-determined-name
  const obj = {
    [decoratorFnName](args, fnToDecorateName, fnToDecorate) {
      before && before(args, fnToDecorateName, fnToDecorate);

      const result = fnToDecorate(...args);

      return after
        ? after(result, fnToDecorateName, fnToDecorate)
        : result;
    }
  };

  return obj[decoratorFnName];
}

const assertFunctionContractDecoratorSpecs = fnContract => ({
  before: (args, fnToDecorateName) => {
    const checkDomain = fnContract.checkDomain;
    const contractFnName = getFunctionName(checkDomain);
    const passed = checkDomain(...args);

    if (!isBoolean(passed) || (isBoolean(passed) && !passed)) {
      // contract is failed
      console.error(`assertFunctionContractDecorator: ${fnToDecorateName} fails contract ${contractFnName} \n
${isString(passed) ? passed : ''}`);
      throw `assertFunctionContractDecorator: ${fnToDecorateName} fails contract ${contractFnName}`
    }
  },
  after: (result, fnToDecorateName) => {
    const checkCodomain = fnContract.checkCodomain;
    const contractFnName = getFunctionName(checkCodomain);
    const passed = checkCodomain(result);

    if (!isBoolean(passed) || (isBoolean(passed) && !passed)) {
      // contract is failed
      console.error(`assertFunctionContractDecorator: ${fnToDecorateName} fails contract ${contractFnName} \n
${isString(passed) ? passed : ''}`);
      throw `assertFunctionContractDecorator: ${fnToDecorateName} fails contract ${contractFnName}`
    }

    return result;
  }
});

const logFnTrace = (title, paramSpecs) => ({
  before: (args, fnToDecorateName) =>
    console.info(`==> ${title.toUpperCase()} | ${fnToDecorateName}(${paramSpecs.join(', ')}): `, args),
  after: (result, fnToDecorateName) => {
    console.info(`<== ${title.toUpperCase()} | ${fnToDecorateName} <- `, result);
    return result
  },
});

function convertVNodesToHTML(vNodeOrVnodes) {
  if (isArray(vNodeOrVnodes)) {
    console.debug(`toHTML: ${vNodeOrVnodes.map(x => x ? toHTML(x) : null)}`)
    return vNodeOrVnodes.map(x => x ? toHTML(x) : null)
  }
  else {
    console.debug(`toHTML: ${toHTML(vNodeOrVnodes)}`)
    return toHTML(vNodeOrVnodes)
  }
}

function preventDefault(ev) {
  if (ev) ev.preventDefault()
}

function isOptional(predicate) {
  return function (obj) {
    return isNil(obj) ? predicate(obj) : true
  }
}

function hasNoDuplicateKeys(objA, objB) {
  const objAkeys = keys(objA);
  const objBkeys = keys(objB);

  return (objAkeys.length === 0 || objBkeys.length === 0)
    ? true // if objA or objB is empty, then there is no duplicate
    : (intersection(objAkeys, objBkeys).length === 0)
}

function hasNoCommonValues(eventSinkNames, childrenSinkNames) {
  return intersection(eventSinkNames, childrenSinkNames).length === 0
}

function isNewKey(obj, key) {
  return keys(obj).indexOf(key) === -1
}

function formatArrayObj(arr, separator) {
  return arr.map(format).join(separator)
}

function format(obj) {
  // basically if obj is an object, use formatObj, else use toString
  if (isObject(obj)) {
    return formatObj(obj)
  }
  else {
    return "" + obj
  }
}

function addPrefix(prefix) {
  return function (str) {
    return prefix + str
  }
}

function noop() {

}

/**
 * Returns a function which turns an object to be put at a given path location into an array of
 * JSON patch operations
 * @param {JSON_Pointer} path
 * @returns {Function}
 */
function toJsonPatch(path) {
  return pipe(
    mapObjIndexed((value, key) => ({
      op: "add",
      path: [path, key].join('/'),
      value: value
    })),
    values
  );
}

export {
  makeDivVNode,
  handleError,
  assertSignature,
  assertSignatureContract,
  assertContract,
  checkSignature,
  unfoldObjOverload,
  projectSinksOn,
  getSinkNamesFromSinksArray,
  removeNullsFromArray,
  removeEmptyVNodes,
  emitNullIfEmpty,
  isNullableObject,
  isNullableComponentDef,
  isHashMap,
  isStrictRecord,
  isComponent,
  isUndefined,
  isFunction,
  isVNode,
  isOptional,
  isObject,
  isBoolean,
  isOneOf,
  isTrue,
  isString,
  isArray,
  isEmptyArray,
  isArrayOf,
  isObservable,
  isSource,
  isOptSinks,
  isMergeSinkFn,
  isArrayOptSinks,
  checkAndGatherErrors,
  isStrictRecordE,
  allPassE,
  whereE,
  isHashMapE,
  allE,
  eitherE,
  assertSourcesContracts,
  assertSinksContracts,
  assertSettingsContracts,
  deepFreeze,
  makeErrorMessage,
  trace,
  getFunctionName,
  decorateWithOne,
  decorateWith,
  makeFunctionDecorator,
  assertFunctionContractDecoratorSpecs,
  logFnTrace,
  convertVNodesToHTML,
  preventDefault,
  formatArrayObj,
  format,
  addPrefix,
  noop,
  hasNoDuplicateKeys,
  hasNoCommonValues,
  isNewKey,
  toJsonPatch
}
