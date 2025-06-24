/******/ ;(() => {
  // webpackBootstrap
  /*!******************************************!*\
  !*** ./resources/js/painting-options.js ***!
  \******************************************/
  function _typeof(o) {
    '@babel/helpers - typeof'
    return (
      (_typeof =
        'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator
          ? function (o) {
              return typeof o
            }
          : function (o) {
              return o &&
                'function' == typeof Symbol &&
                o.constructor === Symbol &&
                o !== Symbol.prototype
                ? 'symbol'
                : typeof o
            }),
      _typeof(o)
    )
  }
  function _regeneratorRuntime() {
    'use strict'
    /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ _regeneratorRuntime =
      function _regeneratorRuntime() {
        return e
      }
    var t,
      e = {},
      r = Object.prototype,
      n = r.hasOwnProperty,
      o =
        Object.defineProperty ||
        function (t, e, r) {
          t[e] = r.value
        },
      i = 'function' == typeof Symbol ? Symbol : {},
      a = i.iterator || '@@iterator',
      c = i.asyncIterator || '@@asyncIterator',
      u = i.toStringTag || '@@toStringTag'
    function define(t, e, r) {
      return (
        Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }),
        t[e]
      )
    }
    try {
      define({}, '')
    } catch (t) {
      define = function define(t, e, r) {
        return (t[e] = r)
      }
    }
    function wrap(t, e, r, n) {
      var i = e && e.prototype instanceof Generator ? e : Generator,
        a = Object.create(i.prototype),
        c = new Context(n || [])
      return o(a, '_invoke', { value: makeInvokeMethod(t, r, c) }), a
    }
    function tryCatch(t, e, r) {
      try {
        return { type: 'normal', arg: t.call(e, r) }
      } catch (t) {
        return { type: 'throw', arg: t }
      }
    }
    e.wrap = wrap
    var h = 'suspendedStart',
      l = 'suspendedYield',
      f = 'executing',
      s = 'completed',
      y = {}
    function Generator() {}
    function GeneratorFunction() {}
    function GeneratorFunctionPrototype() {}
    var p = {}
    define(p, a, function () {
      return this
    })
    var d = Object.getPrototypeOf,
      v = d && d(d(values([])))
    v && v !== r && n.call(v, a) && (p = v)
    var g = (GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p))
    function defineIteratorMethods(t) {
      ;['next', 'throw', 'return'].forEach(function (e) {
        define(t, e, function (t) {
          return this._invoke(e, t)
        })
      })
    }
    function AsyncIterator(t, e) {
      function invoke(r, o, i, a) {
        var c = tryCatch(t[r], t, o)
        if ('throw' !== c.type) {
          var u = c.arg,
            h = u.value
          return h && 'object' == _typeof(h) && n.call(h, '__await')
            ? e.resolve(h.__await).then(
                function (t) {
                  invoke('next', t, i, a)
                },
                function (t) {
                  invoke('throw', t, i, a)
                }
              )
            : e.resolve(h).then(
                function (t) {
                  ;(u.value = t), i(u)
                },
                function (t) {
                  return invoke('throw', t, i, a)
                }
              )
        }
        a(c.arg)
      }
      var r
      o(this, '_invoke', {
        value: function value(t, n) {
          function callInvokeWithMethodAndArg() {
            return new e(function (e, r) {
              invoke(t, n, e, r)
            })
          }
          return (r = r
            ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg)
            : callInvokeWithMethodAndArg())
        },
      })
    }
    function makeInvokeMethod(e, r, n) {
      var o = h
      return function (i, a) {
        if (o === f) throw Error('Generator is already running')
        if (o === s) {
          if ('throw' === i) throw a
          return { value: t, done: !0 }
        }
        for (n.method = i, n.arg = a; ; ) {
          var c = n.delegate
          if (c) {
            var u = maybeInvokeDelegate(c, n)
            if (u) {
              if (u === y) continue
              return u
            }
          }
          if ('next' === n.method) n.sent = n._sent = n.arg
          else if ('throw' === n.method) {
            if (o === h) throw ((o = s), n.arg)
            n.dispatchException(n.arg)
          } else 'return' === n.method && n.abrupt('return', n.arg)
          o = f
          var p = tryCatch(e, r, n)
          if ('normal' === p.type) {
            if (((o = n.done ? s : l), p.arg === y)) continue
            return { value: p.arg, done: n.done }
          }
          'throw' === p.type && ((o = s), (n.method = 'throw'), (n.arg = p.arg))
        }
      }
    }
    function maybeInvokeDelegate(e, r) {
      var n = r.method,
        o = e.iterator[n]
      if (o === t)
        return (
          (r.delegate = null),
          ('throw' === n &&
            e.iterator['return'] &&
            ((r.method = 'return'),
            (r.arg = t),
            maybeInvokeDelegate(e, r),
            'throw' === r.method)) ||
            ('return' !== n &&
              ((r.method = 'throw'),
              (r.arg = new TypeError("The iterator does not provide a '" + n + "' method")))),
          y
        )
      var i = tryCatch(o, e.iterator, r.arg)
      if ('throw' === i.type) return (r.method = 'throw'), (r.arg = i.arg), (r.delegate = null), y
      var a = i.arg
      return a
        ? a.done
          ? ((r[e.resultName] = a.value),
            (r.next = e.nextLoc),
            'return' !== r.method && ((r.method = 'next'), (r.arg = t)),
            (r.delegate = null),
            y)
          : a
        : ((r.method = 'throw'),
          (r.arg = new TypeError('iterator result is not an object')),
          (r.delegate = null),
          y)
    }
    function pushTryEntry(t) {
      var e = { tryLoc: t[0] }
      1 in t && (e.catchLoc = t[1]),
        2 in t && ((e.finallyLoc = t[2]), (e.afterLoc = t[3])),
        this.tryEntries.push(e)
    }
    function resetTryEntry(t) {
      var e = t.completion || {}
      ;(e.type = 'normal'), delete e.arg, (t.completion = e)
    }
    function Context(t) {
      ;(this.tryEntries = [{ tryLoc: 'root' }]), t.forEach(pushTryEntry, this), this.reset(!0)
    }
    function values(e) {
      if (e || '' === e) {
        var r = e[a]
        if (r) return r.call(e)
        if ('function' == typeof e.next) return e
        if (!isNaN(e.length)) {
          var o = -1,
            i = function next() {
              for (; ++o < e.length; )
                if (n.call(e, o)) return (next.value = e[o]), (next.done = !1), next
              return (next.value = t), (next.done = !0), next
            }
          return (i.next = i)
        }
      }
      throw new TypeError(_typeof(e) + ' is not iterable')
    }
    return (
      (GeneratorFunction.prototype = GeneratorFunctionPrototype),
      o(g, 'constructor', { value: GeneratorFunctionPrototype, configurable: !0 }),
      o(GeneratorFunctionPrototype, 'constructor', { value: GeneratorFunction, configurable: !0 }),
      (GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, 'GeneratorFunction')),
      (e.isGeneratorFunction = function (t) {
        var e = 'function' == typeof t && t.constructor
        return !!e && (e === GeneratorFunction || 'GeneratorFunction' === (e.displayName || e.name))
      }),
      (e.mark = function (t) {
        return (
          Object.setPrototypeOf
            ? Object.setPrototypeOf(t, GeneratorFunctionPrototype)
            : ((t.__proto__ = GeneratorFunctionPrototype), define(t, u, 'GeneratorFunction')),
          (t.prototype = Object.create(g)),
          t
        )
      }),
      (e.awrap = function (t) {
        return { __await: t }
      }),
      defineIteratorMethods(AsyncIterator.prototype),
      define(AsyncIterator.prototype, c, function () {
        return this
      }),
      (e.AsyncIterator = AsyncIterator),
      (e.async = function (t, r, n, o, i) {
        void 0 === i && (i = Promise)
        var a = new AsyncIterator(wrap(t, r, n, o), i)
        return e.isGeneratorFunction(r)
          ? a
          : a.next().then(function (t) {
              return t.done ? t.value : a.next()
            })
      }),
      defineIteratorMethods(g),
      define(g, u, 'Generator'),
      define(g, a, function () {
        return this
      }),
      define(g, 'toString', function () {
        return '[object Generator]'
      }),
      (e.keys = function (t) {
        var e = Object(t),
          r = []
        for (var n in e) r.push(n)
        return (
          r.reverse(),
          function next() {
            for (; r.length; ) {
              var t = r.pop()
              if (t in e) return (next.value = t), (next.done = !1), next
            }
            return (next.done = !0), next
          }
        )
      }),
      (e.values = values),
      (Context.prototype = {
        constructor: Context,
        reset: function reset(e) {
          if (
            ((this.prev = 0),
            (this.next = 0),
            (this.sent = this._sent = t),
            (this.done = !1),
            (this.delegate = null),
            (this.method = 'next'),
            (this.arg = t),
            this.tryEntries.forEach(resetTryEntry),
            !e)
          )
            for (var r in this)
              't' === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t)
        },
        stop: function stop() {
          this.done = !0
          var t = this.tryEntries[0].completion
          if ('throw' === t.type) throw t.arg
          return this.rval
        },
        dispatchException: function dispatchException(e) {
          if (this.done) throw e
          var r = this
          function handle(n, o) {
            return (
              (a.type = 'throw'),
              (a.arg = e),
              (r.next = n),
              o && ((r.method = 'next'), (r.arg = t)),
              !!o
            )
          }
          for (var o = this.tryEntries.length - 1; o >= 0; --o) {
            var i = this.tryEntries[o],
              a = i.completion
            if ('root' === i.tryLoc) return handle('end')
            if (i.tryLoc <= this.prev) {
              var c = n.call(i, 'catchLoc'),
                u = n.call(i, 'finallyLoc')
              if (c && u) {
                if (this.prev < i.catchLoc) return handle(i.catchLoc, !0)
                if (this.prev < i.finallyLoc) return handle(i.finallyLoc)
              } else if (c) {
                if (this.prev < i.catchLoc) return handle(i.catchLoc, !0)
              } else {
                if (!u) throw Error('try statement without catch or finally')
                if (this.prev < i.finallyLoc) return handle(i.finallyLoc)
              }
            }
          }
        },
        abrupt: function abrupt(t, e) {
          for (var r = this.tryEntries.length - 1; r >= 0; --r) {
            var o = this.tryEntries[r]
            if (o.tryLoc <= this.prev && n.call(o, 'finallyLoc') && this.prev < o.finallyLoc) {
              var i = o
              break
            }
          }
          i &&
            ('break' === t || 'continue' === t) &&
            i.tryLoc <= e &&
            e <= i.finallyLoc &&
            (i = null)
          var a = i ? i.completion : {}
          return (
            (a.type = t),
            (a.arg = e),
            i ? ((this.method = 'next'), (this.next = i.finallyLoc), y) : this.complete(a)
          )
        },
        complete: function complete(t, e) {
          if ('throw' === t.type) throw t.arg
          return (
            'break' === t.type || 'continue' === t.type
              ? (this.next = t.arg)
              : 'return' === t.type
                ? ((this.rval = this.arg = t.arg), (this.method = 'return'), (this.next = 'end'))
                : 'normal' === t.type && e && (this.next = e),
            y
          )
        },
        finish: function finish(t) {
          for (var e = this.tryEntries.length - 1; e >= 0; --e) {
            var r = this.tryEntries[e]
            if (r.finallyLoc === t)
              return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y
          }
        },
        catch: function _catch(t) {
          for (var e = this.tryEntries.length - 1; e >= 0; --e) {
            var r = this.tryEntries[e]
            if (r.tryLoc === t) {
              var n = r.completion
              if ('throw' === n.type) {
                var o = n.arg
                resetTryEntry(r)
              }
              return o
            }
          }
          throw Error('illegal catch attempt')
        },
        delegateYield: function delegateYield(e, r, n) {
          return (
            (this.delegate = { iterator: values(e), resultName: r, nextLoc: n }),
            'next' === this.method && (this.arg = t),
            y
          )
        },
      }),
      e
    )
  }
  function ownKeys(e, r) {
    var t = Object.keys(e)
    if (Object.getOwnPropertySymbols) {
      var o = Object.getOwnPropertySymbols(e)
      r &&
        (o = o.filter(function (r) {
          return Object.getOwnPropertyDescriptor(e, r).enumerable
        })),
        t.push.apply(t, o)
    }
    return t
  }
  function _objectSpread(e) {
    for (var r = 1; r < arguments.length; r++) {
      var t = null != arguments[r] ? arguments[r] : {}
      r % 2
        ? ownKeys(Object(t), !0).forEach(function (r) {
            _defineProperty(e, r, t[r])
          })
        : Object.getOwnPropertyDescriptors
          ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t))
          : ownKeys(Object(t)).forEach(function (r) {
              Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r))
            })
    }
    return e
  }
  function _defineProperty(obj, key, value) {
    key = _toPropertyKey(key)
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true,
      })
    } else {
      obj[key] = value
    }
    return obj
  }
  function _toPropertyKey(t) {
    var i = _toPrimitive(t, 'string')
    return 'symbol' == _typeof(i) ? i : i + ''
  }
  function _toPrimitive(t, r) {
    if ('object' != _typeof(t) || !t) return t
    var e = t[Symbol.toPrimitive]
    if (void 0 !== e) {
      var i = e.call(t, r || 'default')
      if ('object' != _typeof(i)) return i
      throw new TypeError('@@toPrimitive must return a primitive value.')
    }
    return ('string' === r ? String : Number)(t)
  }
  function _createForOfIteratorHelper(o, allowArrayLike) {
    var it = (typeof Symbol !== 'undefined' && o[Symbol.iterator]) || o['@@iterator']
    if (!it) {
      if (
        Array.isArray(o) ||
        (it = _unsupportedIterableToArray(o)) ||
        (allowArrayLike && o && typeof o.length === 'number')
      ) {
        if (it) o = it
        var i = 0
        var F = function F() {}
        return {
          s: F,
          n: function n() {
            if (i >= o.length) return { done: true }
            return { done: false, value: o[i++] }
          },
          e: function e(_e) {
            throw _e
          },
          f: F,
        }
      }
      throw new TypeError(
        'Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.'
      )
    }
    var normalCompletion = true,
      didErr = false,
      err
    return {
      s: function s() {
        it = it.call(o)
      },
      n: function n() {
        var step = it.next()
        normalCompletion = step.done
        return step
      },
      e: function e(_e2) {
        didErr = true
        err = _e2
      },
      f: function f() {
        try {
          if (!normalCompletion && it['return'] != null) it['return']()
        } finally {
          if (didErr) throw err
        }
      },
    }
  }
  function _slicedToArray(arr, i) {
    return (
      _arrayWithHoles(arr) ||
      _iterableToArrayLimit(arr, i) ||
      _unsupportedIterableToArray(arr, i) ||
      _nonIterableRest()
    )
  }
  function _nonIterableRest() {
    throw new TypeError(
      'Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.'
    )
  }
  function _unsupportedIterableToArray(o, minLen) {
    if (!o) return
    if (typeof o === 'string') return _arrayLikeToArray(o, minLen)
    var n = Object.prototype.toString.call(o).slice(8, -1)
    if (n === 'Object' && o.constructor) n = o.constructor.name
    if (n === 'Map' || n === 'Set') return Array.from(o)
    if (n === 'Arguments' || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
      return _arrayLikeToArray(o, minLen)
  }
  function _arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length
    for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]
    return arr2
  }
  function _iterableToArrayLimit(r, l) {
    var t =
      null == r ? null : ('undefined' != typeof Symbol && r[Symbol.iterator]) || r['@@iterator']
    if (null != t) {
      var e,
        n,
        i,
        u,
        a = [],
        f = !0,
        o = !1
      try {
        if (((i = (t = t.call(r)).next), 0 === l)) {
          if (Object(t) !== t) return
          f = !1
        } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
      } catch (r) {
        ;(o = !0), (n = r)
      } finally {
        try {
          if (!f && null != t['return'] && ((u = t['return']()), Object(u) !== u)) return
        } finally {
          if (o) throw n
        }
      }
      return a
    }
  }
  function _arrayWithHoles(arr) {
    if (Array.isArray(arr)) return arr
  }
  function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
      var info = gen[key](arg)
      var value = info.value
    } catch (error) {
      reject(error)
      return
    }
    if (info.done) {
      resolve(value)
    } else {
      Promise.resolve(value).then(_next, _throw)
    }
  }
  function _asyncToGenerator(fn) {
    return function () {
      var self = this,
        args = arguments
      return new Promise(function (resolve, reject) {
        var gen = fn.apply(self, args)
        function _next(value) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, 'next', value)
        }
        function _throw(err) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, 'throw', err)
        }
        _next(undefined)
      })
    }
  }
  //Initialize
  function getAllOptions(_x) {
    return _getAllOptions.apply(this, arguments)
  }
  function _getAllOptions() {
    _getAllOptions = _asyncToGenerator(
      /*#__PURE__*/ _regeneratorRuntime().mark(function _callee(aspectRatio) {
        var url, response, data, variants
        return _regeneratorRuntime().wrap(
          function _callee$(_context) {
            while (1)
              switch ((_context.prev = _context.next)) {
                case 0:
                  _context.prev = 0
                  url = aspectRatio
                    ? '/api/paintings/options/'.concat(aspectRatio)
                    : '/api/paintings/options/square'
                  _context.next = 4
                  return fetch(url, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  })
                case 4:
                  response = _context.sent
                  if (response.ok) {
                    _context.next = 7
                    break
                  }
                  throw new Error()
                case 7:
                  _context.next = 9
                  return response.json()
                case 9:
                  data = _context.sent
                  variants = data.json
                  createDomFromVariants(variants)
                  listenPopupInputs()
                  _context.next = 19
                  break
                case 15:
                  _context.prev = 15
                  _context.t0 = _context['catch'](0)
                  console.log('error', _context.t0)
                  createDomFromVariants([])
                case 19:
                case 'end':
                  return _context.stop()
              }
          },
          _callee,
          null,
          [[0, 15]]
        )
      })
    )
    return _getAllOptions.apply(this, arguments)
  }
  function createDomFromVariants(variants) {
    variants.forEach(function (firstLevel) {
      //first level
      var optionElem = addOption(1)
      Object.keys(firstLevel).forEach(function (key) {
        if (key === 'children') return
        setOptionValue(optionElem, key, firstLevel[key])
      })

      //second level
      firstLevel.children.forEach(function (secondLevel) {
        var optionElem = addOption(2)
        Object.keys(secondLevel).forEach(function (key) {
          if (key === 'children') return
          setOptionValue(optionElem, key, secondLevel[key])
        })

        //third level
        secondLevel.children.forEach(function (thirdLevels) {
          var optionElem
          thirdLevels.forEach(function (thirdLevel, i) {
            if (i === 0) optionElem = addOption(3)
            else optionElem = addSiblingOption(optionElem)
            Object.keys(thirdLevel).forEach(function (key) {
              if (key === 'children') return
              setOptionValue(optionElem, key, thirdLevel[key])
            })
          })
        })
      })
    })
  }
  getAllOptions()

  //DOM construction
  function createOptionContainer(level) {
    var template = document.getElementById('option-container')
    var content = template.content
    var clone = content.cloneNode(true)
    var containerOptionElement = clone.querySelector('.option-container')
    containerOptionElement.dataset.level = level
    var marginLeft = 'ml-' + (level - 1) * 10
    containerOptionElement.classList.add(marginLeft)
    if (level === 3) {
      var buttonTemplate = document.getElementById('button-add-sibling-container')
      var buttonContent = buttonTemplate.content
      var buttonClone = buttonContent.cloneNode(true)
      var buttonAddSiblingContainer = buttonClone.querySelector('.button-add-sibling-container')
      containerOptionElement.appendChild(buttonAddSiblingContainer)
    }
    return containerOptionElement
  }
  function getColor(level) {
    switch (level) {
      case 1:
        return 'main'
      case 2:
        return 'cyan-700'
      case 3:
        return 'green-700'
    }
  }
  function createOption(parentContainer) {
    var template = document.getElementById('option')
    var content = template.content
    var clone = content.cloneNode(true)
    var optionElement = clone.querySelector('.option')
    var namePriceElem = optionElement.querySelector('.name-price')
    var buttonAddInfoElem = optionElement.querySelector('.button-add-info')
    var level = Number(parentContainer.dataset.level)
    var background = 'bg-' + getColor(level)
    namePriceElem.classList.add(background)
    buttonAddInfoElem.classList.add('text-' + getColor(level))
    return [optionElement, namePriceElem]
  }
  function createChildOrSiblingButtons(parentContainer) {
    var template = document.getElementById('button-create-child-or-sibling')
    var content = template.content
    var clone = content.cloneNode(true)
    var buttonsWrapper = clone.querySelector('.button-create-child-or-sibling')
    var buttons = buttonsWrapper.querySelectorAll('button')
    var level = Number(parentContainer.dataset.level)
    var color = getColor(level)
    buttons.forEach(function (button) {
      button.classList.add('border-'.concat(color))
      button.classList.add('text-'.concat(color))
      button.classList.add('hover:bg-'.concat(color))
    })
    return buttonsWrapper
  }
  function createSiblingButton(parentContainer) {
    var template = document.getElementById('button-add-sibling')
    var content = template.content
    var clone = content.cloneNode(true)
    var button = clone.querySelector('button')
    var level = Number(parentContainer.dataset.level)
    var color = getColor(level)
    button.classList.add('border-'.concat(color))
    button.classList.add('text-'.concat(color))
    button.classList.add('hover:bg-'.concat(color))
    return button
  }

  //DOM insertion
  function addOption(level, nextContainer) {
    var container = createOptionContainer(level)
    var _createOption = createOption(container),
      _createOption2 = _slicedToArray(_createOption, 2),
      option = _createOption2[0],
      namePrice = _createOption2[1]
    if (level < 3) {
      var buttons = createChildOrSiblingButtons(container)
      namePrice.appendChild(buttons)
    } else {
      var button = createSiblingButton(container)
      namePrice.appendChild(button)
    }
    if (nextContainer) nextContainer.before(container)
    else document.getElementById('wrapper').appendChild(container)
    container.appendChild(option)
    return option
  }
  function addOptionAfter(targetContainer) {
    var level = Number(targetContainer.dataset.level)
    var containers = Array.from(targetContainer.closest('#wrapper').children).filter(
      function (child) {
        return child.classList.contains('option-container')
      }
    )
    var containersAfter = containers.slice(containers.indexOf(targetContainer) + 1)
    var containersAfterSameLevel = containersAfter.filter(function (container) {
      return Number(container.dataset.level) === level
    })
    var nextContainer = containersAfterSameLevel[0]
    if (!nextContainer) {
      var containersAfterPreviousLevel = containersAfter.filter(function (container) {
        return Number(container.dataset.level) === level - 1
      })
      nextContainer = containersAfterPreviousLevel[0]
    }
    if (nextContainer) {
      addOption(level, nextContainer)
    } else {
      addOption(level)
    }
  }
  function addOptionBefore(targetContainer) {
    var level = Number(targetContainer.dataset.level)
    var newlevel = level >= 3 ? 3 : level + 1
    var nextContainer = targetContainer.nextElementSibling
    if (!nextContainer) {
      addOption(newlevel)
      return
    }
    addOption(newlevel, nextContainer)
  }
  function addSiblingOption(targetOption) {
    var container = targetOption.closest('.option-container')
    var _createOption3 = createOption(container),
      _createOption4 = _slicedToArray(_createOption3, 2),
      option = _createOption4[0],
      namePrice = _createOption4[1]
    var button = createSiblingButton(container)
    namePrice.appendChild(button)
    targetOption.after(option)
    return option
  }

  //DOM Removal
  function recursiveRemoveOption(target, nextContainer, baseLevel) {
    var _target$closest
    var targetOption =
      (_target$closest = target.closest('.option')) !== null && _target$closest !== void 0
        ? _target$closest
        : target
    var container = targetOption.closest('.option-container')
    var level = Number(container.dataset.level)
    var nextNextContainer = container.nextElementSibling
    if (!nextNextContainer && nextContainer) {
      nextContainer.remove()
    } else if (
      nextNextContainer &&
      Number(nextNextContainer.dataset.level) >
        (baseLevel !== null && baseLevel !== void 0 ? baseLevel : level)
    ) {
      var nextNextTagetOption = nextNextContainer.querySelector('.option')
      recursiveRemoveOption(
        nextNextTagetOption,
        nextNextContainer,
        baseLevel !== null && baseLevel !== void 0 ? baseLevel : level
      )
      container.remove()
    } else {
      targetOption.remove()
      var otherOptions = Array.from(container.querySelectorAll('.option'))
      if (otherOptions.length === 0) container.remove()
    }
  }
  function removeAllContainer() {
    var containers = getAllContainers()
    containers.forEach(function (container) {
      return container.remove()
    })
  }

  //DOM manipulation
  function adjustWidth(input) {
    var mirrorSpan = input.nextElementSibling
    if (!mirrorSpan || mirrorSpan.nodeName !== 'SPAN') return
    mirrorSpan.textContent = input.value
  }
  function setOptionValue(optionElem, property, value) {
    var input = optionElem.querySelector('input[name="'.concat(property, '"]'))
    if (!input) return
    input.value = value
    adjustWidth(input)
  }

  //Buttons actions
  function addSiblingOptionAction(button) {
    var targetContainer = button.closest('.option-container')
    addOptionAfter(targetContainer)
  }
  function addChildOptionAction(button) {
    var targetContainer = button.closest('.option-container')
    addOptionBefore(targetContainer)
  }
  function addSiblingOptionAction2(button) {
    var targetOption = button.closest('.option')
    addSiblingOption(targetOption)
  }
  function addContainerLevel3Action(button) {
    var container = button.closest('.option-container')
    addOptionBefore(container)
  }
  function copyScript() {
    return _copyScript.apply(this, arguments)
  }
  function _copyScript() {
    _copyScript = _asyncToGenerator(
      /*#__PURE__*/ _regeneratorRuntime().mark(function _callee2() {
        var content
        return _regeneratorRuntime().wrap(
          function _callee2$(_context2) {
            while (1)
              switch ((_context2.prev = _context2.next)) {
                case 0:
                  _context2.prev = 0
                  content = document.getElementById('string-script').textContent
                  _context2.next = 4
                  return navigator.clipboard.writeText(content)
                case 4:
                  _context2.next = 9
                  break
                case 6:
                  _context2.prev = 6
                  _context2.t0 = _context2['catch'](0)
                  console.error('Erreur lors de la copie', _context2.t0)
                case 9:
                case 'end':
                  return _context2.stop()
              }
          },
          _callee2,
          null,
          [[0, 6]]
        )
      })
    )
    return _copyScript.apply(this, arguments)
  }
  function copyLocale() {
    return _copyLocale.apply(this, arguments)
  }
  function _copyLocale() {
    _copyLocale = _asyncToGenerator(
      /*#__PURE__*/ _regeneratorRuntime().mark(function _callee3() {
        var content
        return _regeneratorRuntime().wrap(
          function _callee3$(_context3) {
            while (1)
              switch ((_context3.prev = _context3.next)) {
                case 0:
                  _context3.prev = 0
                  content = document.getElementById('string-locale').textContent
                  _context3.next = 4
                  return navigator.clipboard.writeText(content)
                case 4:
                  _context3.next = 9
                  break
                case 6:
                  _context3.prev = 6
                  _context3.t0 = _context3['catch'](0)
                  console.error('Erreur lors de la copie', _context3.t0)
                case 9:
                case 'end':
                  return _context3.stop()
              }
          },
          _callee3,
          null,
          [[0, 6]]
        )
      })
    )
    return _copyLocale.apply(this, arguments)
  }
  function copyStructuredData() {
    return _copyStructuredData.apply(this, arguments)
  }
  function _copyStructuredData() {
    _copyStructuredData = _asyncToGenerator(
      /*#__PURE__*/ _regeneratorRuntime().mark(function _callee4() {
        var content
        return _regeneratorRuntime().wrap(
          function _callee4$(_context4) {
            while (1)
              switch ((_context4.prev = _context4.next)) {
                case 0:
                  _context4.prev = 0
                  content = document.getElementById('string-structured-data').textContent
                  _context4.next = 4
                  return navigator.clipboard.writeText(content)
                case 4:
                  _context4.next = 9
                  break
                case 6:
                  _context4.prev = 6
                  _context4.t0 = _context4['catch'](0)
                  console.error('Erreur lors de la copie', _context4.t0)
                case 9:
                case 'end':
                  return _context4.stop()
              }
          },
          _callee4,
          null,
          [[0, 6]]
        )
      })
    )
    return _copyStructuredData.apply(this, arguments)
  }
  function saveToDatabase(_x2) {
    return _saveToDatabase.apply(this, arguments)
  }
  function _saveToDatabase() {
    _saveToDatabase = _asyncToGenerator(
      /*#__PURE__*/ _regeneratorRuntime().mark(function _callee5(button) {
        var _document$querySelect
        var json, aspectRatio, response, data
        return _regeneratorRuntime().wrap(
          function _callee5$(_context5) {
            while (1)
              switch ((_context5.prev = _context5.next)) {
                case 0:
                  button.classList.remove('bg-red-600')
                  button.classList.remove('hover:bg-red-700')
                  button.disabled = true
                  button.classList.add('cursor-not-allowed')
                  button.classList.add('bg-green-700')
                  button.querySelector('svg').classList.remove('hidden')
                  button.querySelector('#static-text').classList.add('hidden')
                  button.querySelector('#loading-text').classList.remove('hidden')
                  json = document.getElementById('json-to-save').textContent
                  aspectRatio =
                    (_document$querySelect = document.querySelector(
                      '#aspect-ration-selection button[aria-pressed="true"]'
                    )) === null || _document$querySelect === void 0
                      ? void 0
                      : _document$querySelect.dataset.aspectRatio
                  _context5.prev = 10
                  _context5.next = 13
                  return fetch('/api/paintings/options/store', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      variants: json,
                      aspectRatio: aspectRatio,
                    }),
                  })
                case 13:
                  response = _context5.sent
                  if (response.ok) {
                    _context5.next = 16
                    break
                  }
                  throw new Error()
                case 16:
                  _context5.next = 18
                  return response.json()
                case 18:
                  data = _context5.sent
                  if (!(data.message === 'success')) {
                    _context5.next = 23
                    break
                  }
                  console.log(data)
                  _context5.next = 24
                  break
                case 23:
                  throw new Error()
                case 24:
                  _context5.next = 31
                  break
                case 26:
                  _context5.prev = 26
                  _context5.t0 = _context5['catch'](10)
                  console.log('error', _context5.t0)
                  button.classList.add('bg-red-600')
                  button.classList.add('hover:bg-red-700')
                case 31:
                  _context5.prev = 31
                  button.disabled = false
                  button.classList.remove('cursor-not-allowed')
                  button.classList.remove('bg-green-700')
                  button.querySelector('svg').classList.add('hidden')
                  button.querySelector('#static-text').classList.remove('hidden')
                  button.querySelector('#loading-text').classList.add('hidden')
                  return _context5.finish(31)
                case 39:
                case 'end':
                  return _context5.stop()
              }
          },
          _callee5,
          null,
          [[10, 26, 31, 39]]
        )
      })
    )
    return _saveToDatabase.apply(this, arguments)
  }
  function showInfoPopup(button) {
    var option = button.closest('.option')
    var popup = option.querySelector('.popup-info')
    popup.classList.remove('hidden')
    var color = getColor(Number(option.closest('.option-container').dataset.level))
    popup.classList.add('border-'.concat(color))
    document.body.classList.add('overflow-hidden')
    document.getElementById('overlay').classList.remove('hidden')
    option.querySelector('.popup-title').textContent = option.querySelector('input[name]').value
  }
  function selectAspectRatio(button) {
    var lastButtonSelected = document.querySelector(
      '#aspect-ration-selection button[aria-pressed="true"]'
    )
    lastButtonSelected.setAttribute('aria-pressed', false)
    lastButtonSelected.classList.remove('bg-main')
    lastButtonSelected.classList.replace('text-secondary', 'text-main')
    button.setAttribute('aria-pressed', true)
    button.classList.add('bg-main')
    button.classList.replace('text-main', 'text-secondary')
    removeAllContainer()
    var aspectRatio = button.dataset.aspectRatio
    getAllOptions(aspectRatio)
  }

  //Listeners
  function triggerAfterChangement() {
    var targetNode = document.getElementById('wrapper')
    var config = {
      childList: true,
      subtree: true,
    }
    function callback(mutationsList, observer) {
      var _iterator = _createForOfIteratorHelper(mutationsList),
        _step
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done; ) {
          var mutation = _step.value
          if (mutation.type === 'childList') {
            var _createArrayFromOptio = createArrayFromOptions(),
              _createArrayFromOptio2 = _slicedToArray(_createArrayFromOptio, 2),
              optionsArray = _createArrayFromOptio2[0],
              optionsArrayTranslated = _createArrayFromOptio2[1]
            createJSONToCopied(optionsArray)
            createScriptToCopied(optionsArrayTranslated)
            createLocale(optionsArray)
            createStructuredDataToCopied(optionsArray)
          }
        }
      } catch (err) {
        _iterator.e(err)
      } finally {
        _iterator.f()
      }
    }
    var observer = new MutationObserver(callback)
    observer.observe(targetNode, config)
  }
  triggerAfterChangement()
  function listenPopupInputs() {
    document.querySelectorAll('.popup-info input').forEach(function (input) {
      input.addEventListener('input', function (e) {
        var _createArrayFromOptio3 = createArrayFromOptions(),
          _createArrayFromOptio4 = _slicedToArray(_createArrayFromOptio3, 2),
          optionsArray = _createArrayFromOptio4[0],
          optionsArrayTranslated = _createArrayFromOptio4[1]
        createJSONToCopied(optionsArray)
        createScriptToCopied(optionsArrayTranslated)
        createLocale(optionsArray)
        createStructuredDataToCopied(optionsArray)
      })
    })
  }
  document.getElementById('overlay').addEventListener('click', function (e) {
    document.getElementById('overlay').classList.add('hidden')
    document.querySelector('.popup-info:not(.hidden)').classList.add('hidden')
    document.body.classList.remove('overflow-hidden')
  })

  //Dom to Array
  function createArrayFromOptions() {
    var containers = getAllContainers()
    var options = []
    var optionsTranslated = []
    containers.forEach(function (container) {
      var level = Number(container.dataset.level)
      if (level === 1) {
        var _getOptionValues = getOptionValues(container),
          _getOptionValues2 = _slicedToArray(_getOptionValues, 2),
          optionValues = _getOptionValues2[0],
          optionValuesTranslated = _getOptionValues2[1]
        var topObject = createParentObject(optionValues)
        var topObjectTranslated = createParentObject(optionValuesTranslated)
        options.push(topObject)
        optionsTranslated.push(topObjectTranslated)
      } else if (level === 2) {
        var _topObject = options[options.length - 1]
        var _topObjectTranslated = optionsTranslated[optionsTranslated.length - 1]
        var _getOptionValues3 = getOptionValues(container),
          _getOptionValues4 = _slicedToArray(_getOptionValues3, 2),
          _optionValues = _getOptionValues4[0],
          _optionValuesTranslated = _getOptionValues4[1]
        var childObject = createParentObject(_optionValues)
        var childObjecttranslated = createParentObject(_optionValuesTranslated)
        _topObject.children.push(childObject)
        _topObjectTranslated.children.push(childObjecttranslated)
      } else {
        var _childObject =
          options[options.length - 1].children[options[options.length - 1].children.length - 1]
        _childObject.children = _childObject.children || []
        var _childObjecttranslated =
          optionsTranslated[optionsTranslated.length - 1].children[
            optionsTranslated[optionsTranslated.length - 1].children.length - 1
          ]
        _childObjecttranslated.children = _childObjecttranslated.children || []
        var _getAllOptionValues = getAllOptionValues(container),
          _getAllOptionValues2 = _slicedToArray(_getAllOptionValues, 2),
          optionValuesList = _getAllOptionValues2[0],
          optionValuesListTranslated = _getAllOptionValues2[1]
        _childObject.children.push(optionValuesList)
        _childObjecttranslated.children.push(optionValuesListTranslated)
      }
    })
    return [options, optionsTranslated]
  }
  function getAllContainers() {
    var wrapper = document.getElementById('wrapper')
    var containers = Array.from(wrapper.querySelectorAll('.option-container'))
    return containers
  }
  function getOptionValues(option) {
    var inputs = option.querySelectorAll('input')
    var values = {}
    var valuesTranslated = {}
    inputs.forEach(function (input) {
      values[input.name] = isNaN(input.value) ? input.value : Number(input.value)
      var translatedValue =
        input.name === 'technicalType' || input.name === 'technicalName'
          ? input.value
          : translateName(input.value)
      valuesTranslated[input.name] = isNaN(translatedValue)
        ? translatedValue
        : Number(translatedValue)
    })
    return [values, valuesTranslated]
  }
  function getAllOptionValues(container) {
    var options = Array.from(container.querySelectorAll('.option'))
    var values = options.map(function (option) {
      return getOptionValues(option)[0]
    })
    var valuesTranslated = options.map(function (option) {
      return getOptionValues(option)[1]
    })
    return [values, valuesTranslated]
  }
  function createParentObject(optionValues) {
    var topObject = _objectSpread(
      _objectSpread({}, optionValues),
      {},
      {
        children: [],
      }
    )
    return topObject
  }
  function translateName(name) {
    if (!isNaN(name)) return name
    var nameWithoutSpace = name.replace(/\s/g, '_')
    var nameWithoutSpecialChar = nameWithoutSpace.replace(/[^\w\s]/gi, '')
    var nameInLowerCase = nameWithoutSpecialChar.toLowerCase()
    return "{{ 'localeImported.".concat(nameInLowerCase, "' | t }}")
  }

  //Create JSON
  function createJSONToCopied(optionsArray) {
    var json = optionsArrayToJSON(optionsArray)
    document.getElementById('json-to-save').textContent = json
    return optionsArray
  }
  function optionsArrayToJSON(arr) {
    return JSON.stringify(arr)
  }

  //Create Script
  function createScriptToCopied(optionsArray) {
    var stringScript = optionsArrayToStringScript(optionsArray)
    document.getElementById('string-script').textContent = stringScript
  }
  function optionsArrayToStringScript(arr) {
    return '\n  <script id="variants-available">\n    window.variants = '.concat(
      JSON.stringify(arr),
      ';\n    window.moneySymbol = "{{ localization.country.currency.symbol }}";\n  </script>\n  '
    )
  }

  // Create Locale
  function createLocale(optionsArray) {
    var uniqueValues = extractUniqueValues(optionsArray)
    var locale = {}
    uniqueValues.forEach(function (value) {
      var valueWithoutSpace = value.replace(/\s/g, '_')
      var valueWithoutSpecialChar = valueWithoutSpace.replace(/[^\w\s]/gi, '')
      var valueInLowerCase = valueWithoutSpecialChar.toLowerCase()
      locale[valueInLowerCase] = value
    })
    document.getElementById('string-locale').textContent = '"localeImported":'.concat(
      JSON.stringify(locale)
    )
  }
  function extractUniqueValues(optionsArray) {
    var uniqueValues = new Set()
    optionsArray.forEach(function (option) {
      Object.keys(option).forEach(function (key) {
        if (
          key !== 'children' &&
          key !== 'technicalName' &&
          key !== 'technicalType' &&
          isNaN(option[key])
        )
          uniqueValues.add(option[key])
        else if (key === 'children') {
          option[key].forEach(function (child) {
            Object.keys(child).forEach(function (childKey) {
              if (
                childKey !== 'children' &&
                childKey !== 'technicalName' &&
                childKey !== 'technicalType' &&
                isNaN(child[childKey])
              )
                uniqueValues.add(child[childKey])
              else if (childKey === 'children') {
                child[childKey].forEach(function (grandChildArray) {
                  grandChildArray.forEach(function (grandChildObject) {
                    Object.keys(grandChildObject).forEach(function (grandChildKey) {
                      if (
                        grandChildKey !== 'children' &&
                        grandChildKey !== 'technicalName' &&
                        grandChildKey !== 'technicalType' &&
                        isNaN(grandChildObject[grandChildKey])
                      )
                        uniqueValues.add(grandChildObject[grandChildKey])
                    })
                  })
                })
              }
            })
          })
        }
      })
    })
    return uniqueValues
  }

  //Create Structured Data
  function createStructuredDataToCopied(optionsArray) {
    var structuredDataArr = optionsArrayToStructuredData(optionsArray)
    var stringScript = structuredDataToString(structuredDataArr)
    document.getElementById('string-structured-data').textContent = stringScript
  }
  function optionsArrayToStructuredData(arr) {
    var structuredDataArr = []
    arr.forEach(function (size) {
      size.children.forEach(function (marerial) {
        var structuredData = '\n        {\n          "@type": "Offer",\n          "price": '.concat(
          size.price + marerial.price,
          ',\n          "priceCurrency": {{ cart.currency.iso_code | json }},\n          "availability": "http://schema.org/InStock",\n          "url" : {{ request.origin | append: product.url | json }},\n          "seller": {\n              "@type": "Organization",\n              "name": {{ product.vendor | json }}\n          },\n          "hasMerchantReturnPolicy": {\n              "@type": "MerchantReturnPolicy",\n              "returnPolicyCategory": "/pages/conditions-generales-de-vente-1",\n              "merchantReturnDays": "14",\n              "returnMethod": "http://schema.org/ReturnByMail"\n          }\n        }\n        '
        )
        structuredDataArr.push(structuredData)
      })
    })
    return structuredDataArr
  }
  function structuredDataToString(arr) {
    return '\n  <script type="application/ld+json">\n    {\n      "@context": "http://schema.org/",\n      "@type": "Product",\n      "@id": {{ request.origin | append: product.url | json }},\n      "name": {{ product.title | json }},\n      "logo": "https://cdn.shopify.com/s/files/1/0623/2388/4287/files/logo-myselfmonart.svg?v=1727019678",\n      "url": {{ request.origin | append: product.url | json }},\n      {% if product.metafields.link.mother_collection.value.title != blank %}\n        "category": {{ product.metafields.link.mother_collection.value.title | json }},\n      {% endif %}\n      {% if seo_media %}\n        "image": [{{ seo_media | image_url: width: seo_media.preview_image.width | prepend: "https:" | json }}],\n      {% endif %}\n      "description": {{ product.description | strip_html | json }},\n      "brand": {\n        "@type": "Brand",\n        "name": {{ product.vendor | json }}\n      },\n      {%- if reviews_structured_data != blank -%}\n        {{ reviews_structured_data }},\n      {%- endif -%}\n      "offers": ['.concat(
      arr,
      ']\n    }\n  </script>\n  '
    )
  }

  // Exports
  window.adjustWidth = adjustWidth
  window.addSiblingOptionAction = addSiblingOptionAction
  window.addChildOptionAction = addChildOptionAction
  window.recursiveRemoveOption = recursiveRemoveOption
  window.addSiblingOptionAction2 = addSiblingOptionAction2
  window.addContainerLevel3Action = addContainerLevel3Action
  window.copyScript = copyScript
  window.saveToDatabase = saveToDatabase
  window.copyLocale = copyLocale
  window.showInfoPopup = showInfoPopup
  window.selectAspectRatio = selectAspectRatio
  window.copyStructuredData = copyStructuredData

  //tailwindcss, don't remove
  //bg-main
  //bg-cyan-700
  //ml-10
  //ml-20
  /******/
})()
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFpbnRpbmctb3B0aW9ucy5qcyIsIm1hcHBpbmdzIjoiOzs7OzsrQ0FDQSxxSkFBQUEsbUJBQUEsWUFBQUEsb0JBQUEsV0FBQUMsQ0FBQSxTQUFBQyxDQUFBLEVBQUFELENBQUEsT0FBQUUsQ0FBQSxHQUFBQyxNQUFBLENBQUFDLFNBQUEsRUFBQUMsQ0FBQSxHQUFBSCxDQUFBLENBQUFJLGNBQUEsRUFBQUMsQ0FBQSxHQUFBSixNQUFBLENBQUFLLGNBQUEsY0FBQVAsQ0FBQSxFQUFBRCxDQUFBLEVBQUFFLENBQUEsSUFBQUQsQ0FBQSxDQUFBRCxDQUFBLElBQUFFLENBQUEsQ0FBQU8sS0FBQSxLQUFBQyxDQUFBLHdCQUFBQyxNQUFBLEdBQUFBLE1BQUEsT0FBQUMsQ0FBQSxHQUFBRixDQUFBLENBQUFHLFFBQUEsa0JBQUFDLENBQUEsR0FBQUosQ0FBQSxDQUFBSyxhQUFBLHVCQUFBQyxDQUFBLEdBQUFOLENBQUEsQ0FBQU8sV0FBQSw4QkFBQUMsT0FBQWpCLENBQUEsRUFBQUQsQ0FBQSxFQUFBRSxDQUFBLFdBQUFDLE1BQUEsQ0FBQUssY0FBQSxDQUFBUCxDQUFBLEVBQUFELENBQUEsSUFBQVMsS0FBQSxFQUFBUCxDQUFBLEVBQUFpQixVQUFBLE1BQUFDLFlBQUEsTUFBQUMsUUFBQSxTQUFBcEIsQ0FBQSxDQUFBRCxDQUFBLFdBQUFrQixNQUFBLG1CQUFBakIsQ0FBQSxJQUFBaUIsTUFBQSxZQUFBQSxPQUFBakIsQ0FBQSxFQUFBRCxDQUFBLEVBQUFFLENBQUEsV0FBQUQsQ0FBQSxDQUFBRCxDQUFBLElBQUFFLENBQUEsZ0JBQUFvQixLQUFBckIsQ0FBQSxFQUFBRCxDQUFBLEVBQUFFLENBQUEsRUFBQUcsQ0FBQSxRQUFBSyxDQUFBLEdBQUFWLENBQUEsSUFBQUEsQ0FBQSxDQUFBSSxTQUFBLFlBQUFtQixTQUFBLEdBQUF2QixDQUFBLEdBQUF1QixTQUFBLEVBQUFYLENBQUEsR0FBQVQsTUFBQSxDQUFBcUIsTUFBQSxDQUFBZCxDQUFBLENBQUFOLFNBQUEsR0FBQVUsQ0FBQSxPQUFBVyxPQUFBLENBQUFwQixDQUFBLGdCQUFBRSxDQUFBLENBQUFLLENBQUEsZUFBQUgsS0FBQSxFQUFBaUIsZ0JBQUEsQ0FBQXpCLENBQUEsRUFBQUMsQ0FBQSxFQUFBWSxDQUFBLE1BQUFGLENBQUEsYUFBQWUsU0FBQTFCLENBQUEsRUFBQUQsQ0FBQSxFQUFBRSxDQUFBLG1CQUFBMEIsSUFBQSxZQUFBQyxHQUFBLEVBQUE1QixDQUFBLENBQUE2QixJQUFBLENBQUE5QixDQUFBLEVBQUFFLENBQUEsY0FBQUQsQ0FBQSxhQUFBMkIsSUFBQSxXQUFBQyxHQUFBLEVBQUE1QixDQUFBLFFBQUFELENBQUEsQ0FBQXNCLElBQUEsR0FBQUEsSUFBQSxNQUFBUyxDQUFBLHFCQUFBQyxDQUFBLHFCQUFBQyxDQUFBLGdCQUFBQyxDQUFBLGdCQUFBQyxDQUFBLGdCQUFBWixVQUFBLGNBQUFhLGtCQUFBLGNBQUFDLDJCQUFBLFNBQUFDLENBQUEsT0FBQXBCLE1BQUEsQ0FBQW9CLENBQUEsRUFBQTFCLENBQUEscUNBQUEyQixDQUFBLEdBQUFwQyxNQUFBLENBQUFxQyxjQUFBLEVBQUFDLENBQUEsR0FBQUYsQ0FBQSxJQUFBQSxDQUFBLENBQUFBLENBQUEsQ0FBQUcsTUFBQSxRQUFBRCxDQUFBLElBQUFBLENBQUEsS0FBQXZDLENBQUEsSUFBQUcsQ0FBQSxDQUFBeUIsSUFBQSxDQUFBVyxDQUFBLEVBQUE3QixDQUFBLE1BQUEwQixDQUFBLEdBQUFHLENBQUEsT0FBQUUsQ0FBQSxHQUFBTiwwQkFBQSxDQUFBakMsU0FBQSxHQUFBbUIsU0FBQSxDQUFBbkIsU0FBQSxHQUFBRCxNQUFBLENBQUFxQixNQUFBLENBQUFjLENBQUEsWUFBQU0sc0JBQUEzQyxDQUFBLGdDQUFBNEMsT0FBQSxXQUFBN0MsQ0FBQSxJQUFBa0IsTUFBQSxDQUFBakIsQ0FBQSxFQUFBRCxDQUFBLFlBQUFDLENBQUEsZ0JBQUE2QyxPQUFBLENBQUE5QyxDQUFBLEVBQUFDLENBQUEsc0JBQUE4QyxjQUFBOUMsQ0FBQSxFQUFBRCxDQUFBLGFBQUFnRCxPQUFBOUMsQ0FBQSxFQUFBSyxDQUFBLEVBQUFHLENBQUEsRUFBQUUsQ0FBQSxRQUFBRSxDQUFBLEdBQUFhLFFBQUEsQ0FBQTFCLENBQUEsQ0FBQUMsQ0FBQSxHQUFBRCxDQUFBLEVBQUFNLENBQUEsbUJBQUFPLENBQUEsQ0FBQWMsSUFBQSxRQUFBWixDQUFBLEdBQUFGLENBQUEsQ0FBQWUsR0FBQSxFQUFBRSxDQUFBLEdBQUFmLENBQUEsQ0FBQVAsS0FBQSxTQUFBc0IsQ0FBQSxnQkFBQWtCLE9BQUEsQ0FBQWxCLENBQUEsS0FBQTFCLENBQUEsQ0FBQXlCLElBQUEsQ0FBQUMsQ0FBQSxlQUFBL0IsQ0FBQSxDQUFBa0QsT0FBQSxDQUFBbkIsQ0FBQSxDQUFBb0IsT0FBQSxFQUFBQyxJQUFBLFdBQUFuRCxDQUFBLElBQUErQyxNQUFBLFNBQUEvQyxDQUFBLEVBQUFTLENBQUEsRUFBQUUsQ0FBQSxnQkFBQVgsQ0FBQSxJQUFBK0MsTUFBQSxVQUFBL0MsQ0FBQSxFQUFBUyxDQUFBLEVBQUFFLENBQUEsUUFBQVosQ0FBQSxDQUFBa0QsT0FBQSxDQUFBbkIsQ0FBQSxFQUFBcUIsSUFBQSxXQUFBbkQsQ0FBQSxJQUFBZSxDQUFBLENBQUFQLEtBQUEsR0FBQVIsQ0FBQSxFQUFBUyxDQUFBLENBQUFNLENBQUEsZ0JBQUFmLENBQUEsV0FBQStDLE1BQUEsVUFBQS9DLENBQUEsRUFBQVMsQ0FBQSxFQUFBRSxDQUFBLFNBQUFBLENBQUEsQ0FBQUUsQ0FBQSxDQUFBZSxHQUFBLFNBQUEzQixDQUFBLEVBQUFLLENBQUEsb0JBQUFFLEtBQUEsV0FBQUEsTUFBQVIsQ0FBQSxFQUFBSSxDQUFBLGFBQUFnRCwyQkFBQSxlQUFBckQsQ0FBQSxXQUFBQSxDQUFBLEVBQUFFLENBQUEsSUFBQThDLE1BQUEsQ0FBQS9DLENBQUEsRUFBQUksQ0FBQSxFQUFBTCxDQUFBLEVBQUFFLENBQUEsZ0JBQUFBLENBQUEsR0FBQUEsQ0FBQSxHQUFBQSxDQUFBLENBQUFrRCxJQUFBLENBQUFDLDBCQUFBLEVBQUFBLDBCQUFBLElBQUFBLDBCQUFBLHFCQUFBM0IsaUJBQUExQixDQUFBLEVBQUFFLENBQUEsRUFBQUcsQ0FBQSxRQUFBRSxDQUFBLEdBQUF3QixDQUFBLG1CQUFBckIsQ0FBQSxFQUFBRSxDQUFBLFFBQUFMLENBQUEsS0FBQTBCLENBQUEsUUFBQXFCLEtBQUEsc0NBQUEvQyxDQUFBLEtBQUEyQixDQUFBLG9CQUFBeEIsQ0FBQSxRQUFBRSxDQUFBLFdBQUFILEtBQUEsRUFBQVIsQ0FBQSxFQUFBc0QsSUFBQSxlQUFBbEQsQ0FBQSxDQUFBbUQsTUFBQSxHQUFBOUMsQ0FBQSxFQUFBTCxDQUFBLENBQUF3QixHQUFBLEdBQUFqQixDQUFBLFVBQUFFLENBQUEsR0FBQVQsQ0FBQSxDQUFBb0QsUUFBQSxNQUFBM0MsQ0FBQSxRQUFBRSxDQUFBLEdBQUEwQyxtQkFBQSxDQUFBNUMsQ0FBQSxFQUFBVCxDQUFBLE9BQUFXLENBQUEsUUFBQUEsQ0FBQSxLQUFBbUIsQ0FBQSxtQkFBQW5CLENBQUEscUJBQUFYLENBQUEsQ0FBQW1ELE1BQUEsRUFBQW5ELENBQUEsQ0FBQXNELElBQUEsR0FBQXRELENBQUEsQ0FBQXVELEtBQUEsR0FBQXZELENBQUEsQ0FBQXdCLEdBQUEsc0JBQUF4QixDQUFBLENBQUFtRCxNQUFBLFFBQUFqRCxDQUFBLEtBQUF3QixDQUFBLFFBQUF4QixDQUFBLEdBQUEyQixDQUFBLEVBQUE3QixDQUFBLENBQUF3QixHQUFBLEVBQUF4QixDQUFBLENBQUF3RCxpQkFBQSxDQUFBeEQsQ0FBQSxDQUFBd0IsR0FBQSx1QkFBQXhCLENBQUEsQ0FBQW1ELE1BQUEsSUFBQW5ELENBQUEsQ0FBQXlELE1BQUEsV0FBQXpELENBQUEsQ0FBQXdCLEdBQUEsR0FBQXRCLENBQUEsR0FBQTBCLENBQUEsTUFBQUssQ0FBQSxHQUFBWCxRQUFBLENBQUEzQixDQUFBLEVBQUFFLENBQUEsRUFBQUcsQ0FBQSxvQkFBQWlDLENBQUEsQ0FBQVYsSUFBQSxRQUFBckIsQ0FBQSxHQUFBRixDQUFBLENBQUFrRCxJQUFBLEdBQUFyQixDQUFBLEdBQUFGLENBQUEsRUFBQU0sQ0FBQSxDQUFBVCxHQUFBLEtBQUFNLENBQUEscUJBQUExQixLQUFBLEVBQUE2QixDQUFBLENBQUFULEdBQUEsRUFBQTBCLElBQUEsRUFBQWxELENBQUEsQ0FBQWtELElBQUEsa0JBQUFqQixDQUFBLENBQUFWLElBQUEsS0FBQXJCLENBQUEsR0FBQTJCLENBQUEsRUFBQTdCLENBQUEsQ0FBQW1ELE1BQUEsWUFBQW5ELENBQUEsQ0FBQXdCLEdBQUEsR0FBQVMsQ0FBQSxDQUFBVCxHQUFBLG1CQUFBNkIsb0JBQUExRCxDQUFBLEVBQUFFLENBQUEsUUFBQUcsQ0FBQSxHQUFBSCxDQUFBLENBQUFzRCxNQUFBLEVBQUFqRCxDQUFBLEdBQUFQLENBQUEsQ0FBQWEsUUFBQSxDQUFBUixDQUFBLE9BQUFFLENBQUEsS0FBQU4sQ0FBQSxTQUFBQyxDQUFBLENBQUF1RCxRQUFBLHFCQUFBcEQsQ0FBQSxJQUFBTCxDQUFBLENBQUFhLFFBQUEsZUFBQVgsQ0FBQSxDQUFBc0QsTUFBQSxhQUFBdEQsQ0FBQSxDQUFBMkIsR0FBQSxHQUFBNUIsQ0FBQSxFQUFBeUQsbUJBQUEsQ0FBQTFELENBQUEsRUFBQUUsQ0FBQSxlQUFBQSxDQUFBLENBQUFzRCxNQUFBLGtCQUFBbkQsQ0FBQSxLQUFBSCxDQUFBLENBQUFzRCxNQUFBLFlBQUF0RCxDQUFBLENBQUEyQixHQUFBLE9BQUFrQyxTQUFBLHVDQUFBMUQsQ0FBQSxpQkFBQThCLENBQUEsTUFBQXpCLENBQUEsR0FBQWlCLFFBQUEsQ0FBQXBCLENBQUEsRUFBQVAsQ0FBQSxDQUFBYSxRQUFBLEVBQUFYLENBQUEsQ0FBQTJCLEdBQUEsbUJBQUFuQixDQUFBLENBQUFrQixJQUFBLFNBQUExQixDQUFBLENBQUFzRCxNQUFBLFlBQUF0RCxDQUFBLENBQUEyQixHQUFBLEdBQUFuQixDQUFBLENBQUFtQixHQUFBLEVBQUEzQixDQUFBLENBQUF1RCxRQUFBLFNBQUF0QixDQUFBLE1BQUF2QixDQUFBLEdBQUFGLENBQUEsQ0FBQW1CLEdBQUEsU0FBQWpCLENBQUEsR0FBQUEsQ0FBQSxDQUFBMkMsSUFBQSxJQUFBckQsQ0FBQSxDQUFBRixDQUFBLENBQUFnRSxVQUFBLElBQUFwRCxDQUFBLENBQUFILEtBQUEsRUFBQVAsQ0FBQSxDQUFBK0QsSUFBQSxHQUFBakUsQ0FBQSxDQUFBa0UsT0FBQSxlQUFBaEUsQ0FBQSxDQUFBc0QsTUFBQSxLQUFBdEQsQ0FBQSxDQUFBc0QsTUFBQSxXQUFBdEQsQ0FBQSxDQUFBMkIsR0FBQSxHQUFBNUIsQ0FBQSxHQUFBQyxDQUFBLENBQUF1RCxRQUFBLFNBQUF0QixDQUFBLElBQUF2QixDQUFBLElBQUFWLENBQUEsQ0FBQXNELE1BQUEsWUFBQXRELENBQUEsQ0FBQTJCLEdBQUEsT0FBQWtDLFNBQUEsc0NBQUE3RCxDQUFBLENBQUF1RCxRQUFBLFNBQUF0QixDQUFBLGNBQUFnQyxhQUFBbEUsQ0FBQSxRQUFBRCxDQUFBLEtBQUFvRSxNQUFBLEVBQUFuRSxDQUFBLFlBQUFBLENBQUEsS0FBQUQsQ0FBQSxDQUFBcUUsUUFBQSxHQUFBcEUsQ0FBQSxXQUFBQSxDQUFBLEtBQUFELENBQUEsQ0FBQXNFLFVBQUEsR0FBQXJFLENBQUEsS0FBQUQsQ0FBQSxDQUFBdUUsUUFBQSxHQUFBdEUsQ0FBQSxXQUFBdUUsVUFBQSxDQUFBQyxJQUFBLENBQUF6RSxDQUFBLGNBQUEwRSxjQUFBekUsQ0FBQSxRQUFBRCxDQUFBLEdBQUFDLENBQUEsQ0FBQTBFLFVBQUEsUUFBQTNFLENBQUEsQ0FBQTRCLElBQUEsb0JBQUE1QixDQUFBLENBQUE2QixHQUFBLEVBQUE1QixDQUFBLENBQUEwRSxVQUFBLEdBQUEzRSxDQUFBLGFBQUF5QixRQUFBeEIsQ0FBQSxTQUFBdUUsVUFBQSxNQUFBSixNQUFBLGFBQUFuRSxDQUFBLENBQUE0QyxPQUFBLENBQUFzQixZQUFBLGNBQUFTLEtBQUEsaUJBQUFsQyxPQUFBMUMsQ0FBQSxRQUFBQSxDQUFBLFdBQUFBLENBQUEsUUFBQUUsQ0FBQSxHQUFBRixDQUFBLENBQUFZLENBQUEsT0FBQVYsQ0FBQSxTQUFBQSxDQUFBLENBQUE0QixJQUFBLENBQUE5QixDQUFBLDRCQUFBQSxDQUFBLENBQUFpRSxJQUFBLFNBQUFqRSxDQUFBLE9BQUE2RSxLQUFBLENBQUE3RSxDQUFBLENBQUE4RSxNQUFBLFNBQUF2RSxDQUFBLE9BQUFHLENBQUEsWUFBQXVELEtBQUEsYUFBQTFELENBQUEsR0FBQVAsQ0FBQSxDQUFBOEUsTUFBQSxPQUFBekUsQ0FBQSxDQUFBeUIsSUFBQSxDQUFBOUIsQ0FBQSxFQUFBTyxDQUFBLFVBQUEwRCxJQUFBLENBQUF4RCxLQUFBLEdBQUFULENBQUEsQ0FBQU8sQ0FBQSxHQUFBMEQsSUFBQSxDQUFBVixJQUFBLE9BQUFVLElBQUEsU0FBQUEsSUFBQSxDQUFBeEQsS0FBQSxHQUFBUixDQUFBLEVBQUFnRSxJQUFBLENBQUFWLElBQUEsT0FBQVUsSUFBQSxZQUFBdkQsQ0FBQSxDQUFBdUQsSUFBQSxHQUFBdkQsQ0FBQSxnQkFBQXFELFNBQUEsQ0FBQWQsT0FBQSxDQUFBakQsQ0FBQSxrQ0FBQW9DLGlCQUFBLENBQUFoQyxTQUFBLEdBQUFpQywwQkFBQSxFQUFBOUIsQ0FBQSxDQUFBb0MsQ0FBQSxtQkFBQWxDLEtBQUEsRUFBQTRCLDBCQUFBLEVBQUFqQixZQUFBLFNBQUFiLENBQUEsQ0FBQThCLDBCQUFBLG1CQUFBNUIsS0FBQSxFQUFBMkIsaUJBQUEsRUFBQWhCLFlBQUEsU0FBQWdCLGlCQUFBLENBQUEyQyxXQUFBLEdBQUE3RCxNQUFBLENBQUFtQiwwQkFBQSxFQUFBckIsQ0FBQSx3QkFBQWhCLENBQUEsQ0FBQWdGLG1CQUFBLGFBQUEvRSxDQUFBLFFBQUFELENBQUEsd0JBQUFDLENBQUEsSUFBQUEsQ0FBQSxDQUFBZ0YsV0FBQSxXQUFBakYsQ0FBQSxLQUFBQSxDQUFBLEtBQUFvQyxpQkFBQSw2QkFBQXBDLENBQUEsQ0FBQStFLFdBQUEsSUFBQS9FLENBQUEsQ0FBQWtGLElBQUEsT0FBQWxGLENBQUEsQ0FBQW1GLElBQUEsYUFBQWxGLENBQUEsV0FBQUUsTUFBQSxDQUFBaUYsY0FBQSxHQUFBakYsTUFBQSxDQUFBaUYsY0FBQSxDQUFBbkYsQ0FBQSxFQUFBb0MsMEJBQUEsS0FBQXBDLENBQUEsQ0FBQW9GLFNBQUEsR0FBQWhELDBCQUFBLEVBQUFuQixNQUFBLENBQUFqQixDQUFBLEVBQUFlLENBQUEseUJBQUFmLENBQUEsQ0FBQUcsU0FBQSxHQUFBRCxNQUFBLENBQUFxQixNQUFBLENBQUFtQixDQUFBLEdBQUExQyxDQUFBLEtBQUFELENBQUEsQ0FBQXNGLEtBQUEsYUFBQXJGLENBQUEsYUFBQWtELE9BQUEsRUFBQWxELENBQUEsT0FBQTJDLHFCQUFBLENBQUFHLGFBQUEsQ0FBQTNDLFNBQUEsR0FBQWMsTUFBQSxDQUFBNkIsYUFBQSxDQUFBM0MsU0FBQSxFQUFBVSxDQUFBLGlDQUFBZCxDQUFBLENBQUErQyxhQUFBLEdBQUFBLGFBQUEsRUFBQS9DLENBQUEsQ0FBQXVGLEtBQUEsYUFBQXRGLENBQUEsRUFBQUMsQ0FBQSxFQUFBRyxDQUFBLEVBQUFFLENBQUEsRUFBQUcsQ0FBQSxlQUFBQSxDQUFBLEtBQUFBLENBQUEsR0FBQThFLE9BQUEsT0FBQTVFLENBQUEsT0FBQW1DLGFBQUEsQ0FBQXpCLElBQUEsQ0FBQXJCLENBQUEsRUFBQUMsQ0FBQSxFQUFBRyxDQUFBLEVBQUFFLENBQUEsR0FBQUcsQ0FBQSxVQUFBVixDQUFBLENBQUFnRixtQkFBQSxDQUFBOUUsQ0FBQSxJQUFBVSxDQUFBLEdBQUFBLENBQUEsQ0FBQXFELElBQUEsR0FBQWIsSUFBQSxXQUFBbkQsQ0FBQSxXQUFBQSxDQUFBLENBQUFzRCxJQUFBLEdBQUF0RCxDQUFBLENBQUFRLEtBQUEsR0FBQUcsQ0FBQSxDQUFBcUQsSUFBQSxXQUFBckIscUJBQUEsQ0FBQUQsQ0FBQSxHQUFBekIsTUFBQSxDQUFBeUIsQ0FBQSxFQUFBM0IsQ0FBQSxnQkFBQUUsTUFBQSxDQUFBeUIsQ0FBQSxFQUFBL0IsQ0FBQSxpQ0FBQU0sTUFBQSxDQUFBeUIsQ0FBQSw2REFBQTNDLENBQUEsQ0FBQXlGLElBQUEsYUFBQXhGLENBQUEsUUFBQUQsQ0FBQSxHQUFBRyxNQUFBLENBQUFGLENBQUEsR0FBQUMsQ0FBQSxnQkFBQUcsQ0FBQSxJQUFBTCxDQUFBLEVBQUFFLENBQUEsQ0FBQXVFLElBQUEsQ0FBQXBFLENBQUEsVUFBQUgsQ0FBQSxDQUFBd0YsT0FBQSxhQUFBekIsS0FBQSxXQUFBL0QsQ0FBQSxDQUFBNEUsTUFBQSxTQUFBN0UsQ0FBQSxHQUFBQyxDQUFBLENBQUF5RixHQUFBLFFBQUExRixDQUFBLElBQUFELENBQUEsU0FBQWlFLElBQUEsQ0FBQXhELEtBQUEsR0FBQVIsQ0FBQSxFQUFBZ0UsSUFBQSxDQUFBVixJQUFBLE9BQUFVLElBQUEsV0FBQUEsSUFBQSxDQUFBVixJQUFBLE9BQUFVLElBQUEsUUFBQWpFLENBQUEsQ0FBQTBDLE1BQUEsR0FBQUEsTUFBQSxFQUFBakIsT0FBQSxDQUFBckIsU0FBQSxLQUFBNkUsV0FBQSxFQUFBeEQsT0FBQSxFQUFBbUQsS0FBQSxXQUFBQSxNQUFBNUUsQ0FBQSxhQUFBNEYsSUFBQSxXQUFBM0IsSUFBQSxXQUFBTixJQUFBLFFBQUFDLEtBQUEsR0FBQTNELENBQUEsT0FBQXNELElBQUEsWUFBQUUsUUFBQSxjQUFBRCxNQUFBLGdCQUFBM0IsR0FBQSxHQUFBNUIsQ0FBQSxPQUFBdUUsVUFBQSxDQUFBM0IsT0FBQSxDQUFBNkIsYUFBQSxJQUFBMUUsQ0FBQSxXQUFBRSxDQUFBLGtCQUFBQSxDQUFBLENBQUEyRixNQUFBLE9BQUF4RixDQUFBLENBQUF5QixJQUFBLE9BQUE1QixDQUFBLE1BQUEyRSxLQUFBLEVBQUEzRSxDQUFBLENBQUE0RixLQUFBLGNBQUE1RixDQUFBLElBQUFELENBQUEsTUFBQThGLElBQUEsV0FBQUEsS0FBQSxTQUFBeEMsSUFBQSxXQUFBdEQsQ0FBQSxRQUFBdUUsVUFBQSxJQUFBRyxVQUFBLGtCQUFBMUUsQ0FBQSxDQUFBMkIsSUFBQSxRQUFBM0IsQ0FBQSxDQUFBNEIsR0FBQSxjQUFBbUUsSUFBQSxLQUFBbkMsaUJBQUEsV0FBQUEsa0JBQUE3RCxDQUFBLGFBQUF1RCxJQUFBLFFBQUF2RCxDQUFBLE1BQUFFLENBQUEsa0JBQUErRixPQUFBNUYsQ0FBQSxFQUFBRSxDQUFBLFdBQUFLLENBQUEsQ0FBQWdCLElBQUEsWUFBQWhCLENBQUEsQ0FBQWlCLEdBQUEsR0FBQTdCLENBQUEsRUFBQUUsQ0FBQSxDQUFBK0QsSUFBQSxHQUFBNUQsQ0FBQSxFQUFBRSxDQUFBLEtBQUFMLENBQUEsQ0FBQXNELE1BQUEsV0FBQXRELENBQUEsQ0FBQTJCLEdBQUEsR0FBQTVCLENBQUEsS0FBQU0sQ0FBQSxhQUFBQSxDQUFBLFFBQUFpRSxVQUFBLENBQUFNLE1BQUEsTUFBQXZFLENBQUEsU0FBQUEsQ0FBQSxRQUFBRyxDQUFBLFFBQUE4RCxVQUFBLENBQUFqRSxDQUFBLEdBQUFLLENBQUEsR0FBQUYsQ0FBQSxDQUFBaUUsVUFBQSxpQkFBQWpFLENBQUEsQ0FBQTBELE1BQUEsU0FBQTZCLE1BQUEsYUFBQXZGLENBQUEsQ0FBQTBELE1BQUEsU0FBQXdCLElBQUEsUUFBQTlFLENBQUEsR0FBQVQsQ0FBQSxDQUFBeUIsSUFBQSxDQUFBcEIsQ0FBQSxlQUFBTSxDQUFBLEdBQUFYLENBQUEsQ0FBQXlCLElBQUEsQ0FBQXBCLENBQUEscUJBQUFJLENBQUEsSUFBQUUsQ0FBQSxhQUFBNEUsSUFBQSxHQUFBbEYsQ0FBQSxDQUFBMkQsUUFBQSxTQUFBNEIsTUFBQSxDQUFBdkYsQ0FBQSxDQUFBMkQsUUFBQSxnQkFBQXVCLElBQUEsR0FBQWxGLENBQUEsQ0FBQTRELFVBQUEsU0FBQTJCLE1BQUEsQ0FBQXZGLENBQUEsQ0FBQTRELFVBQUEsY0FBQXhELENBQUEsYUFBQThFLElBQUEsR0FBQWxGLENBQUEsQ0FBQTJELFFBQUEsU0FBQTRCLE1BQUEsQ0FBQXZGLENBQUEsQ0FBQTJELFFBQUEscUJBQUFyRCxDQUFBLFFBQUFzQyxLQUFBLHFEQUFBc0MsSUFBQSxHQUFBbEYsQ0FBQSxDQUFBNEQsVUFBQSxTQUFBMkIsTUFBQSxDQUFBdkYsQ0FBQSxDQUFBNEQsVUFBQSxZQUFBUixNQUFBLFdBQUFBLE9BQUE3RCxDQUFBLEVBQUFELENBQUEsYUFBQUUsQ0FBQSxRQUFBc0UsVUFBQSxDQUFBTSxNQUFBLE1BQUE1RSxDQUFBLFNBQUFBLENBQUEsUUFBQUssQ0FBQSxRQUFBaUUsVUFBQSxDQUFBdEUsQ0FBQSxPQUFBSyxDQUFBLENBQUE2RCxNQUFBLFNBQUF3QixJQUFBLElBQUF2RixDQUFBLENBQUF5QixJQUFBLENBQUF2QixDQUFBLHdCQUFBcUYsSUFBQSxHQUFBckYsQ0FBQSxDQUFBK0QsVUFBQSxRQUFBNUQsQ0FBQSxHQUFBSCxDQUFBLGFBQUFHLENBQUEsaUJBQUFULENBQUEsbUJBQUFBLENBQUEsS0FBQVMsQ0FBQSxDQUFBMEQsTUFBQSxJQUFBcEUsQ0FBQSxJQUFBQSxDQUFBLElBQUFVLENBQUEsQ0FBQTRELFVBQUEsS0FBQTVELENBQUEsY0FBQUUsQ0FBQSxHQUFBRixDQUFBLEdBQUFBLENBQUEsQ0FBQWlFLFVBQUEsY0FBQS9ELENBQUEsQ0FBQWdCLElBQUEsR0FBQTNCLENBQUEsRUFBQVcsQ0FBQSxDQUFBaUIsR0FBQSxHQUFBN0IsQ0FBQSxFQUFBVSxDQUFBLFNBQUE4QyxNQUFBLGdCQUFBUyxJQUFBLEdBQUF2RCxDQUFBLENBQUE0RCxVQUFBLEVBQUFuQyxDQUFBLFNBQUErRCxRQUFBLENBQUF0RixDQUFBLE1BQUFzRixRQUFBLFdBQUFBLFNBQUFqRyxDQUFBLEVBQUFELENBQUEsb0JBQUFDLENBQUEsQ0FBQTJCLElBQUEsUUFBQTNCLENBQUEsQ0FBQTRCLEdBQUEscUJBQUE1QixDQUFBLENBQUEyQixJQUFBLG1CQUFBM0IsQ0FBQSxDQUFBMkIsSUFBQSxRQUFBcUMsSUFBQSxHQUFBaEUsQ0FBQSxDQUFBNEIsR0FBQSxnQkFBQTVCLENBQUEsQ0FBQTJCLElBQUEsU0FBQW9FLElBQUEsUUFBQW5FLEdBQUEsR0FBQTVCLENBQUEsQ0FBQTRCLEdBQUEsT0FBQTJCLE1BQUEsa0JBQUFTLElBQUEseUJBQUFoRSxDQUFBLENBQUEyQixJQUFBLElBQUE1QixDQUFBLFVBQUFpRSxJQUFBLEdBQUFqRSxDQUFBLEdBQUFtQyxDQUFBLEtBQUFnRSxNQUFBLFdBQUFBLE9BQUFsRyxDQUFBLGFBQUFELENBQUEsUUFBQXdFLFVBQUEsQ0FBQU0sTUFBQSxNQUFBOUUsQ0FBQSxTQUFBQSxDQUFBLFFBQUFFLENBQUEsUUFBQXNFLFVBQUEsQ0FBQXhFLENBQUEsT0FBQUUsQ0FBQSxDQUFBb0UsVUFBQSxLQUFBckUsQ0FBQSxjQUFBaUcsUUFBQSxDQUFBaEcsQ0FBQSxDQUFBeUUsVUFBQSxFQUFBekUsQ0FBQSxDQUFBcUUsUUFBQSxHQUFBRyxhQUFBLENBQUF4RSxDQUFBLEdBQUFpQyxDQUFBLHlCQUFBaUUsT0FBQW5HLENBQUEsYUFBQUQsQ0FBQSxRQUFBd0UsVUFBQSxDQUFBTSxNQUFBLE1BQUE5RSxDQUFBLFNBQUFBLENBQUEsUUFBQUUsQ0FBQSxRQUFBc0UsVUFBQSxDQUFBeEUsQ0FBQSxPQUFBRSxDQUFBLENBQUFrRSxNQUFBLEtBQUFuRSxDQUFBLFFBQUFJLENBQUEsR0FBQUgsQ0FBQSxDQUFBeUUsVUFBQSxrQkFBQXRFLENBQUEsQ0FBQXVCLElBQUEsUUFBQXJCLENBQUEsR0FBQUYsQ0FBQSxDQUFBd0IsR0FBQSxFQUFBNkMsYUFBQSxDQUFBeEUsQ0FBQSxZQUFBSyxDQUFBLFlBQUErQyxLQUFBLDhCQUFBK0MsYUFBQSxXQUFBQSxjQUFBckcsQ0FBQSxFQUFBRSxDQUFBLEVBQUFHLENBQUEsZ0JBQUFvRCxRQUFBLEtBQUE1QyxRQUFBLEVBQUE2QixNQUFBLENBQUExQyxDQUFBLEdBQUFnRSxVQUFBLEVBQUE5RCxDQUFBLEVBQUFnRSxPQUFBLEVBQUE3RCxDQUFBLG9CQUFBbUQsTUFBQSxVQUFBM0IsR0FBQSxHQUFBNUIsQ0FBQSxHQUFBa0MsQ0FBQSxPQUFBbkMsQ0FBQTtBQUFBLFNBQUFzRyxRQUFBdEcsQ0FBQSxFQUFBRSxDQUFBLFFBQUFELENBQUEsR0FBQUUsTUFBQSxDQUFBc0YsSUFBQSxDQUFBekYsQ0FBQSxPQUFBRyxNQUFBLENBQUFvRyxxQkFBQSxRQUFBaEcsQ0FBQSxHQUFBSixNQUFBLENBQUFvRyxxQkFBQSxDQUFBdkcsQ0FBQSxHQUFBRSxDQUFBLEtBQUFLLENBQUEsR0FBQUEsQ0FBQSxDQUFBaUcsTUFBQSxXQUFBdEcsQ0FBQSxXQUFBQyxNQUFBLENBQUFzRyx3QkFBQSxDQUFBekcsQ0FBQSxFQUFBRSxDQUFBLEVBQUFpQixVQUFBLE9BQUFsQixDQUFBLENBQUF3RSxJQUFBLENBQUFpQyxLQUFBLENBQUF6RyxDQUFBLEVBQUFNLENBQUEsWUFBQU4sQ0FBQTtBQUFBLFNBQUEwRyxjQUFBM0csQ0FBQSxhQUFBRSxDQUFBLE1BQUFBLENBQUEsR0FBQTBHLFNBQUEsQ0FBQTlCLE1BQUEsRUFBQTVFLENBQUEsVUFBQUQsQ0FBQSxXQUFBMkcsU0FBQSxDQUFBMUcsQ0FBQSxJQUFBMEcsU0FBQSxDQUFBMUcsQ0FBQSxRQUFBQSxDQUFBLE9BQUFvRyxPQUFBLENBQUFuRyxNQUFBLENBQUFGLENBQUEsT0FBQTRDLE9BQUEsV0FBQTNDLENBQUEsSUFBQTJHLGVBQUEsQ0FBQTdHLENBQUEsRUFBQUUsQ0FBQSxFQUFBRCxDQUFBLENBQUFDLENBQUEsU0FBQUMsTUFBQSxDQUFBMkcseUJBQUEsR0FBQTNHLE1BQUEsQ0FBQTRHLGdCQUFBLENBQUEvRyxDQUFBLEVBQUFHLE1BQUEsQ0FBQTJHLHlCQUFBLENBQUE3RyxDQUFBLEtBQUFxRyxPQUFBLENBQUFuRyxNQUFBLENBQUFGLENBQUEsR0FBQTRDLE9BQUEsV0FBQTNDLENBQUEsSUFBQUMsTUFBQSxDQUFBSyxjQUFBLENBQUFSLENBQUEsRUFBQUUsQ0FBQSxFQUFBQyxNQUFBLENBQUFzRyx3QkFBQSxDQUFBeEcsQ0FBQSxFQUFBQyxDQUFBLGlCQUFBRixDQUFBO0FBQUEsU0FBQTZHLGdCQUFBRyxHQUFBLEVBQUFDLEdBQUEsRUFBQXhHLEtBQUEsSUFBQXdHLEdBQUEsR0FBQUMsY0FBQSxDQUFBRCxHQUFBLE9BQUFBLEdBQUEsSUFBQUQsR0FBQSxJQUFBN0csTUFBQSxDQUFBSyxjQUFBLENBQUF3RyxHQUFBLEVBQUFDLEdBQUEsSUFBQXhHLEtBQUEsRUFBQUEsS0FBQSxFQUFBVSxVQUFBLFFBQUFDLFlBQUEsUUFBQUMsUUFBQSxvQkFBQTJGLEdBQUEsQ0FBQUMsR0FBQSxJQUFBeEcsS0FBQSxXQUFBdUcsR0FBQTtBQUFBLFNBQUFFLGVBQUFqSCxDQUFBLFFBQUFTLENBQUEsR0FBQXlHLFlBQUEsQ0FBQWxILENBQUEsZ0NBQUFnRCxPQUFBLENBQUF2QyxDQUFBLElBQUFBLENBQUEsR0FBQUEsQ0FBQTtBQUFBLFNBQUF5RyxhQUFBbEgsQ0FBQSxFQUFBQyxDQUFBLG9CQUFBK0MsT0FBQSxDQUFBaEQsQ0FBQSxNQUFBQSxDQUFBLFNBQUFBLENBQUEsTUFBQUQsQ0FBQSxHQUFBQyxDQUFBLENBQUFVLE1BQUEsQ0FBQXlHLFdBQUEsa0JBQUFwSCxDQUFBLFFBQUFVLENBQUEsR0FBQVYsQ0FBQSxDQUFBOEIsSUFBQSxDQUFBN0IsQ0FBQSxFQUFBQyxDQUFBLGdDQUFBK0MsT0FBQSxDQUFBdkMsQ0FBQSxVQUFBQSxDQUFBLFlBQUFxRCxTQUFBLHlFQUFBN0QsQ0FBQSxHQUFBbUgsTUFBQSxHQUFBQyxNQUFBLEVBQUFySCxDQUFBO0FBQUEsU0FBQXNILDJCQUFBaEgsQ0FBQSxFQUFBaUgsY0FBQSxRQUFBQyxFQUFBLFVBQUE5RyxNQUFBLG9CQUFBSixDQUFBLENBQUFJLE1BQUEsQ0FBQUUsUUFBQSxLQUFBTixDQUFBLHFCQUFBa0gsRUFBQSxRQUFBQyxLQUFBLENBQUFDLE9BQUEsQ0FBQXBILENBQUEsTUFBQWtILEVBQUEsR0FBQUcsMkJBQUEsQ0FBQXJILENBQUEsTUFBQWlILGNBQUEsSUFBQWpILENBQUEsV0FBQUEsQ0FBQSxDQUFBdUUsTUFBQSxxQkFBQTJDLEVBQUEsRUFBQWxILENBQUEsR0FBQWtILEVBQUEsTUFBQS9HLENBQUEsVUFBQW1ILENBQUEsWUFBQUEsRUFBQSxlQUFBM0YsQ0FBQSxFQUFBMkYsQ0FBQSxFQUFBeEgsQ0FBQSxXQUFBQSxFQUFBLFFBQUFLLENBQUEsSUFBQUgsQ0FBQSxDQUFBdUUsTUFBQSxXQUFBdkIsSUFBQSxtQkFBQUEsSUFBQSxTQUFBOUMsS0FBQSxFQUFBRixDQUFBLENBQUFHLENBQUEsVUFBQVYsQ0FBQSxXQUFBQSxFQUFBOEgsRUFBQSxVQUFBQSxFQUFBLEtBQUE3RixDQUFBLEVBQUE0RixDQUFBLGdCQUFBOUQsU0FBQSxpSkFBQWdFLGdCQUFBLFNBQUFDLE1BQUEsVUFBQUMsR0FBQSxXQUFBL0YsQ0FBQSxXQUFBQSxFQUFBLElBQUF1RixFQUFBLEdBQUFBLEVBQUEsQ0FBQTNGLElBQUEsQ0FBQXZCLENBQUEsTUFBQUYsQ0FBQSxXQUFBQSxFQUFBLFFBQUE2SCxJQUFBLEdBQUFULEVBQUEsQ0FBQXhELElBQUEsSUFBQThELGdCQUFBLEdBQUFHLElBQUEsQ0FBQTNFLElBQUEsU0FBQTJFLElBQUEsS0FBQWxJLENBQUEsV0FBQUEsRUFBQW1JLEdBQUEsSUFBQUgsTUFBQSxTQUFBQyxHQUFBLEdBQUFFLEdBQUEsS0FBQWxHLENBQUEsV0FBQUEsRUFBQSxlQUFBOEYsZ0JBQUEsSUFBQU4sRUFBQSxvQkFBQUEsRUFBQSw4QkFBQU8sTUFBQSxRQUFBQyxHQUFBO0FBQUEsU0FBQUcsZUFBQUMsR0FBQSxFQUFBM0gsQ0FBQSxXQUFBNEgsZUFBQSxDQUFBRCxHQUFBLEtBQUFFLHFCQUFBLENBQUFGLEdBQUEsRUFBQTNILENBQUEsS0FBQWtILDJCQUFBLENBQUFTLEdBQUEsRUFBQTNILENBQUEsS0FBQThILGdCQUFBO0FBQUEsU0FBQUEsaUJBQUEsY0FBQXpFLFNBQUE7QUFBQSxTQUFBNkQsNEJBQUFySCxDQUFBLEVBQUFrSSxNQUFBLFNBQUFsSSxDQUFBLHFCQUFBQSxDQUFBLHNCQUFBbUksaUJBQUEsQ0FBQW5JLENBQUEsRUFBQWtJLE1BQUEsT0FBQXBJLENBQUEsR0FBQUYsTUFBQSxDQUFBQyxTQUFBLENBQUF1SSxRQUFBLENBQUE3RyxJQUFBLENBQUF2QixDQUFBLEVBQUF1RixLQUFBLGFBQUF6RixDQUFBLGlCQUFBRSxDQUFBLENBQUEwRSxXQUFBLEVBQUE1RSxDQUFBLEdBQUFFLENBQUEsQ0FBQTBFLFdBQUEsQ0FBQUMsSUFBQSxNQUFBN0UsQ0FBQSxjQUFBQSxDQUFBLG1CQUFBcUgsS0FBQSxDQUFBa0IsSUFBQSxDQUFBckksQ0FBQSxPQUFBRixDQUFBLCtEQUFBd0ksSUFBQSxDQUFBeEksQ0FBQSxVQUFBcUksaUJBQUEsQ0FBQW5JLENBQUEsRUFBQWtJLE1BQUE7QUFBQSxTQUFBQyxrQkFBQUwsR0FBQSxFQUFBUyxHQUFBLFFBQUFBLEdBQUEsWUFBQUEsR0FBQSxHQUFBVCxHQUFBLENBQUF2RCxNQUFBLEVBQUFnRSxHQUFBLEdBQUFULEdBQUEsQ0FBQXZELE1BQUEsV0FBQXBFLENBQUEsTUFBQXFJLElBQUEsT0FBQXJCLEtBQUEsQ0FBQW9CLEdBQUEsR0FBQXBJLENBQUEsR0FBQW9JLEdBQUEsRUFBQXBJLENBQUEsSUFBQXFJLElBQUEsQ0FBQXJJLENBQUEsSUFBQTJILEdBQUEsQ0FBQTNILENBQUEsVUFBQXFJLElBQUE7QUFBQSxTQUFBUixzQkFBQXJJLENBQUEsRUFBQThCLENBQUEsUUFBQS9CLENBQUEsV0FBQUMsQ0FBQSxnQ0FBQVMsTUFBQSxJQUFBVCxDQUFBLENBQUFTLE1BQUEsQ0FBQUUsUUFBQSxLQUFBWCxDQUFBLDRCQUFBRCxDQUFBLFFBQUFELENBQUEsRUFBQUssQ0FBQSxFQUFBSyxDQUFBLEVBQUFNLENBQUEsRUFBQUosQ0FBQSxPQUFBcUIsQ0FBQSxPQUFBMUIsQ0FBQSxpQkFBQUcsQ0FBQSxJQUFBVCxDQUFBLEdBQUFBLENBQUEsQ0FBQTZCLElBQUEsQ0FBQTVCLENBQUEsR0FBQStELElBQUEsUUFBQWpDLENBQUEsUUFBQTdCLE1BQUEsQ0FBQUYsQ0FBQSxNQUFBQSxDQUFBLFVBQUFnQyxDQUFBLHVCQUFBQSxDQUFBLElBQUFqQyxDQUFBLEdBQUFVLENBQUEsQ0FBQW9CLElBQUEsQ0FBQTdCLENBQUEsR0FBQXNELElBQUEsTUFBQTNDLENBQUEsQ0FBQTZELElBQUEsQ0FBQXpFLENBQUEsQ0FBQVMsS0FBQSxHQUFBRyxDQUFBLENBQUFrRSxNQUFBLEtBQUE5QyxDQUFBLEdBQUFDLENBQUEsaUJBQUEvQixDQUFBLElBQUFLLENBQUEsT0FBQUYsQ0FBQSxHQUFBSCxDQUFBLHlCQUFBK0IsQ0FBQSxZQUFBaEMsQ0FBQSxlQUFBZSxDQUFBLEdBQUFmLENBQUEsY0FBQUUsTUFBQSxDQUFBYSxDQUFBLE1BQUFBLENBQUEsMkJBQUFULENBQUEsUUFBQUYsQ0FBQSxhQUFBTyxDQUFBO0FBQUEsU0FBQTBILGdCQUFBRCxHQUFBLFFBQUFYLEtBQUEsQ0FBQUMsT0FBQSxDQUFBVSxHQUFBLFVBQUFBLEdBQUE7QUFBQSxTQUFBVyxtQkFBQUMsR0FBQSxFQUFBL0YsT0FBQSxFQUFBZ0csTUFBQSxFQUFBQyxLQUFBLEVBQUFDLE1BQUEsRUFBQW5DLEdBQUEsRUFBQXBGLEdBQUEsY0FBQXdILElBQUEsR0FBQUosR0FBQSxDQUFBaEMsR0FBQSxFQUFBcEYsR0FBQSxPQUFBcEIsS0FBQSxHQUFBNEksSUFBQSxDQUFBNUksS0FBQSxXQUFBNkksS0FBQSxJQUFBSixNQUFBLENBQUFJLEtBQUEsaUJBQUFELElBQUEsQ0FBQTlGLElBQUEsSUFBQUwsT0FBQSxDQUFBekMsS0FBQSxZQUFBK0UsT0FBQSxDQUFBdEMsT0FBQSxDQUFBekMsS0FBQSxFQUFBMkMsSUFBQSxDQUFBK0YsS0FBQSxFQUFBQyxNQUFBO0FBQUEsU0FBQUcsa0JBQUFDLEVBQUEsNkJBQUFDLElBQUEsU0FBQUMsSUFBQSxHQUFBOUMsU0FBQSxhQUFBcEIsT0FBQSxXQUFBdEMsT0FBQSxFQUFBZ0csTUFBQSxRQUFBRCxHQUFBLEdBQUFPLEVBQUEsQ0FBQTlDLEtBQUEsQ0FBQStDLElBQUEsRUFBQUMsSUFBQSxZQUFBUCxNQUFBMUksS0FBQSxJQUFBdUksa0JBQUEsQ0FBQUMsR0FBQSxFQUFBL0YsT0FBQSxFQUFBZ0csTUFBQSxFQUFBQyxLQUFBLEVBQUFDLE1BQUEsVUFBQTNJLEtBQUEsY0FBQTJJLE9BQUFuQixHQUFBLElBQUFlLGtCQUFBLENBQUFDLEdBQUEsRUFBQS9GLE9BQUEsRUFBQWdHLE1BQUEsRUFBQUMsS0FBQSxFQUFBQyxNQUFBLFdBQUFuQixHQUFBLEtBQUFrQixLQUFBLENBQUFRLFNBQUE7QUFEQTtBQUFBLFNBQ2VDLGFBQWFBLENBQUFDLEVBQUE7RUFBQSxPQUFBQyxjQUFBLENBQUFwRCxLQUFBLE9BQUFFLFNBQUE7QUFBQTtBQUFBLFNBQUFrRCxlQUFBO0VBQUFBLGNBQUEsR0FBQVAsaUJBQUEsZUFBQXhKLG1CQUFBLEdBQUFvRixJQUFBLENBQTVCLFNBQUE0RSxRQUE2QkMsV0FBVztJQUFBLElBQUFDLEdBQUEsRUFBQUMsUUFBQSxFQUFBQyxJQUFBLEVBQUFDLFFBQUE7SUFBQSxPQUFBckssbUJBQUEsR0FBQXVCLElBQUEsVUFBQStJLFNBQUFDLFFBQUE7TUFBQSxrQkFBQUEsUUFBQSxDQUFBMUUsSUFBQSxHQUFBMEUsUUFBQSxDQUFBckcsSUFBQTtRQUFBO1VBQUFxRyxRQUFBLENBQUExRSxJQUFBO1VBRTlCcUUsR0FBRyxHQUFHRCxXQUFXLDZCQUFBTyxNQUFBLENBQ09QLFdBQVcsSUFDckMsK0JBQStCO1VBQUFNLFFBQUEsQ0FBQXJHLElBQUE7VUFBQSxPQUNadUcsS0FBSyxDQUFDUCxHQUFHLEVBQUU7WUFDaEN6RyxNQUFNLEVBQUUsS0FBSztZQUNiaUgsT0FBTyxFQUFFO2NBQ1AsY0FBYyxFQUFFO1lBQ2xCO1VBQ0YsQ0FBQyxDQUFDO1FBQUE7VUFMSVAsUUFBUSxHQUFBSSxRQUFBLENBQUEzRyxJQUFBO1VBQUEsSUFPVHVHLFFBQVEsQ0FBQ1EsRUFBRTtZQUFBSixRQUFBLENBQUFyRyxJQUFBO1lBQUE7VUFBQTtVQUFBLE1BQ1IsSUFBSVgsS0FBSyxDQUFDLENBQUM7UUFBQTtVQUFBZ0gsUUFBQSxDQUFBckcsSUFBQTtVQUFBLE9BR0FpRyxRQUFRLENBQUNTLElBQUksQ0FBQyxDQUFDO1FBQUE7VUFBNUJSLElBQUksR0FBQUcsUUFBQSxDQUFBM0csSUFBQTtVQUNKeUcsUUFBUSxHQUFHRCxJQUFJLENBQUNRLElBQUk7VUFDMUJDLHFCQUFxQixDQUFDUixRQUFRLENBQUM7VUFDL0JTLGlCQUFpQixDQUFDLENBQUM7VUFBQVAsUUFBQSxDQUFBckcsSUFBQTtVQUFBO1FBQUE7VUFBQXFHLFFBQUEsQ0FBQTFFLElBQUE7VUFBQTBFLFFBQUEsQ0FBQVEsRUFBQSxHQUFBUixRQUFBO1VBRW5CUyxPQUFPLENBQUNDLEdBQUcsQ0FBQyxPQUFPLEVBQUFWLFFBQUEsQ0FBQVEsRUFBTyxDQUFDO1VBQzNCRixxQkFBcUIsQ0FBQyxFQUFFLENBQUM7UUFBQTtRQUFBO1VBQUEsT0FBQU4sUUFBQSxDQUFBdkUsSUFBQTtNQUFBO0lBQUEsR0FBQWdFLE9BQUE7RUFBQSxDQUU1QjtFQUFBLE9BQUFELGNBQUEsQ0FBQXBELEtBQUEsT0FBQUUsU0FBQTtBQUFBO0FBRUQsU0FBU2dFLHFCQUFxQkEsQ0FBQ1IsUUFBUSxFQUFFO0VBQ3ZDQSxRQUFRLENBQUN2SCxPQUFPLENBQUMsVUFBQ29JLFVBQVUsRUFBSztJQUMvQjtJQUNBLElBQU1DLFVBQVUsR0FBR0MsU0FBUyxDQUFDLENBQUMsQ0FBQztJQUMvQmhMLE1BQU0sQ0FBQ3NGLElBQUksQ0FBQ3dGLFVBQVUsQ0FBQyxDQUFDcEksT0FBTyxDQUFDLFVBQUNvRSxHQUFHLEVBQUs7TUFDdkMsSUFBSUEsR0FBRyxLQUFLLFVBQVUsRUFBRTtNQUN4Qm1FLGNBQWMsQ0FBQ0YsVUFBVSxFQUFFakUsR0FBRyxFQUFFZ0UsVUFBVSxDQUFDaEUsR0FBRyxDQUFDLENBQUM7SUFDbEQsQ0FBQyxDQUFDOztJQUVGO0lBQ0FnRSxVQUFVLENBQUNJLFFBQVEsQ0FBQ3hJLE9BQU8sQ0FBQyxVQUFDeUksV0FBVyxFQUFLO01BQzNDLElBQU1KLFVBQVUsR0FBR0MsU0FBUyxDQUFDLENBQUMsQ0FBQztNQUMvQmhMLE1BQU0sQ0FBQ3NGLElBQUksQ0FBQzZGLFdBQVcsQ0FBQyxDQUFDekksT0FBTyxDQUFDLFVBQUNvRSxHQUFHLEVBQUs7UUFDeEMsSUFBSUEsR0FBRyxLQUFLLFVBQVUsRUFBRTtRQUN4Qm1FLGNBQWMsQ0FBQ0YsVUFBVSxFQUFFakUsR0FBRyxFQUFFcUUsV0FBVyxDQUFDckUsR0FBRyxDQUFDLENBQUM7TUFDbkQsQ0FBQyxDQUFDOztNQUVGO01BQ0FxRSxXQUFXLENBQUNELFFBQVEsQ0FBQ3hJLE9BQU8sQ0FBQyxVQUFDMEksV0FBVyxFQUFLO1FBQzVDLElBQUlMLFVBQVU7UUFDZEssV0FBVyxDQUFDMUksT0FBTyxDQUFDLFVBQUMySSxVQUFVLEVBQUU5SyxDQUFDLEVBQUs7VUFDckMsSUFBSUEsQ0FBQyxLQUFLLENBQUMsRUFBRXdLLFVBQVUsR0FBR0MsU0FBUyxDQUFDLENBQUMsQ0FBQyxNQUNqQ0QsVUFBVSxHQUFHTyxnQkFBZ0IsQ0FBQ1AsVUFBVSxDQUFDO1VBQzlDL0ssTUFBTSxDQUFDc0YsSUFBSSxDQUFDK0YsVUFBVSxDQUFDLENBQUMzSSxPQUFPLENBQUMsVUFBQ29FLEdBQUcsRUFBSztZQUN2QyxJQUFJQSxHQUFHLEtBQUssVUFBVSxFQUFFO1lBQ3hCbUUsY0FBYyxDQUFDRixVQUFVLEVBQUVqRSxHQUFHLEVBQUV1RSxVQUFVLENBQUN2RSxHQUFHLENBQUMsQ0FBQztVQUNsRCxDQUFDLENBQUM7UUFDSixDQUFDLENBQUM7TUFDSixDQUFDLENBQUM7SUFDSixDQUFDLENBQUM7RUFDSixDQUFDLENBQUM7QUFDSjtBQUNBMkMsYUFBYSxDQUFDLENBQUM7O0FBRWY7QUFDQSxTQUFTOEIscUJBQXFCQSxDQUFDQyxLQUFLLEVBQUU7RUFDcEMsSUFBTUMsUUFBUSxHQUFHQyxRQUFRLENBQUNDLGNBQWMsQ0FBQyxrQkFBa0IsQ0FBQztFQUM1RCxJQUFNQyxPQUFPLEdBQUdILFFBQVEsQ0FBQ0csT0FBTztFQUNoQyxJQUFNQyxLQUFLLEdBQUdELE9BQU8sQ0FBQ0UsU0FBUyxDQUFDLElBQUksQ0FBQztFQUNyQyxJQUFNQyxzQkFBc0IsR0FBR0YsS0FBSyxDQUFDRyxhQUFhLENBQUMsbUJBQW1CLENBQUM7RUFDdkVELHNCQUFzQixDQUFDRSxPQUFPLENBQUNULEtBQUssR0FBR0EsS0FBSztFQUM1QyxJQUFNVSxVQUFVLEdBQUcsS0FBSyxHQUFHLENBQUNWLEtBQUssR0FBRyxDQUFDLElBQUksRUFBRTtFQUMzQ08sc0JBQXNCLENBQUNJLFNBQVMsQ0FBQ0MsR0FBRyxDQUFDRixVQUFVLENBQUM7RUFFaEQsSUFBSVYsS0FBSyxLQUFLLENBQUMsRUFBRTtJQUNmLElBQU1hLGNBQWMsR0FBR1gsUUFBUSxDQUFDQyxjQUFjLENBQUMsOEJBQThCLENBQUM7SUFDOUUsSUFBTVcsYUFBYSxHQUFHRCxjQUFjLENBQUNULE9BQU87SUFDNUMsSUFBTVcsV0FBVyxHQUFHRCxhQUFhLENBQUNSLFNBQVMsQ0FBQyxJQUFJLENBQUM7SUFDakQsSUFBTVUseUJBQXlCLEdBQUdELFdBQVcsQ0FBQ1AsYUFBYSxDQUFDLCtCQUErQixDQUFDO0lBQzVGRCxzQkFBc0IsQ0FBQ1UsV0FBVyxDQUFDRCx5QkFBeUIsQ0FBQztFQUMvRDtFQUNBLE9BQU9ULHNCQUFzQjtBQUMvQjtBQUNBLFNBQVNXLFFBQVFBLENBQUNsQixLQUFLLEVBQUU7RUFDdkIsUUFBUUEsS0FBSztJQUNYLEtBQUssQ0FBQztNQUNKLE9BQU8sTUFBTTtJQUNmLEtBQUssQ0FBQztNQUNKLE9BQU8sVUFBVTtJQUNuQixLQUFLLENBQUM7TUFDSixPQUFPLFdBQVc7RUFDdEI7QUFDRjtBQUNBLFNBQVNtQixZQUFZQSxDQUFDQyxlQUFlLEVBQUU7RUFDckMsSUFBTW5CLFFBQVEsR0FBR0MsUUFBUSxDQUFDQyxjQUFjLENBQUMsUUFBUSxDQUFDO0VBQ2xELElBQU1DLE9BQU8sR0FBR0gsUUFBUSxDQUFDRyxPQUFPO0VBQ2hDLElBQU1DLEtBQUssR0FBR0QsT0FBTyxDQUFDRSxTQUFTLENBQUMsSUFBSSxDQUFDO0VBQ3JDLElBQU1lLGFBQWEsR0FBR2hCLEtBQUssQ0FBQ0csYUFBYSxDQUFDLFNBQVMsQ0FBQztFQUNwRCxJQUFNYyxhQUFhLEdBQUdELGFBQWEsQ0FBQ2IsYUFBYSxDQUFDLGFBQWEsQ0FBQztFQUNoRSxJQUFNZSxpQkFBaUIsR0FBR0YsYUFBYSxDQUFDYixhQUFhLENBQUMsa0JBQWtCLENBQUM7RUFDekUsSUFBTVIsS0FBSyxHQUFHckUsTUFBTSxDQUFDeUYsZUFBZSxDQUFDWCxPQUFPLENBQUNULEtBQUssQ0FBQztFQUNuRCxJQUFNd0IsVUFBVSxHQUFHLEtBQUssR0FBR04sUUFBUSxDQUFDbEIsS0FBSyxDQUFDO0VBQzFDc0IsYUFBYSxDQUFDWCxTQUFTLENBQUNDLEdBQUcsQ0FBQ1ksVUFBVSxDQUFDO0VBQ3ZDRCxpQkFBaUIsQ0FBQ1osU0FBUyxDQUFDQyxHQUFHLENBQUMsT0FBTyxHQUFHTSxRQUFRLENBQUNsQixLQUFLLENBQUMsQ0FBQztFQUMxRCxPQUFPLENBQUNxQixhQUFhLEVBQUVDLGFBQWEsQ0FBQztBQUN2QztBQUNBLFNBQVNHLDJCQUEyQkEsQ0FBQ0wsZUFBZSxFQUFFO0VBQ3BELElBQU1uQixRQUFRLEdBQUdDLFFBQVEsQ0FBQ0MsY0FBYyxDQUFDLGdDQUFnQyxDQUFDO0VBQzFFLElBQU1DLE9BQU8sR0FBR0gsUUFBUSxDQUFDRyxPQUFPO0VBQ2hDLElBQU1DLEtBQUssR0FBR0QsT0FBTyxDQUFDRSxTQUFTLENBQUMsSUFBSSxDQUFDO0VBQ3JDLElBQU1vQixjQUFjLEdBQUdyQixLQUFLLENBQUNHLGFBQWEsQ0FBQyxpQ0FBaUMsQ0FBQztFQUM3RSxJQUFNbUIsT0FBTyxHQUFHRCxjQUFjLENBQUNFLGdCQUFnQixDQUFDLFFBQVEsQ0FBQztFQUN6RCxJQUFNNUIsS0FBSyxHQUFHckUsTUFBTSxDQUFDeUYsZUFBZSxDQUFDWCxPQUFPLENBQUNULEtBQUssQ0FBQztFQUNuRCxJQUFNNkIsS0FBSyxHQUFHWCxRQUFRLENBQUNsQixLQUFLLENBQUM7RUFDN0IyQixPQUFPLENBQUN6SyxPQUFPLENBQUMsVUFBQzRLLE1BQU0sRUFBSztJQUMxQkEsTUFBTSxDQUFDbkIsU0FBUyxDQUFDQyxHQUFHLFdBQUFoQyxNQUFBLENBQVdpRCxLQUFLLENBQUUsQ0FBQztJQUN2Q0MsTUFBTSxDQUFDbkIsU0FBUyxDQUFDQyxHQUFHLFNBQUFoQyxNQUFBLENBQVNpRCxLQUFLLENBQUUsQ0FBQztJQUNyQ0MsTUFBTSxDQUFDbkIsU0FBUyxDQUFDQyxHQUFHLGFBQUFoQyxNQUFBLENBQWFpRCxLQUFLLENBQUUsQ0FBQztFQUMzQyxDQUFDLENBQUM7RUFDRixPQUFPSCxjQUFjO0FBQ3ZCO0FBQ0EsU0FBU0ssbUJBQW1CQSxDQUFDWCxlQUFlLEVBQUU7RUFDNUMsSUFBTW5CLFFBQVEsR0FBR0MsUUFBUSxDQUFDQyxjQUFjLENBQUMsb0JBQW9CLENBQUM7RUFDOUQsSUFBTUMsT0FBTyxHQUFHSCxRQUFRLENBQUNHLE9BQU87RUFDaEMsSUFBTUMsS0FBSyxHQUFHRCxPQUFPLENBQUNFLFNBQVMsQ0FBQyxJQUFJLENBQUM7RUFDckMsSUFBTXdCLE1BQU0sR0FBR3pCLEtBQUssQ0FBQ0csYUFBYSxDQUFDLFFBQVEsQ0FBQztFQUM1QyxJQUFNUixLQUFLLEdBQUdyRSxNQUFNLENBQUN5RixlQUFlLENBQUNYLE9BQU8sQ0FBQ1QsS0FBSyxDQUFDO0VBQ25ELElBQU02QixLQUFLLEdBQUdYLFFBQVEsQ0FBQ2xCLEtBQUssQ0FBQztFQUM3QjhCLE1BQU0sQ0FBQ25CLFNBQVMsQ0FBQ0MsR0FBRyxXQUFBaEMsTUFBQSxDQUFXaUQsS0FBSyxDQUFFLENBQUM7RUFDdkNDLE1BQU0sQ0FBQ25CLFNBQVMsQ0FBQ0MsR0FBRyxTQUFBaEMsTUFBQSxDQUFTaUQsS0FBSyxDQUFFLENBQUM7RUFDckNDLE1BQU0sQ0FBQ25CLFNBQVMsQ0FBQ0MsR0FBRyxhQUFBaEMsTUFBQSxDQUFhaUQsS0FBSyxDQUFFLENBQUM7RUFDekMsT0FBT0MsTUFBTTtBQUNmOztBQUVBO0FBQ0EsU0FBU3RDLFNBQVNBLENBQUNRLEtBQUssRUFBRWdDLGFBQWEsRUFBRTtFQUN2QyxJQUFNQyxTQUFTLEdBQUdsQyxxQkFBcUIsQ0FBQ0MsS0FBSyxDQUFDO0VBQzlDLElBQUFrQyxhQUFBLEdBQTRCZixZQUFZLENBQUNjLFNBQVMsQ0FBQztJQUFBRSxjQUFBLEdBQUExRixjQUFBLENBQUF5RixhQUFBO0lBQTVDRSxNQUFNLEdBQUFELGNBQUE7SUFBRUUsU0FBUyxHQUFBRixjQUFBO0VBQ3hCLElBQUluQyxLQUFLLEdBQUcsQ0FBQyxFQUFFO0lBQ2IsSUFBTTJCLE9BQU8sR0FBR0YsMkJBQTJCLENBQUNRLFNBQVMsQ0FBQztJQUN0REksU0FBUyxDQUFDcEIsV0FBVyxDQUFDVSxPQUFPLENBQUM7RUFDaEMsQ0FBQyxNQUFNO0lBQ0wsSUFBTUcsTUFBTSxHQUFHQyxtQkFBbUIsQ0FBQ0UsU0FBUyxDQUFDO0lBQzdDSSxTQUFTLENBQUNwQixXQUFXLENBQUNhLE1BQU0sQ0FBQztFQUMvQjtFQUVBLElBQUlFLGFBQWEsRUFBRUEsYUFBYSxDQUFDTSxNQUFNLENBQUNMLFNBQVMsQ0FBQyxNQUM3Qy9CLFFBQVEsQ0FBQ0MsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDYyxXQUFXLENBQUNnQixTQUFTLENBQUM7RUFDOURBLFNBQVMsQ0FBQ2hCLFdBQVcsQ0FBQ21CLE1BQU0sQ0FBQztFQUM3QixPQUFPQSxNQUFNO0FBQ2Y7QUFDQSxTQUFTRyxjQUFjQSxDQUFDQyxlQUFlLEVBQUU7RUFDdkMsSUFBTXhDLEtBQUssR0FBR3JFLE1BQU0sQ0FBQzZHLGVBQWUsQ0FBQy9CLE9BQU8sQ0FBQ1QsS0FBSyxDQUFDO0VBQ25ELElBQU15QyxVQUFVLEdBQUcxRyxLQUFLLENBQUNrQixJQUFJLENBQUN1RixlQUFlLENBQUNFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQ2hELFFBQVEsQ0FBQyxDQUFDN0UsTUFBTSxDQUFDLFVBQUM4SCxLQUFLO0lBQUEsT0FDdkZBLEtBQUssQ0FBQ2hDLFNBQVMsQ0FBQ2lDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQztFQUFBLENBQzlDLENBQUM7RUFDRCxJQUFNQyxlQUFlLEdBQUdKLFVBQVUsQ0FBQ3RJLEtBQUssQ0FBQ3NJLFVBQVUsQ0FBQ0ssT0FBTyxDQUFDTixlQUFlLENBQUMsR0FBRyxDQUFDLENBQUM7RUFDakYsSUFBTU8sd0JBQXdCLEdBQUdGLGVBQWUsQ0FBQ2hJLE1BQU0sQ0FDckQsVUFBQ29ILFNBQVM7SUFBQSxPQUFLdEcsTUFBTSxDQUFDc0csU0FBUyxDQUFDeEIsT0FBTyxDQUFDVCxLQUFLLENBQUMsS0FBS0EsS0FBSztFQUFBLENBQzFELENBQUM7RUFDRCxJQUFJZ0MsYUFBYSxHQUFHZSx3QkFBd0IsQ0FBQyxDQUFDLENBQUM7RUFFL0MsSUFBSSxDQUFDZixhQUFhLEVBQUU7SUFDbEIsSUFBTWdCLDRCQUE0QixHQUFHSCxlQUFlLENBQUNoSSxNQUFNLENBQ3pELFVBQUNvSCxTQUFTO01BQUEsT0FBS3RHLE1BQU0sQ0FBQ3NHLFNBQVMsQ0FBQ3hCLE9BQU8sQ0FBQ1QsS0FBSyxDQUFDLEtBQUtBLEtBQUssR0FBRyxDQUFDO0lBQUEsQ0FDOUQsQ0FBQztJQUNEZ0MsYUFBYSxHQUFHZ0IsNEJBQTRCLENBQUMsQ0FBQyxDQUFDO0VBQ2pEO0VBRUEsSUFBSWhCLGFBQWEsRUFBRTtJQUNqQnhDLFNBQVMsQ0FBQ1EsS0FBSyxFQUFFZ0MsYUFBYSxDQUFDO0VBQ2pDLENBQUMsTUFBTTtJQUNMeEMsU0FBUyxDQUFDUSxLQUFLLENBQUM7RUFDbEI7QUFDRjtBQUNBLFNBQVNpRCxlQUFlQSxDQUFDVCxlQUFlLEVBQUU7RUFDeEMsSUFBTXhDLEtBQUssR0FBR3JFLE1BQU0sQ0FBQzZHLGVBQWUsQ0FBQy9CLE9BQU8sQ0FBQ1QsS0FBSyxDQUFDO0VBQ25ELElBQU1rRCxRQUFRLEdBQUdsRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBR0EsS0FBSyxHQUFHLENBQUM7RUFDM0MsSUFBTWdDLGFBQWEsR0FBR1EsZUFBZSxDQUFDVyxrQkFBa0I7RUFDeEQsSUFBSSxDQUFDbkIsYUFBYSxFQUFFO0lBQ2xCeEMsU0FBUyxDQUFDMEQsUUFBUSxDQUFDO0lBQ25CO0VBQ0Y7RUFDQTFELFNBQVMsQ0FBQzBELFFBQVEsRUFBRWxCLGFBQWEsQ0FBQztBQUNwQztBQUNBLFNBQVNsQyxnQkFBZ0JBLENBQUNzRCxZQUFZLEVBQUU7RUFDdEMsSUFBTW5CLFNBQVMsR0FBR21CLFlBQVksQ0FBQ1YsT0FBTyxDQUFDLG1CQUFtQixDQUFDO0VBQzNELElBQUFXLGNBQUEsR0FBNEJsQyxZQUFZLENBQUNjLFNBQVMsQ0FBQztJQUFBcUIsY0FBQSxHQUFBN0csY0FBQSxDQUFBNEcsY0FBQTtJQUE1Q2pCLE1BQU0sR0FBQWtCLGNBQUE7SUFBRWpCLFNBQVMsR0FBQWlCLGNBQUE7RUFDeEIsSUFBTXhCLE1BQU0sR0FBR0MsbUJBQW1CLENBQUNFLFNBQVMsQ0FBQztFQUM3Q0ksU0FBUyxDQUFDcEIsV0FBVyxDQUFDYSxNQUFNLENBQUM7RUFDN0JzQixZQUFZLENBQUNHLEtBQUssQ0FBQ25CLE1BQU0sQ0FBQztFQUMxQixPQUFPQSxNQUFNO0FBQ2Y7O0FBRUE7QUFDQSxTQUFTb0IscUJBQXFCQSxDQUFDQyxNQUFNLEVBQUV6QixhQUFhLEVBQUUwQixTQUFTLEVBQUU7RUFBQSxJQUFBQyxlQUFBO0VBQy9ELElBQU1QLFlBQVksSUFBQU8sZUFBQSxHQUFHRixNQUFNLENBQUNmLE9BQU8sQ0FBQyxTQUFTLENBQUMsY0FBQWlCLGVBQUEsY0FBQUEsZUFBQSxHQUFJRixNQUFNO0VBQ3hELElBQU14QixTQUFTLEdBQUdtQixZQUFZLENBQUNWLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQztFQUMzRCxJQUFNMUMsS0FBSyxHQUFHckUsTUFBTSxDQUFDc0csU0FBUyxDQUFDeEIsT0FBTyxDQUFDVCxLQUFLLENBQUM7RUFFN0MsSUFBTTRELGlCQUFpQixHQUFHM0IsU0FBUyxDQUFDa0Isa0JBQWtCO0VBRXRELElBQUksQ0FBQ1MsaUJBQWlCLElBQUk1QixhQUFhLEVBQUU7SUFDdkNBLGFBQWEsQ0FBQzZCLE1BQU0sQ0FBQyxDQUFDO0VBQ3hCLENBQUMsTUFBTSxJQUFJRCxpQkFBaUIsSUFBSWpJLE1BQU0sQ0FBQ2lJLGlCQUFpQixDQUFDbkQsT0FBTyxDQUFDVCxLQUFLLENBQUMsSUFBSTBELFNBQVMsYUFBVEEsU0FBUyxjQUFUQSxTQUFTLEdBQUkxRCxLQUFLLENBQUMsRUFBRTtJQUM5RixJQUFNOEQsbUJBQW1CLEdBQUdGLGlCQUFpQixDQUFDcEQsYUFBYSxDQUFDLFNBQVMsQ0FBQztJQUN0RWdELHFCQUFxQixDQUFDTSxtQkFBbUIsRUFBRUYsaUJBQWlCLEVBQUVGLFNBQVMsYUFBVEEsU0FBUyxjQUFUQSxTQUFTLEdBQUkxRCxLQUFLLENBQUM7SUFDakZpQyxTQUFTLENBQUM0QixNQUFNLENBQUMsQ0FBQztFQUNwQixDQUFDLE1BQU07SUFDTFQsWUFBWSxDQUFDUyxNQUFNLENBQUMsQ0FBQztJQUNyQixJQUFNRSxZQUFZLEdBQUdoSSxLQUFLLENBQUNrQixJQUFJLENBQUNnRixTQUFTLENBQUNMLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3RFLElBQUltQyxZQUFZLENBQUM1SyxNQUFNLEtBQUssQ0FBQyxFQUFFOEksU0FBUyxDQUFDNEIsTUFBTSxDQUFDLENBQUM7RUFDbkQ7QUFDRjtBQUNBLFNBQVNHLGtCQUFrQkEsQ0FBQSxFQUFHO0VBQzVCLElBQU12QixVQUFVLEdBQUd3QixnQkFBZ0IsQ0FBQyxDQUFDO0VBQ3JDeEIsVUFBVSxDQUFDdkwsT0FBTyxDQUFDLFVBQUMrSyxTQUFTO0lBQUEsT0FBS0EsU0FBUyxDQUFDNEIsTUFBTSxDQUFDLENBQUM7RUFBQSxFQUFDO0FBQ3ZEOztBQUVBO0FBQ0EsU0FBU0ssV0FBV0EsQ0FBQ0MsS0FBSyxFQUFFO0VBQzFCLElBQU1DLFVBQVUsR0FBR0QsS0FBSyxDQUFDaEIsa0JBQWtCO0VBQzNDLElBQUksQ0FBQ2lCLFVBQVUsSUFBSUEsVUFBVSxDQUFDQyxRQUFRLEtBQUssTUFBTSxFQUFFO0VBQ25ERCxVQUFVLENBQUNFLFdBQVcsR0FBR0gsS0FBSyxDQUFDclAsS0FBSztBQUN0QztBQUNBLFNBQVMySyxjQUFjQSxDQUFDRixVQUFVLEVBQUVnRixRQUFRLEVBQUV6UCxLQUFLLEVBQUU7RUFDbkQsSUFBTXFQLEtBQUssR0FBRzVFLFVBQVUsQ0FBQ2lCLGFBQWEsaUJBQUE1QixNQUFBLENBQWdCMkYsUUFBUSxRQUFJLENBQUM7RUFDbkUsSUFBSSxDQUFDSixLQUFLLEVBQUU7RUFDWkEsS0FBSyxDQUFDclAsS0FBSyxHQUFHQSxLQUFLO0VBQ25Cb1AsV0FBVyxDQUFDQyxLQUFLLENBQUM7QUFDcEI7O0FBRUE7QUFDQSxTQUFTSyxzQkFBc0JBLENBQUMxQyxNQUFNLEVBQUU7RUFDdEMsSUFBTVUsZUFBZSxHQUFHVixNQUFNLENBQUNZLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQztFQUMzREgsY0FBYyxDQUFDQyxlQUFlLENBQUM7QUFDakM7QUFDQSxTQUFTaUMsb0JBQW9CQSxDQUFDM0MsTUFBTSxFQUFFO0VBQ3BDLElBQU1VLGVBQWUsR0FBR1YsTUFBTSxDQUFDWSxPQUFPLENBQUMsbUJBQW1CLENBQUM7RUFDM0RPLGVBQWUsQ0FBQ1QsZUFBZSxDQUFDO0FBQ2xDO0FBQ0EsU0FBU2tDLHVCQUF1QkEsQ0FBQzVDLE1BQU0sRUFBRTtFQUN2QyxJQUFNc0IsWUFBWSxHQUFHdEIsTUFBTSxDQUFDWSxPQUFPLENBQUMsU0FBUyxDQUFDO0VBQzlDNUMsZ0JBQWdCLENBQUNzRCxZQUFZLENBQUM7QUFDaEM7QUFDQSxTQUFTdUIsd0JBQXdCQSxDQUFDN0MsTUFBTSxFQUFFO0VBQ3hDLElBQU1HLFNBQVMsR0FBR0gsTUFBTSxDQUFDWSxPQUFPLENBQUMsbUJBQW1CLENBQUM7RUFDckRPLGVBQWUsQ0FBQ2hCLFNBQVMsQ0FBQztBQUM1QjtBQUFDLFNBQ2MyQyxVQUFVQSxDQUFBO0VBQUEsT0FBQUMsV0FBQSxDQUFBOUosS0FBQSxPQUFBRSxTQUFBO0FBQUE7QUFBQSxTQUFBNEosWUFBQTtFQUFBQSxXQUFBLEdBQUFqSCxpQkFBQSxlQUFBeEosbUJBQUEsR0FBQW9GLElBQUEsQ0FBekIsU0FBQXNMLFNBQUE7SUFBQSxJQUFBMUUsT0FBQTtJQUFBLE9BQUFoTSxtQkFBQSxHQUFBdUIsSUFBQSxVQUFBb1AsVUFBQUMsU0FBQTtNQUFBLGtCQUFBQSxTQUFBLENBQUEvSyxJQUFBLEdBQUErSyxTQUFBLENBQUExTSxJQUFBO1FBQUE7VUFBQTBNLFNBQUEsQ0FBQS9LLElBQUE7VUFFVW1HLE9BQU8sR0FBR0YsUUFBUSxDQUFDQyxjQUFjLENBQUMsZUFBZSxDQUFDLENBQUNtRSxXQUFXO1VBQUFVLFNBQUEsQ0FBQTFNLElBQUE7VUFBQSxPQUM5RDJNLFNBQVMsQ0FBQ0MsU0FBUyxDQUFDQyxTQUFTLENBQUMvRSxPQUFPLENBQUM7UUFBQTtVQUFBNEUsU0FBQSxDQUFBMU0sSUFBQTtVQUFBO1FBQUE7VUFBQTBNLFNBQUEsQ0FBQS9LLElBQUE7VUFBQStLLFNBQUEsQ0FBQTdGLEVBQUEsR0FBQTZGLFNBQUE7VUFFNUM1RixPQUFPLENBQUN6QixLQUFLLENBQUMseUJBQXlCLEVBQUFxSCxTQUFBLENBQUE3RixFQUFLLENBQUM7UUFBQTtRQUFBO1VBQUEsT0FBQTZGLFNBQUEsQ0FBQTVLLElBQUE7TUFBQTtJQUFBLEdBQUEwSyxRQUFBO0VBQUEsQ0FFaEQ7RUFBQSxPQUFBRCxXQUFBLENBQUE5SixLQUFBLE9BQUFFLFNBQUE7QUFBQTtBQUFBLFNBQ2NtSyxVQUFVQSxDQUFBO0VBQUEsT0FBQUMsV0FBQSxDQUFBdEssS0FBQSxPQUFBRSxTQUFBO0FBQUE7QUFBQSxTQUFBb0ssWUFBQTtFQUFBQSxXQUFBLEdBQUF6SCxpQkFBQSxlQUFBeEosbUJBQUEsR0FBQW9GLElBQUEsQ0FBekIsU0FBQThMLFNBQUE7SUFBQSxJQUFBbEYsT0FBQTtJQUFBLE9BQUFoTSxtQkFBQSxHQUFBdUIsSUFBQSxVQUFBNFAsVUFBQUMsU0FBQTtNQUFBLGtCQUFBQSxTQUFBLENBQUF2TCxJQUFBLEdBQUF1TCxTQUFBLENBQUFsTixJQUFBO1FBQUE7VUFBQWtOLFNBQUEsQ0FBQXZMLElBQUE7VUFFVW1HLE9BQU8sR0FBR0YsUUFBUSxDQUFDQyxjQUFjLENBQUMsZUFBZSxDQUFDLENBQUNtRSxXQUFXO1VBQUFrQixTQUFBLENBQUFsTixJQUFBO1VBQUEsT0FDOUQyTSxTQUFTLENBQUNDLFNBQVMsQ0FBQ0MsU0FBUyxDQUFDL0UsT0FBTyxDQUFDO1FBQUE7VUFBQW9GLFNBQUEsQ0FBQWxOLElBQUE7VUFBQTtRQUFBO1VBQUFrTixTQUFBLENBQUF2TCxJQUFBO1VBQUF1TCxTQUFBLENBQUFyRyxFQUFBLEdBQUFxRyxTQUFBO1VBRTVDcEcsT0FBTyxDQUFDekIsS0FBSyxDQUFDLHlCQUF5QixFQUFBNkgsU0FBQSxDQUFBckcsRUFBSyxDQUFDO1FBQUE7UUFBQTtVQUFBLE9BQUFxRyxTQUFBLENBQUFwTCxJQUFBO01BQUE7SUFBQSxHQUFBa0wsUUFBQTtFQUFBLENBRWhEO0VBQUEsT0FBQUQsV0FBQSxDQUFBdEssS0FBQSxPQUFBRSxTQUFBO0FBQUE7QUFBQSxTQUNjd0ssa0JBQWtCQSxDQUFBO0VBQUEsT0FBQUMsbUJBQUEsQ0FBQTNLLEtBQUEsT0FBQUUsU0FBQTtBQUFBO0FBQUEsU0FBQXlLLG9CQUFBO0VBQUFBLG1CQUFBLEdBQUE5SCxpQkFBQSxlQUFBeEosbUJBQUEsR0FBQW9GLElBQUEsQ0FBakMsU0FBQW1NLFNBQUE7SUFBQSxJQUFBdkYsT0FBQTtJQUFBLE9BQUFoTSxtQkFBQSxHQUFBdUIsSUFBQSxVQUFBaVEsVUFBQUMsU0FBQTtNQUFBLGtCQUFBQSxTQUFBLENBQUE1TCxJQUFBLEdBQUE0TCxTQUFBLENBQUF2TixJQUFBO1FBQUE7VUFBQXVOLFNBQUEsQ0FBQTVMLElBQUE7VUFFVW1HLE9BQU8sR0FBR0YsUUFBUSxDQUFDQyxjQUFjLENBQUMsd0JBQXdCLENBQUMsQ0FBQ21FLFdBQVc7VUFBQXVCLFNBQUEsQ0FBQXZOLElBQUE7VUFBQSxPQUN2RTJNLFNBQVMsQ0FBQ0MsU0FBUyxDQUFDQyxTQUFTLENBQUMvRSxPQUFPLENBQUM7UUFBQTtVQUFBeUYsU0FBQSxDQUFBdk4sSUFBQTtVQUFBO1FBQUE7VUFBQXVOLFNBQUEsQ0FBQTVMLElBQUE7VUFBQTRMLFNBQUEsQ0FBQTFHLEVBQUEsR0FBQTBHLFNBQUE7VUFFNUN6RyxPQUFPLENBQUN6QixLQUFLLENBQUMseUJBQXlCLEVBQUFrSSxTQUFBLENBQUExRyxFQUFLLENBQUM7UUFBQTtRQUFBO1VBQUEsT0FBQTBHLFNBQUEsQ0FBQXpMLElBQUE7TUFBQTtJQUFBLEdBQUF1TCxRQUFBO0VBQUEsQ0FFaEQ7RUFBQSxPQUFBRCxtQkFBQSxDQUFBM0ssS0FBQSxPQUFBRSxTQUFBO0FBQUE7QUFBQSxTQUNjNkssY0FBY0EsQ0FBQUMsR0FBQTtFQUFBLE9BQUFDLGVBQUEsQ0FBQWpMLEtBQUEsT0FBQUUsU0FBQTtBQUFBO0FBQUEsU0FBQStLLGdCQUFBO0VBQUFBLGVBQUEsR0FBQXBJLGlCQUFBLGVBQUF4SixtQkFBQSxHQUFBb0YsSUFBQSxDQUE3QixTQUFBeU0sU0FBOEJuRSxNQUFNO0lBQUEsSUFBQW9FLHFCQUFBO0lBQUEsSUFBQWxILElBQUEsRUFBQVgsV0FBQSxFQUFBRSxRQUFBLEVBQUFDLElBQUE7SUFBQSxPQUFBcEssbUJBQUEsR0FBQXVCLElBQUEsVUFBQXdRLFVBQUFDLFNBQUE7TUFBQSxrQkFBQUEsU0FBQSxDQUFBbk0sSUFBQSxHQUFBbU0sU0FBQSxDQUFBOU4sSUFBQTtRQUFBO1VBQ2xDd0osTUFBTSxDQUFDbkIsU0FBUyxDQUFDa0QsTUFBTSxDQUFDLFlBQVksQ0FBQztVQUNyQy9CLE1BQU0sQ0FBQ25CLFNBQVMsQ0FBQ2tELE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQztVQUMzQy9CLE1BQU0sQ0FBQ3VFLFFBQVEsR0FBRyxJQUFJO1VBQ3RCdkUsTUFBTSxDQUFDbkIsU0FBUyxDQUFDQyxHQUFHLENBQUMsb0JBQW9CLENBQUM7VUFDMUNrQixNQUFNLENBQUNuQixTQUFTLENBQUNDLEdBQUcsQ0FBQyxjQUFjLENBQUM7VUFDcENrQixNQUFNLENBQUN0QixhQUFhLENBQUMsS0FBSyxDQUFDLENBQUNHLFNBQVMsQ0FBQ2tELE1BQU0sQ0FBQyxRQUFRLENBQUM7VUFDdEQvQixNQUFNLENBQUN0QixhQUFhLENBQUMsY0FBYyxDQUFDLENBQUNHLFNBQVMsQ0FBQ0MsR0FBRyxDQUFDLFFBQVEsQ0FBQztVQUM1RGtCLE1BQU0sQ0FBQ3RCLGFBQWEsQ0FBQyxlQUFlLENBQUMsQ0FBQ0csU0FBUyxDQUFDa0QsTUFBTSxDQUFDLFFBQVEsQ0FBQztVQUUxRDdFLElBQUksR0FBR2tCLFFBQVEsQ0FBQ0MsY0FBYyxDQUFDLGNBQWMsQ0FBQyxDQUFDbUUsV0FBVztVQUMxRGpHLFdBQVcsSUFBQTZILHFCQUFBLEdBQUdoRyxRQUFRLENBQUNNLGFBQWEsQ0FBQyxzREFBc0QsQ0FBQyxjQUFBMEYscUJBQUEsdUJBQTlFQSxxQkFBQSxDQUNoQnpGLE9BQU8sQ0FBQ3BDLFdBQVc7VUFBQStILFNBQUEsQ0FBQW5NLElBQUE7VUFBQW1NLFNBQUEsQ0FBQTlOLElBQUE7VUFBQSxPQUVFdUcsS0FBSyxDQUFDLDhCQUE4QixFQUFFO1lBQzNEaEgsTUFBTSxFQUFFLE1BQU07WUFDZGlILE9BQU8sRUFBRTtjQUNQLGNBQWMsRUFBRTtZQUNsQixDQUFDO1lBQ0R3SCxJQUFJLEVBQUVDLElBQUksQ0FBQ0MsU0FBUyxDQUFDO2NBQUUvSCxRQUFRLEVBQUVPLElBQUk7Y0FBRVgsV0FBVyxFQUFFQTtZQUFZLENBQUM7VUFDbkUsQ0FBQyxDQUFDO1FBQUE7VUFOSUUsUUFBUSxHQUFBNkgsU0FBQSxDQUFBcE8sSUFBQTtVQUFBLElBUVR1RyxRQUFRLENBQUNRLEVBQUU7WUFBQXFILFNBQUEsQ0FBQTlOLElBQUE7WUFBQTtVQUFBO1VBQUEsTUFDUixJQUFJWCxLQUFLLENBQUMsQ0FBQztRQUFBO1VBQUF5TyxTQUFBLENBQUE5TixJQUFBO1VBQUEsT0FHQWlHLFFBQVEsQ0FBQ1MsSUFBSSxDQUFDLENBQUM7UUFBQTtVQUE1QlIsSUFBSSxHQUFBNEgsU0FBQSxDQUFBcE8sSUFBQTtVQUFBLE1BQ053RyxJQUFJLENBQUNpSSxPQUFPLEtBQUssU0FBUztZQUFBTCxTQUFBLENBQUE5TixJQUFBO1lBQUE7VUFBQTtVQUM1QjhHLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDYixJQUFJLENBQUM7VUFBQTRILFNBQUEsQ0FBQTlOLElBQUE7VUFBQTtRQUFBO1VBQUEsTUFFWCxJQUFJWCxLQUFLLENBQUMsQ0FBQztRQUFBO1VBQUF5TyxTQUFBLENBQUE5TixJQUFBO1VBQUE7UUFBQTtVQUFBOE4sU0FBQSxDQUFBbk0sSUFBQTtVQUFBbU0sU0FBQSxDQUFBakgsRUFBQSxHQUFBaUgsU0FBQTtVQUduQmhILE9BQU8sQ0FBQ0MsR0FBRyxDQUFDLE9BQU8sRUFBQStHLFNBQUEsQ0FBQWpILEVBQU8sQ0FBQztVQUMzQjJDLE1BQU0sQ0FBQ25CLFNBQVMsQ0FBQ0MsR0FBRyxDQUFDLFlBQVksQ0FBQztVQUNsQ2tCLE1BQU0sQ0FBQ25CLFNBQVMsQ0FBQ0MsR0FBRyxDQUFDLGtCQUFrQixDQUFDO1FBQUE7VUFBQXdGLFNBQUEsQ0FBQW5NLElBQUE7VUFFeEM2SCxNQUFNLENBQUN1RSxRQUFRLEdBQUcsS0FBSztVQUN2QnZFLE1BQU0sQ0FBQ25CLFNBQVMsQ0FBQ2tELE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQztVQUM3Qy9CLE1BQU0sQ0FBQ25CLFNBQVMsQ0FBQ2tELE1BQU0sQ0FBQyxjQUFjLENBQUM7VUFDdkMvQixNQUFNLENBQUN0QixhQUFhLENBQUMsS0FBSyxDQUFDLENBQUNHLFNBQVMsQ0FBQ0MsR0FBRyxDQUFDLFFBQVEsQ0FBQztVQUNuRGtCLE1BQU0sQ0FBQ3RCLGFBQWEsQ0FBQyxjQUFjLENBQUMsQ0FBQ0csU0FBUyxDQUFDa0QsTUFBTSxDQUFDLFFBQVEsQ0FBQztVQUMvRC9CLE1BQU0sQ0FBQ3RCLGFBQWEsQ0FBQyxlQUFlLENBQUMsQ0FBQ0csU0FBUyxDQUFDQyxHQUFHLENBQUMsUUFBUSxDQUFDO1VBQUEsT0FBQXdGLFNBQUEsQ0FBQTVMLE1BQUE7UUFBQTtRQUFBO1VBQUEsT0FBQTRMLFNBQUEsQ0FBQWhNLElBQUE7TUFBQTtJQUFBLEdBQUE2TCxRQUFBO0VBQUEsQ0FFaEU7RUFBQSxPQUFBRCxlQUFBLENBQUFqTCxLQUFBLE9BQUFFLFNBQUE7QUFBQTtBQUNELFNBQVN5TCxhQUFhQSxDQUFDNUUsTUFBTSxFQUFFO0VBQzdCLElBQU1NLE1BQU0sR0FBR04sTUFBTSxDQUFDWSxPQUFPLENBQUMsU0FBUyxDQUFDO0VBQ3hDLElBQU1pRSxLQUFLLEdBQUd2RSxNQUFNLENBQUM1QixhQUFhLENBQUMsYUFBYSxDQUFDO0VBQ2pEbUcsS0FBSyxDQUFDaEcsU0FBUyxDQUFDa0QsTUFBTSxDQUFDLFFBQVEsQ0FBQztFQUNoQyxJQUFNaEMsS0FBSyxHQUFHWCxRQUFRLENBQUN2RixNQUFNLENBQUN5RyxNQUFNLENBQUNNLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDakMsT0FBTyxDQUFDVCxLQUFLLENBQUMsQ0FBQztFQUNqRjJHLEtBQUssQ0FBQ2hHLFNBQVMsQ0FBQ0MsR0FBRyxXQUFBaEMsTUFBQSxDQUFXaUQsS0FBSyxDQUFFLENBQUM7RUFDdEMzQixRQUFRLENBQUNvRyxJQUFJLENBQUMzRixTQUFTLENBQUNDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQztFQUM5Q1YsUUFBUSxDQUFDQyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUNRLFNBQVMsQ0FBQ2tELE1BQU0sQ0FBQyxRQUFRLENBQUM7RUFDN0R6QixNQUFNLENBQUM1QixhQUFhLENBQUMsY0FBYyxDQUFDLENBQUM4RCxXQUFXLEdBQUdsQyxNQUFNLENBQUM1QixhQUFhLENBQUMsYUFBYSxDQUFDLENBQUMxTCxLQUFLO0FBQzlGO0FBQ0EsU0FBUzhSLGlCQUFpQkEsQ0FBQzlFLE1BQU0sRUFBRTtFQUNqQyxJQUFNK0Usa0JBQWtCLEdBQUczRyxRQUFRLENBQUNNLGFBQWEsQ0FDL0Msc0RBQ0YsQ0FBQztFQUNEcUcsa0JBQWtCLENBQUNDLFlBQVksQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDO0VBQ3RERCxrQkFBa0IsQ0FBQ2xHLFNBQVMsQ0FBQ2tELE1BQU0sQ0FBQyxTQUFTLENBQUM7RUFDOUNnRCxrQkFBa0IsQ0FBQ2xHLFNBQVMsQ0FBQ29HLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxXQUFXLENBQUM7RUFFbkVqRixNQUFNLENBQUNnRixZQUFZLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQztFQUN6Q2hGLE1BQU0sQ0FBQ25CLFNBQVMsQ0FBQ0MsR0FBRyxDQUFDLFNBQVMsQ0FBQztFQUMvQmtCLE1BQU0sQ0FBQ25CLFNBQVMsQ0FBQ29HLE9BQU8sQ0FBQyxXQUFXLEVBQUUsZ0JBQWdCLENBQUM7RUFFdkQvQyxrQkFBa0IsQ0FBQyxDQUFDO0VBQ3BCLElBQU0zRixXQUFXLEdBQUd5RCxNQUFNLENBQUNyQixPQUFPLENBQUNwQyxXQUFXO0VBQzlDSixhQUFhLENBQUNJLFdBQVcsQ0FBQztBQUM1Qjs7QUFFQTtBQUNBLFNBQVMySSxzQkFBc0JBLENBQUEsRUFBRztFQUNoQyxJQUFNQyxVQUFVLEdBQUcvRyxRQUFRLENBQUNDLGNBQWMsQ0FBQyxTQUFTLENBQUM7RUFDckQsSUFBTStHLE1BQU0sR0FBRztJQUFFQyxTQUFTLEVBQUUsSUFBSTtJQUFFQyxPQUFPLEVBQUU7RUFBSyxDQUFDO0VBRWpELFNBQVNDLFFBQVFBLENBQUNDLGFBQWEsRUFBRUMsUUFBUSxFQUFFO0lBQUEsSUFBQUMsU0FBQSxHQUFBNUwsMEJBQUEsQ0FDcEIwTCxhQUFhO01BQUFHLEtBQUE7SUFBQTtNQUFsQyxLQUFBRCxTQUFBLENBQUFqUixDQUFBLE1BQUFrUixLQUFBLEdBQUFELFNBQUEsQ0FBQTlTLENBQUEsSUFBQWtELElBQUEsR0FBb0M7UUFBQSxJQUEzQjhQLFFBQVEsR0FBQUQsS0FBQSxDQUFBM1MsS0FBQTtRQUNmLElBQUk0UyxRQUFRLENBQUN6UixJQUFJLEtBQUssV0FBVyxFQUFFO1VBQ2pDLElBQUEwUixxQkFBQSxHQUErQ0Msc0JBQXNCLENBQUMsQ0FBQztZQUFBQyxzQkFBQSxHQUFBcEwsY0FBQSxDQUFBa0wscUJBQUE7WUFBaEVHLFlBQVksR0FBQUQsc0JBQUE7WUFBRUUsc0JBQXNCLEdBQUFGLHNCQUFBO1VBQzNDRyxrQkFBa0IsQ0FBQ0YsWUFBWSxDQUFDO1VBQ2hDRyxvQkFBb0IsQ0FBQ0Ysc0JBQXNCLENBQUM7VUFDNUNHLFlBQVksQ0FBQ0osWUFBWSxDQUFDO1VBQzFCSyw0QkFBNEIsQ0FBQ0wsWUFBWSxDQUFDO1FBQzVDO01BQ0Y7SUFBQyxTQUFBeEwsR0FBQTtNQUFBa0wsU0FBQSxDQUFBblQsQ0FBQSxDQUFBaUksR0FBQTtJQUFBO01BQUFrTCxTQUFBLENBQUFsUixDQUFBO0lBQUE7RUFDSDtFQUVBLElBQU1pUixRQUFRLEdBQUcsSUFBSWEsZ0JBQWdCLENBQUNmLFFBQVEsQ0FBQztFQUMvQ0UsUUFBUSxDQUFDYyxPQUFPLENBQUNwQixVQUFVLEVBQUVDLE1BQU0sQ0FBQztBQUN0QztBQUNBRixzQkFBc0IsQ0FBQyxDQUFDO0FBRXhCLFNBQVM5SCxpQkFBaUJBLENBQUEsRUFBRztFQUMzQmdCLFFBQVEsQ0FBQzBCLGdCQUFnQixDQUFDLG1CQUFtQixDQUFDLENBQUMxSyxPQUFPLENBQUMsVUFBQ2lOLEtBQUssRUFBSztJQUNoRUEsS0FBSyxDQUFDbUUsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLFVBQUNqVSxDQUFDLEVBQUs7TUFDckMsSUFBQWtVLHNCQUFBLEdBQStDWCxzQkFBc0IsQ0FBQyxDQUFDO1FBQUFZLHNCQUFBLEdBQUEvTCxjQUFBLENBQUE4TCxzQkFBQTtRQUFoRVQsWUFBWSxHQUFBVSxzQkFBQTtRQUFFVCxzQkFBc0IsR0FBQVMsc0JBQUE7TUFDM0NSLGtCQUFrQixDQUFDRixZQUFZLENBQUM7TUFDaENHLG9CQUFvQixDQUFDRixzQkFBc0IsQ0FBQztNQUM1Q0csWUFBWSxDQUFDSixZQUFZLENBQUM7TUFDMUJLLDRCQUE0QixDQUFDTCxZQUFZLENBQUM7SUFDNUMsQ0FBQyxDQUFDO0VBQ0osQ0FBQyxDQUFDO0FBQ0o7QUFFQTVILFFBQVEsQ0FBQ0MsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDbUksZ0JBQWdCLENBQUMsT0FBTyxFQUFFLFVBQUNqVSxDQUFDLEVBQUs7RUFDbEU2TCxRQUFRLENBQUNDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQ1EsU0FBUyxDQUFDQyxHQUFHLENBQUMsUUFBUSxDQUFDO0VBQzFEVixRQUFRLENBQUNNLGFBQWEsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDRyxTQUFTLENBQUNDLEdBQUcsQ0FBQyxRQUFRLENBQUM7RUFDMUVWLFFBQVEsQ0FBQ29HLElBQUksQ0FBQzNGLFNBQVMsQ0FBQ2tELE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQztBQUNuRCxDQUFDLENBQUM7O0FBRUY7QUFDQSxTQUFTK0Qsc0JBQXNCQSxDQUFBLEVBQUc7RUFDaEMsSUFBTW5GLFVBQVUsR0FBR3dCLGdCQUFnQixDQUFDLENBQUM7RUFDckMsSUFBTXdFLE9BQU8sR0FBRyxFQUFFO0VBQ2xCLElBQU1DLGlCQUFpQixHQUFHLEVBQUU7RUFFNUJqRyxVQUFVLENBQUN2TCxPQUFPLENBQUMsVUFBQytLLFNBQVMsRUFBSztJQUNoQyxJQUFNakMsS0FBSyxHQUFHckUsTUFBTSxDQUFDc0csU0FBUyxDQUFDeEIsT0FBTyxDQUFDVCxLQUFLLENBQUM7SUFDN0MsSUFBSUEsS0FBSyxLQUFLLENBQUMsRUFBRTtNQUNmLElBQUEySSxnQkFBQSxHQUErQ0MsZUFBZSxDQUFDM0csU0FBUyxDQUFDO1FBQUE0RyxpQkFBQSxHQUFBcE0sY0FBQSxDQUFBa00sZ0JBQUE7UUFBbEVHLFlBQVksR0FBQUQsaUJBQUE7UUFBRUUsc0JBQXNCLEdBQUFGLGlCQUFBO01BQzNDLElBQU1HLFNBQVMsR0FBR0Msa0JBQWtCLENBQUNILFlBQVksQ0FBQztNQUNsRCxJQUFNSSxtQkFBbUIsR0FBR0Qsa0JBQWtCLENBQUNGLHNCQUFzQixDQUFDO01BQ3RFTixPQUFPLENBQUMzUCxJQUFJLENBQUNrUSxTQUFTLENBQUM7TUFDdkJOLGlCQUFpQixDQUFDNVAsSUFBSSxDQUFDb1EsbUJBQW1CLENBQUM7SUFDN0MsQ0FBQyxNQUFNLElBQUlsSixLQUFLLEtBQUssQ0FBQyxFQUFFO01BQ3RCLElBQU1nSixVQUFTLEdBQUdQLE9BQU8sQ0FBQ0EsT0FBTyxDQUFDdFAsTUFBTSxHQUFHLENBQUMsQ0FBQztNQUM3QyxJQUFNK1Asb0JBQW1CLEdBQUdSLGlCQUFpQixDQUFDQSxpQkFBaUIsQ0FBQ3ZQLE1BQU0sR0FBRyxDQUFDLENBQUM7TUFDM0UsSUFBQWdRLGlCQUFBLEdBQStDUCxlQUFlLENBQUMzRyxTQUFTLENBQUM7UUFBQW1ILGlCQUFBLEdBQUEzTSxjQUFBLENBQUEwTSxpQkFBQTtRQUFsRUwsYUFBWSxHQUFBTSxpQkFBQTtRQUFFTCx1QkFBc0IsR0FBQUssaUJBQUE7TUFDM0MsSUFBTUMsV0FBVyxHQUFHSixrQkFBa0IsQ0FBQ0gsYUFBWSxDQUFDO01BQ3BELElBQU1RLHFCQUFxQixHQUFHTCxrQkFBa0IsQ0FBQ0YsdUJBQXNCLENBQUM7TUFDeEVDLFVBQVMsQ0FBQ3RKLFFBQVEsQ0FBQzVHLElBQUksQ0FBQ3VRLFdBQVcsQ0FBQztNQUNwQ0gsb0JBQW1CLENBQUN4SixRQUFRLENBQUM1RyxJQUFJLENBQUN3USxxQkFBcUIsQ0FBQztJQUMxRCxDQUFDLE1BQU07TUFDTCxJQUFNRCxZQUFXLEdBQ2ZaLE9BQU8sQ0FBQ0EsT0FBTyxDQUFDdFAsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDdUcsUUFBUSxDQUFDK0ksT0FBTyxDQUFDQSxPQUFPLENBQUN0UCxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUN1RyxRQUFRLENBQUN2RyxNQUFNLEdBQUcsQ0FBQyxDQUFDO01BQ3ZGa1EsWUFBVyxDQUFDM0osUUFBUSxHQUFHMkosWUFBVyxDQUFDM0osUUFBUSxJQUFJLEVBQUU7TUFFakQsSUFBTTRKLHNCQUFxQixHQUN6QlosaUJBQWlCLENBQUNBLGlCQUFpQixDQUFDdlAsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDdUcsUUFBUSxDQUN0RGdKLGlCQUFpQixDQUFDQSxpQkFBaUIsQ0FBQ3ZQLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQ3VHLFFBQVEsQ0FBQ3ZHLE1BQU0sR0FBRyxDQUFDLENBQ3BFO01BQ0htUSxzQkFBcUIsQ0FBQzVKLFFBQVEsR0FBRzRKLHNCQUFxQixDQUFDNUosUUFBUSxJQUFJLEVBQUU7TUFFckUsSUFBQTZKLG1CQUFBLEdBQXVEQyxrQkFBa0IsQ0FBQ3ZILFNBQVMsQ0FBQztRQUFBd0gsb0JBQUEsR0FBQWhOLGNBQUEsQ0FBQThNLG1CQUFBO1FBQTdFRyxnQkFBZ0IsR0FBQUQsb0JBQUE7UUFBRUUsMEJBQTBCLEdBQUFGLG9CQUFBO01BQ25ESixZQUFXLENBQUMzSixRQUFRLENBQUM1RyxJQUFJLENBQUM0USxnQkFBZ0IsQ0FBQztNQUMzQ0osc0JBQXFCLENBQUM1SixRQUFRLENBQUM1RyxJQUFJLENBQUM2USwwQkFBMEIsQ0FBQztJQUNqRTtFQUNGLENBQUMsQ0FBQztFQUVGLE9BQU8sQ0FBQ2xCLE9BQU8sRUFBRUMsaUJBQWlCLENBQUM7QUFDckM7QUFDQSxTQUFTekUsZ0JBQWdCQSxDQUFBLEVBQUc7RUFDMUIsSUFBTTJGLE9BQU8sR0FBRzFKLFFBQVEsQ0FBQ0MsY0FBYyxDQUFDLFNBQVMsQ0FBQztFQUNsRCxJQUFNc0MsVUFBVSxHQUFHMUcsS0FBSyxDQUFDa0IsSUFBSSxDQUFDMk0sT0FBTyxDQUFDaEksZ0JBQWdCLENBQUMsbUJBQW1CLENBQUMsQ0FBQztFQUM1RSxPQUFPYSxVQUFVO0FBQ25CO0FBQ0EsU0FBU21HLGVBQWVBLENBQUN4RyxNQUFNLEVBQUU7RUFDL0IsSUFBTXlILE1BQU0sR0FBR3pILE1BQU0sQ0FBQ1IsZ0JBQWdCLENBQUMsT0FBTyxDQUFDO0VBQy9DLElBQU03SyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0VBQ2pCLElBQU0rUyxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7RUFDM0JELE1BQU0sQ0FBQzNTLE9BQU8sQ0FBQyxVQUFDaU4sS0FBSyxFQUFLO0lBQ3hCcE4sTUFBTSxDQUFDb04sS0FBSyxDQUFDNUssSUFBSSxDQUFDLEdBQUdMLEtBQUssQ0FBQ2lMLEtBQUssQ0FBQ3JQLEtBQUssQ0FBQyxHQUFHcVAsS0FBSyxDQUFDclAsS0FBSyxHQUFHNkcsTUFBTSxDQUFDd0ksS0FBSyxDQUFDclAsS0FBSyxDQUFDO0lBQzNFLElBQU1pVixlQUFlLEdBQ25CNUYsS0FBSyxDQUFDNUssSUFBSSxLQUFLLGVBQWUsSUFBSTRLLEtBQUssQ0FBQzVLLElBQUksS0FBSyxlQUFlLEdBQzVENEssS0FBSyxDQUFDclAsS0FBSyxHQUNYa1YsYUFBYSxDQUFDN0YsS0FBSyxDQUFDclAsS0FBSyxDQUFDO0lBQ2hDZ1YsZ0JBQWdCLENBQUMzRixLQUFLLENBQUM1SyxJQUFJLENBQUMsR0FBR0wsS0FBSyxDQUFDNlEsZUFBZSxDQUFDLEdBQ2pEQSxlQUFlLEdBQ2ZwTyxNQUFNLENBQUNvTyxlQUFlLENBQUM7RUFDN0IsQ0FBQyxDQUFDO0VBRUYsT0FBTyxDQUFDaFQsTUFBTSxFQUFFK1MsZ0JBQWdCLENBQUM7QUFDbkM7QUFDQSxTQUFTTixrQkFBa0JBLENBQUN2SCxTQUFTLEVBQUU7RUFDckMsSUFBTXdHLE9BQU8sR0FBRzFNLEtBQUssQ0FBQ2tCLElBQUksQ0FBQ2dGLFNBQVMsQ0FBQ0wsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7RUFDakUsSUFBTTdLLE1BQU0sR0FBRzBSLE9BQU8sQ0FBQ3dCLEdBQUcsQ0FBQyxVQUFDN0gsTUFBTTtJQUFBLE9BQUt3RyxlQUFlLENBQUN4RyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFBQSxFQUFDO0VBQ2xFLElBQU0wSCxnQkFBZ0IsR0FBR3JCLE9BQU8sQ0FBQ3dCLEdBQUcsQ0FBQyxVQUFDN0gsTUFBTTtJQUFBLE9BQUt3RyxlQUFlLENBQUN4RyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFBQSxFQUFDO0VBQzVFLE9BQU8sQ0FBQ3JMLE1BQU0sRUFBRStTLGdCQUFnQixDQUFDO0FBQ25DO0FBQ0EsU0FBU2Isa0JBQWtCQSxDQUFDSCxZQUFZLEVBQUU7RUFDeEMsSUFBTUUsU0FBUyxHQUFBaE8sYUFBQSxDQUFBQSxhQUFBLEtBQ1Y4TixZQUFZO0lBQ2ZwSixRQUFRLEVBQUU7RUFBRSxFQUNiO0VBRUQsT0FBT3NKLFNBQVM7QUFDbEI7QUFDQSxTQUFTZ0IsYUFBYUEsQ0FBQ3pRLElBQUksRUFBRTtFQUMzQixJQUFJLENBQUNMLEtBQUssQ0FBQ0ssSUFBSSxDQUFDLEVBQUUsT0FBT0EsSUFBSTtFQUM3QixJQUFNMlEsZ0JBQWdCLEdBQUczUSxJQUFJLENBQUN3TixPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQztFQUNqRCxJQUFNb0Qsc0JBQXNCLEdBQUdELGdCQUFnQixDQUFDbkQsT0FBTyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUM7RUFDeEUsSUFBTXFELGVBQWUsR0FBR0Qsc0JBQXNCLENBQUNFLFdBQVcsQ0FBQyxDQUFDO0VBQzVELDZCQUFBekwsTUFBQSxDQUE2QndMLGVBQWU7QUFDOUM7O0FBRUE7QUFDQSxTQUFTcEMsa0JBQWtCQSxDQUFDRixZQUFZLEVBQUU7RUFDeEMsSUFBTTlJLElBQUksR0FBR3NMLGtCQUFrQixDQUFDeEMsWUFBWSxDQUFDO0VBQzdDNUgsUUFBUSxDQUFDQyxjQUFjLENBQUMsY0FBYyxDQUFDLENBQUNtRSxXQUFXLEdBQUd0RixJQUFJO0VBQzFELE9BQU84SSxZQUFZO0FBQ3JCO0FBQ0EsU0FBU3dDLGtCQUFrQkEsQ0FBQzVOLEdBQUcsRUFBRTtFQUMvQixPQUFPNkosSUFBSSxDQUFDQyxTQUFTLENBQUM5SixHQUFHLENBQUM7QUFDNUI7O0FBRUE7QUFDQSxTQUFTdUwsb0JBQW9CQSxDQUFDSCxZQUFZLEVBQUU7RUFDMUMsSUFBTXlDLFlBQVksR0FBR0MsMEJBQTBCLENBQUMxQyxZQUFZLENBQUM7RUFDN0Q1SCxRQUFRLENBQUNDLGNBQWMsQ0FBQyxlQUFlLENBQUMsQ0FBQ21FLFdBQVcsR0FBR2lHLFlBQVk7QUFDckU7QUFDQSxTQUFTQywwQkFBMEJBLENBQUM5TixHQUFHLEVBQUU7RUFDdkMsd0VBQUFrQyxNQUFBLENBRXNCMkgsSUFBSSxDQUFDQyxTQUFTLENBQUM5SixHQUFHLENBQUM7QUFJM0M7O0FBRUE7QUFDQSxTQUFTd0wsWUFBWUEsQ0FBQ0osWUFBWSxFQUFFO0VBQ2xDLElBQU0yQyxZQUFZLEdBQUdDLG1CQUFtQixDQUFDNUMsWUFBWSxDQUFDO0VBQ3RELElBQU02QyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0VBQ2pCRixZQUFZLENBQUN2VCxPQUFPLENBQUMsVUFBQ3BDLEtBQUssRUFBSztJQUM5QixJQUFNOFYsaUJBQWlCLEdBQUc5VixLQUFLLENBQUNpUyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQztJQUNuRCxJQUFNOEQsdUJBQXVCLEdBQUdELGlCQUFpQixDQUFDN0QsT0FBTyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUM7SUFDMUUsSUFBTStELGdCQUFnQixHQUFHRCx1QkFBdUIsQ0FBQ1IsV0FBVyxDQUFDLENBQUM7SUFDOURNLE1BQU0sQ0FBQ0csZ0JBQWdCLENBQUMsR0FBR2hXLEtBQUs7RUFDbEMsQ0FBQyxDQUFDO0VBQ0ZvTCxRQUFRLENBQUNDLGNBQWMsQ0FBQyxlQUFlLENBQUMsQ0FBQ21FLFdBQVcseUJBQUExRixNQUFBLENBQXVCMkgsSUFBSSxDQUFDQyxTQUFTLENBQ3ZGbUUsTUFDRixDQUFDLENBQUU7QUFDTDtBQUNBLFNBQVNELG1CQUFtQkEsQ0FBQzVDLFlBQVksRUFBRTtFQUN6QyxJQUFNMkMsWUFBWSxHQUFHLElBQUlNLEdBQUcsQ0FBQyxDQUFDO0VBQzlCakQsWUFBWSxDQUFDNVEsT0FBTyxDQUFDLFVBQUNrTCxNQUFNLEVBQUs7SUFDL0I1TixNQUFNLENBQUNzRixJQUFJLENBQUNzSSxNQUFNLENBQUMsQ0FBQ2xMLE9BQU8sQ0FBQyxVQUFDb0UsR0FBRyxFQUFLO01BQ25DLElBQ0VBLEdBQUcsS0FBSyxVQUFVLElBQ2xCQSxHQUFHLEtBQUssZUFBZSxJQUN2QkEsR0FBRyxLQUFLLGVBQWUsSUFDdkJwQyxLQUFLLENBQUNrSixNQUFNLENBQUM5RyxHQUFHLENBQUMsQ0FBQyxFQUVsQm1QLFlBQVksQ0FBQzdKLEdBQUcsQ0FBQ3dCLE1BQU0sQ0FBQzlHLEdBQUcsQ0FBQyxDQUFDLE1BQzFCLElBQUlBLEdBQUcsS0FBSyxVQUFVLEVBQUU7UUFDM0I4RyxNQUFNLENBQUM5RyxHQUFHLENBQUMsQ0FBQ3BFLE9BQU8sQ0FBQyxVQUFDeUwsS0FBSyxFQUFLO1VBQzdCbk8sTUFBTSxDQUFDc0YsSUFBSSxDQUFDNkksS0FBSyxDQUFDLENBQUN6TCxPQUFPLENBQUMsVUFBQzhULFFBQVEsRUFBSztZQUN2QyxJQUNFQSxRQUFRLEtBQUssVUFBVSxJQUN2QkEsUUFBUSxLQUFLLGVBQWUsSUFDNUJBLFFBQVEsS0FBSyxlQUFlLElBQzVCOVIsS0FBSyxDQUFDeUosS0FBSyxDQUFDcUksUUFBUSxDQUFDLENBQUMsRUFFdEJQLFlBQVksQ0FBQzdKLEdBQUcsQ0FBQytCLEtBQUssQ0FBQ3FJLFFBQVEsQ0FBQyxDQUFDLE1BQzlCLElBQUlBLFFBQVEsS0FBSyxVQUFVLEVBQUU7Y0FDaENySSxLQUFLLENBQUNxSSxRQUFRLENBQUMsQ0FBQzlULE9BQU8sQ0FBQyxVQUFDK1QsZUFBZSxFQUFLO2dCQUMzQ0EsZUFBZSxDQUFDL1QsT0FBTyxDQUFDLFVBQUNnVSxnQkFBZ0IsRUFBSztrQkFDNUMxVyxNQUFNLENBQUNzRixJQUFJLENBQUNvUixnQkFBZ0IsQ0FBQyxDQUFDaFUsT0FBTyxDQUFDLFVBQUNpVSxhQUFhLEVBQUs7b0JBQ3ZELElBQ0VBLGFBQWEsS0FBSyxVQUFVLElBQzVCQSxhQUFhLEtBQUssZUFBZSxJQUNqQ0EsYUFBYSxLQUFLLGVBQWUsSUFDakNqUyxLQUFLLENBQUNnUyxnQkFBZ0IsQ0FBQ0MsYUFBYSxDQUFDLENBQUMsRUFFdENWLFlBQVksQ0FBQzdKLEdBQUcsQ0FBQ3NLLGdCQUFnQixDQUFDQyxhQUFhLENBQUMsQ0FBQztrQkFDckQsQ0FBQyxDQUFDO2dCQUNKLENBQUMsQ0FBQztjQUNKLENBQUMsQ0FBQztZQUNKO1VBQ0YsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDO01BQ0o7SUFDRixDQUFDLENBQUM7RUFDSixDQUFDLENBQUM7RUFDRixPQUFPVixZQUFZO0FBQ3JCOztBQUVBO0FBQ0EsU0FBU3RDLDRCQUE0QkEsQ0FBQ0wsWUFBWSxFQUFFO0VBQ2xELElBQU1zRCxpQkFBaUIsR0FBR0MsNEJBQTRCLENBQUN2RCxZQUFZLENBQUM7RUFDcEUsSUFBTXlDLFlBQVksR0FBR2Usc0JBQXNCLENBQUNGLGlCQUFpQixDQUFDO0VBQzlEbEwsUUFBUSxDQUFDQyxjQUFjLENBQUMsd0JBQXdCLENBQUMsQ0FBQ21FLFdBQVcsR0FBR2lHLFlBQVk7QUFDOUU7QUFDQSxTQUFTYyw0QkFBNEJBLENBQUMzTyxHQUFHLEVBQUU7RUFDekMsSUFBTTBPLGlCQUFpQixHQUFHLEVBQUU7RUFDNUIxTyxHQUFHLENBQUN4RixPQUFPLENBQUMsVUFBQ3FVLElBQUksRUFBSztJQUNwQkEsSUFBSSxDQUFDN0wsUUFBUSxDQUFDeEksT0FBTyxDQUFDLFVBQUNzVSxRQUFRLEVBQUs7TUFDbEMsSUFBTUMsY0FBYyx5RUFBQTdNLE1BQUEsQ0FHTDJNLElBQUksQ0FBQ0csS0FBSyxHQUFHRixRQUFRLENBQUNFLEtBQUssNnBCQWV2QztNQUNITixpQkFBaUIsQ0FBQ3RTLElBQUksQ0FBQzJTLGNBQWMsQ0FBQztJQUN4QyxDQUFDLENBQUM7RUFDSixDQUFDLENBQUM7RUFDRixPQUFPTCxpQkFBaUI7QUFDMUI7QUFDQSxTQUFTRSxzQkFBc0JBLENBQUM1TyxHQUFHLEVBQUU7RUFDbkMsaWtDQUFBa0MsTUFBQSxDQXVCaUJsQyxHQUFHO0FBSXRCOztBQUVBO0FBQ0FpUCxNQUFNLENBQUN6SCxXQUFXLEdBQUdBLFdBQVc7QUFDaEN5SCxNQUFNLENBQUNuSCxzQkFBc0IsR0FBR0Esc0JBQXNCO0FBQ3REbUgsTUFBTSxDQUFDbEgsb0JBQW9CLEdBQUdBLG9CQUFvQjtBQUNsRGtILE1BQU0sQ0FBQ25JLHFCQUFxQixHQUFHQSxxQkFBcUI7QUFDcERtSSxNQUFNLENBQUNqSCx1QkFBdUIsR0FBR0EsdUJBQXVCO0FBQ3hEaUgsTUFBTSxDQUFDaEgsd0JBQXdCLEdBQUdBLHdCQUF3QjtBQUMxRGdILE1BQU0sQ0FBQy9HLFVBQVUsR0FBR0EsVUFBVTtBQUM5QitHLE1BQU0sQ0FBQzdGLGNBQWMsR0FBR0EsY0FBYztBQUN0QzZGLE1BQU0sQ0FBQ3ZHLFVBQVUsR0FBR0EsVUFBVTtBQUM5QnVHLE1BQU0sQ0FBQ2pGLGFBQWEsR0FBR0EsYUFBYTtBQUNwQ2lGLE1BQU0sQ0FBQy9FLGlCQUFpQixHQUFHQSxpQkFBaUI7QUFDNUMrRSxNQUFNLENBQUNsRyxrQkFBa0IsR0FBR0Esa0JBQWtCOztBQUU5QztBQUNBO0FBQ0E7QUFDQTtBQUNBLE8iLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9kYXNoYm9hcmQtbXlzZWxmbW9uYXJ0Ly4vcmVzb3VyY2VzL2pzL3BhaW50aW5nLW9wdGlvbnMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy9Jbml0aWFsaXplXG5hc3luYyBmdW5jdGlvbiBnZXRBbGxPcHRpb25zKGFzcGVjdFJhdGlvKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgdXJsID0gYXNwZWN0UmF0aW9cbiAgICAgID8gYC9hcGkvcGFpbnRpbmdzL29wdGlvbnMvJHthc3BlY3RSYXRpb31gXG4gICAgICA6ICcvYXBpL3BhaW50aW5ncy9vcHRpb25zL3NxdWFyZSdcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIH0sXG4gICAgfSlcblxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigpXG4gICAgfVxuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKVxuICAgIGNvbnN0IHZhcmlhbnRzID0gZGF0YS5qc29uXG4gICAgY3JlYXRlRG9tRnJvbVZhcmlhbnRzKHZhcmlhbnRzKVxuICAgIGxpc3RlblBvcHVwSW5wdXRzKClcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmxvZygnZXJyb3InLCBlcnJvcilcbiAgICBjcmVhdGVEb21Gcm9tVmFyaWFudHMoW10pXG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlRG9tRnJvbVZhcmlhbnRzKHZhcmlhbnRzKSB7XG4gIHZhcmlhbnRzLmZvckVhY2goKGZpcnN0TGV2ZWwpID0+IHtcbiAgICAvL2ZpcnN0IGxldmVsXG4gICAgY29uc3Qgb3B0aW9uRWxlbSA9IGFkZE9wdGlvbigxKVxuICAgIE9iamVjdC5rZXlzKGZpcnN0TGV2ZWwpLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgaWYgKGtleSA9PT0gJ2NoaWxkcmVuJykgcmV0dXJuXG4gICAgICBzZXRPcHRpb25WYWx1ZShvcHRpb25FbGVtLCBrZXksIGZpcnN0TGV2ZWxba2V5XSlcbiAgICB9KVxuXG4gICAgLy9zZWNvbmQgbGV2ZWxcbiAgICBmaXJzdExldmVsLmNoaWxkcmVuLmZvckVhY2goKHNlY29uZExldmVsKSA9PiB7XG4gICAgICBjb25zdCBvcHRpb25FbGVtID0gYWRkT3B0aW9uKDIpXG4gICAgICBPYmplY3Qua2V5cyhzZWNvbmRMZXZlbCkuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICAgIGlmIChrZXkgPT09ICdjaGlsZHJlbicpIHJldHVyblxuICAgICAgICBzZXRPcHRpb25WYWx1ZShvcHRpb25FbGVtLCBrZXksIHNlY29uZExldmVsW2tleV0pXG4gICAgICB9KVxuXG4gICAgICAvL3RoaXJkIGxldmVsXG4gICAgICBzZWNvbmRMZXZlbC5jaGlsZHJlbi5mb3JFYWNoKCh0aGlyZExldmVscykgPT4ge1xuICAgICAgICBsZXQgb3B0aW9uRWxlbVxuICAgICAgICB0aGlyZExldmVscy5mb3JFYWNoKCh0aGlyZExldmVsLCBpKSA9PiB7XG4gICAgICAgICAgaWYgKGkgPT09IDApIG9wdGlvbkVsZW0gPSBhZGRPcHRpb24oMylcbiAgICAgICAgICBlbHNlIG9wdGlvbkVsZW0gPSBhZGRTaWJsaW5nT3B0aW9uKG9wdGlvbkVsZW0pXG4gICAgICAgICAgT2JqZWN0LmtleXModGhpcmRMZXZlbCkuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICAgICAgICBpZiAoa2V5ID09PSAnY2hpbGRyZW4nKSByZXR1cm5cbiAgICAgICAgICAgIHNldE9wdGlvblZhbHVlKG9wdGlvbkVsZW0sIGtleSwgdGhpcmRMZXZlbFtrZXldKVxuICAgICAgICAgIH0pXG4gICAgICAgIH0pXG4gICAgICB9KVxuICAgIH0pXG4gIH0pXG59XG5nZXRBbGxPcHRpb25zKClcblxuLy9ET00gY29uc3RydWN0aW9uXG5mdW5jdGlvbiBjcmVhdGVPcHRpb25Db250YWluZXIobGV2ZWwpIHtcbiAgY29uc3QgdGVtcGxhdGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3B0aW9uLWNvbnRhaW5lcicpXG4gIGNvbnN0IGNvbnRlbnQgPSB0ZW1wbGF0ZS5jb250ZW50XG4gIGNvbnN0IGNsb25lID0gY29udGVudC5jbG9uZU5vZGUodHJ1ZSlcbiAgY29uc3QgY29udGFpbmVyT3B0aW9uRWxlbWVudCA9IGNsb25lLnF1ZXJ5U2VsZWN0b3IoJy5vcHRpb24tY29udGFpbmVyJylcbiAgY29udGFpbmVyT3B0aW9uRWxlbWVudC5kYXRhc2V0LmxldmVsID0gbGV2ZWxcbiAgY29uc3QgbWFyZ2luTGVmdCA9ICdtbC0nICsgKGxldmVsIC0gMSkgKiAxMFxuICBjb250YWluZXJPcHRpb25FbGVtZW50LmNsYXNzTGlzdC5hZGQobWFyZ2luTGVmdClcblxuICBpZiAobGV2ZWwgPT09IDMpIHtcbiAgICBjb25zdCBidXR0b25UZW1wbGF0ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidXR0b24tYWRkLXNpYmxpbmctY29udGFpbmVyJylcbiAgICBjb25zdCBidXR0b25Db250ZW50ID0gYnV0dG9uVGVtcGxhdGUuY29udGVudFxuICAgIGNvbnN0IGJ1dHRvbkNsb25lID0gYnV0dG9uQ29udGVudC5jbG9uZU5vZGUodHJ1ZSlcbiAgICBjb25zdCBidXR0b25BZGRTaWJsaW5nQ29udGFpbmVyID0gYnV0dG9uQ2xvbmUucXVlcnlTZWxlY3RvcignLmJ1dHRvbi1hZGQtc2libGluZy1jb250YWluZXInKVxuICAgIGNvbnRhaW5lck9wdGlvbkVsZW1lbnQuYXBwZW5kQ2hpbGQoYnV0dG9uQWRkU2libGluZ0NvbnRhaW5lcilcbiAgfVxuICByZXR1cm4gY29udGFpbmVyT3B0aW9uRWxlbWVudFxufVxuZnVuY3Rpb24gZ2V0Q29sb3IobGV2ZWwpIHtcbiAgc3dpdGNoIChsZXZlbCkge1xuICAgIGNhc2UgMTpcbiAgICAgIHJldHVybiAnbWFpbidcbiAgICBjYXNlIDI6XG4gICAgICByZXR1cm4gJ2N5YW4tNzAwJ1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiAnZ3JlZW4tNzAwJ1xuICB9XG59XG5mdW5jdGlvbiBjcmVhdGVPcHRpb24ocGFyZW50Q29udGFpbmVyKSB7XG4gIGNvbnN0IHRlbXBsYXRlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29wdGlvbicpXG4gIGNvbnN0IGNvbnRlbnQgPSB0ZW1wbGF0ZS5jb250ZW50XG4gIGNvbnN0IGNsb25lID0gY29udGVudC5jbG9uZU5vZGUodHJ1ZSlcbiAgY29uc3Qgb3B0aW9uRWxlbWVudCA9IGNsb25lLnF1ZXJ5U2VsZWN0b3IoJy5vcHRpb24nKVxuICBjb25zdCBuYW1lUHJpY2VFbGVtID0gb3B0aW9uRWxlbWVudC5xdWVyeVNlbGVjdG9yKCcubmFtZS1wcmljZScpXG4gIGNvbnN0IGJ1dHRvbkFkZEluZm9FbGVtID0gb3B0aW9uRWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuYnV0dG9uLWFkZC1pbmZvJylcbiAgY29uc3QgbGV2ZWwgPSBOdW1iZXIocGFyZW50Q29udGFpbmVyLmRhdGFzZXQubGV2ZWwpXG4gIGNvbnN0IGJhY2tncm91bmQgPSAnYmctJyArIGdldENvbG9yKGxldmVsKVxuICBuYW1lUHJpY2VFbGVtLmNsYXNzTGlzdC5hZGQoYmFja2dyb3VuZClcbiAgYnV0dG9uQWRkSW5mb0VsZW0uY2xhc3NMaXN0LmFkZCgndGV4dC0nICsgZ2V0Q29sb3IobGV2ZWwpKVxuICByZXR1cm4gW29wdGlvbkVsZW1lbnQsIG5hbWVQcmljZUVsZW1dXG59XG5mdW5jdGlvbiBjcmVhdGVDaGlsZE9yU2libGluZ0J1dHRvbnMocGFyZW50Q29udGFpbmVyKSB7XG4gIGNvbnN0IHRlbXBsYXRlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J1dHRvbi1jcmVhdGUtY2hpbGQtb3Itc2libGluZycpXG4gIGNvbnN0IGNvbnRlbnQgPSB0ZW1wbGF0ZS5jb250ZW50XG4gIGNvbnN0IGNsb25lID0gY29udGVudC5jbG9uZU5vZGUodHJ1ZSlcbiAgY29uc3QgYnV0dG9uc1dyYXBwZXIgPSBjbG9uZS5xdWVyeVNlbGVjdG9yKCcuYnV0dG9uLWNyZWF0ZS1jaGlsZC1vci1zaWJsaW5nJylcbiAgY29uc3QgYnV0dG9ucyA9IGJ1dHRvbnNXcmFwcGVyLnF1ZXJ5U2VsZWN0b3JBbGwoJ2J1dHRvbicpXG4gIGNvbnN0IGxldmVsID0gTnVtYmVyKHBhcmVudENvbnRhaW5lci5kYXRhc2V0LmxldmVsKVxuICBjb25zdCBjb2xvciA9IGdldENvbG9yKGxldmVsKVxuICBidXR0b25zLmZvckVhY2goKGJ1dHRvbikgPT4ge1xuICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKGBib3JkZXItJHtjb2xvcn1gKVxuICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKGB0ZXh0LSR7Y29sb3J9YClcbiAgICBidXR0b24uY2xhc3NMaXN0LmFkZChgaG92ZXI6YmctJHtjb2xvcn1gKVxuICB9KVxuICByZXR1cm4gYnV0dG9uc1dyYXBwZXJcbn1cbmZ1bmN0aW9uIGNyZWF0ZVNpYmxpbmdCdXR0b24ocGFyZW50Q29udGFpbmVyKSB7XG4gIGNvbnN0IHRlbXBsYXRlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J1dHRvbi1hZGQtc2libGluZycpXG4gIGNvbnN0IGNvbnRlbnQgPSB0ZW1wbGF0ZS5jb250ZW50XG4gIGNvbnN0IGNsb25lID0gY29udGVudC5jbG9uZU5vZGUodHJ1ZSlcbiAgY29uc3QgYnV0dG9uID0gY2xvbmUucXVlcnlTZWxlY3RvcignYnV0dG9uJylcbiAgY29uc3QgbGV2ZWwgPSBOdW1iZXIocGFyZW50Q29udGFpbmVyLmRhdGFzZXQubGV2ZWwpXG4gIGNvbnN0IGNvbG9yID0gZ2V0Q29sb3IobGV2ZWwpXG4gIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKGBib3JkZXItJHtjb2xvcn1gKVxuICBidXR0b24uY2xhc3NMaXN0LmFkZChgdGV4dC0ke2NvbG9yfWApXG4gIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKGBob3ZlcjpiZy0ke2NvbG9yfWApXG4gIHJldHVybiBidXR0b25cbn1cblxuLy9ET00gaW5zZXJ0aW9uXG5mdW5jdGlvbiBhZGRPcHRpb24obGV2ZWwsIG5leHRDb250YWluZXIpIHtcbiAgY29uc3QgY29udGFpbmVyID0gY3JlYXRlT3B0aW9uQ29udGFpbmVyKGxldmVsKVxuICBjb25zdCBbb3B0aW9uLCBuYW1lUHJpY2VdID0gY3JlYXRlT3B0aW9uKGNvbnRhaW5lcilcbiAgaWYgKGxldmVsIDwgMykge1xuICAgIGNvbnN0IGJ1dHRvbnMgPSBjcmVhdGVDaGlsZE9yU2libGluZ0J1dHRvbnMoY29udGFpbmVyKVxuICAgIG5hbWVQcmljZS5hcHBlbmRDaGlsZChidXR0b25zKVxuICB9IGVsc2Uge1xuICAgIGNvbnN0IGJ1dHRvbiA9IGNyZWF0ZVNpYmxpbmdCdXR0b24oY29udGFpbmVyKVxuICAgIG5hbWVQcmljZS5hcHBlbmRDaGlsZChidXR0b24pXG4gIH1cblxuICBpZiAobmV4dENvbnRhaW5lcikgbmV4dENvbnRhaW5lci5iZWZvcmUoY29udGFpbmVyKVxuICBlbHNlIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd3cmFwcGVyJykuYXBwZW5kQ2hpbGQoY29udGFpbmVyKVxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQob3B0aW9uKVxuICByZXR1cm4gb3B0aW9uXG59XG5mdW5jdGlvbiBhZGRPcHRpb25BZnRlcih0YXJnZXRDb250YWluZXIpIHtcbiAgY29uc3QgbGV2ZWwgPSBOdW1iZXIodGFyZ2V0Q29udGFpbmVyLmRhdGFzZXQubGV2ZWwpXG4gIGNvbnN0IGNvbnRhaW5lcnMgPSBBcnJheS5mcm9tKHRhcmdldENvbnRhaW5lci5jbG9zZXN0KCcjd3JhcHBlcicpLmNoaWxkcmVuKS5maWx0ZXIoKGNoaWxkKSA9PlxuICAgIGNoaWxkLmNsYXNzTGlzdC5jb250YWlucygnb3B0aW9uLWNvbnRhaW5lcicpXG4gIClcbiAgY29uc3QgY29udGFpbmVyc0FmdGVyID0gY29udGFpbmVycy5zbGljZShjb250YWluZXJzLmluZGV4T2YodGFyZ2V0Q29udGFpbmVyKSArIDEpXG4gIGNvbnN0IGNvbnRhaW5lcnNBZnRlclNhbWVMZXZlbCA9IGNvbnRhaW5lcnNBZnRlci5maWx0ZXIoXG4gICAgKGNvbnRhaW5lcikgPT4gTnVtYmVyKGNvbnRhaW5lci5kYXRhc2V0LmxldmVsKSA9PT0gbGV2ZWxcbiAgKVxuICBsZXQgbmV4dENvbnRhaW5lciA9IGNvbnRhaW5lcnNBZnRlclNhbWVMZXZlbFswXVxuXG4gIGlmICghbmV4dENvbnRhaW5lcikge1xuICAgIGNvbnN0IGNvbnRhaW5lcnNBZnRlclByZXZpb3VzTGV2ZWwgPSBjb250YWluZXJzQWZ0ZXIuZmlsdGVyKFxuICAgICAgKGNvbnRhaW5lcikgPT4gTnVtYmVyKGNvbnRhaW5lci5kYXRhc2V0LmxldmVsKSA9PT0gbGV2ZWwgLSAxXG4gICAgKVxuICAgIG5leHRDb250YWluZXIgPSBjb250YWluZXJzQWZ0ZXJQcmV2aW91c0xldmVsWzBdXG4gIH1cblxuICBpZiAobmV4dENvbnRhaW5lcikge1xuICAgIGFkZE9wdGlvbihsZXZlbCwgbmV4dENvbnRhaW5lcilcbiAgfSBlbHNlIHtcbiAgICBhZGRPcHRpb24obGV2ZWwpXG4gIH1cbn1cbmZ1bmN0aW9uIGFkZE9wdGlvbkJlZm9yZSh0YXJnZXRDb250YWluZXIpIHtcbiAgY29uc3QgbGV2ZWwgPSBOdW1iZXIodGFyZ2V0Q29udGFpbmVyLmRhdGFzZXQubGV2ZWwpXG4gIGNvbnN0IG5ld2xldmVsID0gbGV2ZWwgPj0gMyA/IDMgOiBsZXZlbCArIDFcbiAgY29uc3QgbmV4dENvbnRhaW5lciA9IHRhcmdldENvbnRhaW5lci5uZXh0RWxlbWVudFNpYmxpbmdcbiAgaWYgKCFuZXh0Q29udGFpbmVyKSB7XG4gICAgYWRkT3B0aW9uKG5ld2xldmVsKVxuICAgIHJldHVyblxuICB9XG4gIGFkZE9wdGlvbihuZXdsZXZlbCwgbmV4dENvbnRhaW5lcilcbn1cbmZ1bmN0aW9uIGFkZFNpYmxpbmdPcHRpb24odGFyZ2V0T3B0aW9uKSB7XG4gIGNvbnN0IGNvbnRhaW5lciA9IHRhcmdldE9wdGlvbi5jbG9zZXN0KCcub3B0aW9uLWNvbnRhaW5lcicpXG4gIGNvbnN0IFtvcHRpb24sIG5hbWVQcmljZV0gPSBjcmVhdGVPcHRpb24oY29udGFpbmVyKVxuICBjb25zdCBidXR0b24gPSBjcmVhdGVTaWJsaW5nQnV0dG9uKGNvbnRhaW5lcilcbiAgbmFtZVByaWNlLmFwcGVuZENoaWxkKGJ1dHRvbilcbiAgdGFyZ2V0T3B0aW9uLmFmdGVyKG9wdGlvbilcbiAgcmV0dXJuIG9wdGlvblxufVxuXG4vL0RPTSBSZW1vdmFsXG5mdW5jdGlvbiByZWN1cnNpdmVSZW1vdmVPcHRpb24odGFyZ2V0LCBuZXh0Q29udGFpbmVyLCBiYXNlTGV2ZWwpIHtcbiAgY29uc3QgdGFyZ2V0T3B0aW9uID0gdGFyZ2V0LmNsb3Nlc3QoJy5vcHRpb24nKSA/PyB0YXJnZXRcbiAgY29uc3QgY29udGFpbmVyID0gdGFyZ2V0T3B0aW9uLmNsb3Nlc3QoJy5vcHRpb24tY29udGFpbmVyJylcbiAgY29uc3QgbGV2ZWwgPSBOdW1iZXIoY29udGFpbmVyLmRhdGFzZXQubGV2ZWwpXG5cbiAgY29uc3QgbmV4dE5leHRDb250YWluZXIgPSBjb250YWluZXIubmV4dEVsZW1lbnRTaWJsaW5nXG5cbiAgaWYgKCFuZXh0TmV4dENvbnRhaW5lciAmJiBuZXh0Q29udGFpbmVyKSB7XG4gICAgbmV4dENvbnRhaW5lci5yZW1vdmUoKVxuICB9IGVsc2UgaWYgKG5leHROZXh0Q29udGFpbmVyICYmIE51bWJlcihuZXh0TmV4dENvbnRhaW5lci5kYXRhc2V0LmxldmVsKSA+IChiYXNlTGV2ZWwgPz8gbGV2ZWwpKSB7XG4gICAgY29uc3QgbmV4dE5leHRUYWdldE9wdGlvbiA9IG5leHROZXh0Q29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5vcHRpb24nKVxuICAgIHJlY3Vyc2l2ZVJlbW92ZU9wdGlvbihuZXh0TmV4dFRhZ2V0T3B0aW9uLCBuZXh0TmV4dENvbnRhaW5lciwgYmFzZUxldmVsID8/IGxldmVsKVxuICAgIGNvbnRhaW5lci5yZW1vdmUoKVxuICB9IGVsc2Uge1xuICAgIHRhcmdldE9wdGlvbi5yZW1vdmUoKVxuICAgIGNvbnN0IG90aGVyT3B0aW9ucyA9IEFycmF5LmZyb20oY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5vcHRpb24nKSlcbiAgICBpZiAob3RoZXJPcHRpb25zLmxlbmd0aCA9PT0gMCkgY29udGFpbmVyLnJlbW92ZSgpXG4gIH1cbn1cbmZ1bmN0aW9uIHJlbW92ZUFsbENvbnRhaW5lcigpIHtcbiAgY29uc3QgY29udGFpbmVycyA9IGdldEFsbENvbnRhaW5lcnMoKVxuICBjb250YWluZXJzLmZvckVhY2goKGNvbnRhaW5lcikgPT4gY29udGFpbmVyLnJlbW92ZSgpKVxufVxuXG4vL0RPTSBtYW5pcHVsYXRpb25cbmZ1bmN0aW9uIGFkanVzdFdpZHRoKGlucHV0KSB7XG4gIGNvbnN0IG1pcnJvclNwYW4gPSBpbnB1dC5uZXh0RWxlbWVudFNpYmxpbmdcbiAgaWYgKCFtaXJyb3JTcGFuIHx8IG1pcnJvclNwYW4ubm9kZU5hbWUgIT09ICdTUEFOJykgcmV0dXJuXG4gIG1pcnJvclNwYW4udGV4dENvbnRlbnQgPSBpbnB1dC52YWx1ZVxufVxuZnVuY3Rpb24gc2V0T3B0aW9uVmFsdWUob3B0aW9uRWxlbSwgcHJvcGVydHksIHZhbHVlKSB7XG4gIGNvbnN0IGlucHV0ID0gb3B0aW9uRWxlbS5xdWVyeVNlbGVjdG9yKGBpbnB1dFtuYW1lPVwiJHtwcm9wZXJ0eX1cIl1gKVxuICBpZiAoIWlucHV0KSByZXR1cm5cbiAgaW5wdXQudmFsdWUgPSB2YWx1ZVxuICBhZGp1c3RXaWR0aChpbnB1dClcbn1cblxuLy9CdXR0b25zIGFjdGlvbnNcbmZ1bmN0aW9uIGFkZFNpYmxpbmdPcHRpb25BY3Rpb24oYnV0dG9uKSB7XG4gIGNvbnN0IHRhcmdldENvbnRhaW5lciA9IGJ1dHRvbi5jbG9zZXN0KCcub3B0aW9uLWNvbnRhaW5lcicpXG4gIGFkZE9wdGlvbkFmdGVyKHRhcmdldENvbnRhaW5lcilcbn1cbmZ1bmN0aW9uIGFkZENoaWxkT3B0aW9uQWN0aW9uKGJ1dHRvbikge1xuICBjb25zdCB0YXJnZXRDb250YWluZXIgPSBidXR0b24uY2xvc2VzdCgnLm9wdGlvbi1jb250YWluZXInKVxuICBhZGRPcHRpb25CZWZvcmUodGFyZ2V0Q29udGFpbmVyKVxufVxuZnVuY3Rpb24gYWRkU2libGluZ09wdGlvbkFjdGlvbjIoYnV0dG9uKSB7XG4gIGNvbnN0IHRhcmdldE9wdGlvbiA9IGJ1dHRvbi5jbG9zZXN0KCcub3B0aW9uJylcbiAgYWRkU2libGluZ09wdGlvbih0YXJnZXRPcHRpb24pXG59XG5mdW5jdGlvbiBhZGRDb250YWluZXJMZXZlbDNBY3Rpb24oYnV0dG9uKSB7XG4gIGNvbnN0IGNvbnRhaW5lciA9IGJ1dHRvbi5jbG9zZXN0KCcub3B0aW9uLWNvbnRhaW5lcicpXG4gIGFkZE9wdGlvbkJlZm9yZShjb250YWluZXIpXG59XG5hc3luYyBmdW5jdGlvbiBjb3B5U2NyaXB0KCkge1xuICB0cnkge1xuICAgIGNvbnN0IGNvbnRlbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3RyaW5nLXNjcmlwdCcpLnRleHRDb250ZW50XG4gICAgYXdhaXQgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoY29udGVudClcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyZXVyIGxvcnMgZGUgbGEgY29waWUnLCBlcnIpXG4gIH1cbn1cbmFzeW5jIGZ1bmN0aW9uIGNvcHlMb2NhbGUoKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgY29udGVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdHJpbmctbG9jYWxlJykudGV4dENvbnRlbnRcbiAgICBhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChjb250ZW50KVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJldXIgbG9ycyBkZSBsYSBjb3BpZScsIGVycilcbiAgfVxufVxuYXN5bmMgZnVuY3Rpb24gY29weVN0cnVjdHVyZWREYXRhKCkge1xuICB0cnkge1xuICAgIGNvbnN0IGNvbnRlbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3RyaW5nLXN0cnVjdHVyZWQtZGF0YScpLnRleHRDb250ZW50XG4gICAgYXdhaXQgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoY29udGVudClcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyZXVyIGxvcnMgZGUgbGEgY29waWUnLCBlcnIpXG4gIH1cbn1cbmFzeW5jIGZ1bmN0aW9uIHNhdmVUb0RhdGFiYXNlKGJ1dHRvbikge1xuICBidXR0b24uY2xhc3NMaXN0LnJlbW92ZSgnYmctcmVkLTYwMCcpXG4gIGJ1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCdob3ZlcjpiZy1yZWQtNzAwJylcbiAgYnV0dG9uLmRpc2FibGVkID0gdHJ1ZVxuICBidXR0b24uY2xhc3NMaXN0LmFkZCgnY3Vyc29yLW5vdC1hbGxvd2VkJylcbiAgYnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2JnLWdyZWVuLTcwMCcpXG4gIGJ1dHRvbi5xdWVyeVNlbGVjdG9yKCdzdmcnKS5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKVxuICBidXR0b24ucXVlcnlTZWxlY3RvcignI3N0YXRpYy10ZXh0JykuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJylcbiAgYnV0dG9uLnF1ZXJ5U2VsZWN0b3IoJyNsb2FkaW5nLXRleHQnKS5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKVxuXG4gIGNvbnN0IGpzb24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnanNvbi10by1zYXZlJykudGV4dENvbnRlbnRcbiAgY29uc3QgYXNwZWN0UmF0aW8gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjYXNwZWN0LXJhdGlvbi1zZWxlY3Rpb24gYnV0dG9uW2FyaWEtcHJlc3NlZD1cInRydWVcIl0nKVxuICAgID8uZGF0YXNldC5hc3BlY3RSYXRpb1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goJy9hcGkvcGFpbnRpbmdzL29wdGlvbnMvc3RvcmUnLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IHZhcmlhbnRzOiBqc29uLCBhc3BlY3RSYXRpbzogYXNwZWN0UmF0aW8gfSksXG4gICAgfSlcblxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigpXG4gICAgfVxuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKVxuICAgIGlmIChkYXRhLm1lc3NhZ2UgPT09ICdzdWNjZXNzJykge1xuICAgICAgY29uc29sZS5sb2coZGF0YSlcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKClcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5sb2coJ2Vycm9yJywgZXJyb3IpXG4gICAgYnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2JnLXJlZC02MDAnKVxuICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdob3ZlcjpiZy1yZWQtNzAwJylcbiAgfSBmaW5hbGx5IHtcbiAgICBidXR0b24uZGlzYWJsZWQgPSBmYWxzZVxuICAgIGJ1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCdjdXJzb3Itbm90LWFsbG93ZWQnKVxuICAgIGJ1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCdiZy1ncmVlbi03MDAnKVxuICAgIGJ1dHRvbi5xdWVyeVNlbGVjdG9yKCdzdmcnKS5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKVxuICAgIGJ1dHRvbi5xdWVyeVNlbGVjdG9yKCcjc3RhdGljLXRleHQnKS5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKVxuICAgIGJ1dHRvbi5xdWVyeVNlbGVjdG9yKCcjbG9hZGluZy10ZXh0JykuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJylcbiAgfVxufVxuZnVuY3Rpb24gc2hvd0luZm9Qb3B1cChidXR0b24pIHtcbiAgY29uc3Qgb3B0aW9uID0gYnV0dG9uLmNsb3Nlc3QoJy5vcHRpb24nKVxuICBjb25zdCBwb3B1cCA9IG9wdGlvbi5xdWVyeVNlbGVjdG9yKCcucG9wdXAtaW5mbycpXG4gIHBvcHVwLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpXG4gIGNvbnN0IGNvbG9yID0gZ2V0Q29sb3IoTnVtYmVyKG9wdGlvbi5jbG9zZXN0KCcub3B0aW9uLWNvbnRhaW5lcicpLmRhdGFzZXQubGV2ZWwpKVxuICBwb3B1cC5jbGFzc0xpc3QuYWRkKGBib3JkZXItJHtjb2xvcn1gKVxuICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5hZGQoJ292ZXJmbG93LWhpZGRlbicpXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvdmVybGF5JykuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJylcbiAgb3B0aW9uLnF1ZXJ5U2VsZWN0b3IoJy5wb3B1cC10aXRsZScpLnRleHRDb250ZW50ID0gb3B0aW9uLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W25hbWVdJykudmFsdWVcbn1cbmZ1bmN0aW9uIHNlbGVjdEFzcGVjdFJhdGlvKGJ1dHRvbikge1xuICBjb25zdCBsYXN0QnV0dG9uU2VsZWN0ZWQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFxuICAgICcjYXNwZWN0LXJhdGlvbi1zZWxlY3Rpb24gYnV0dG9uW2FyaWEtcHJlc3NlZD1cInRydWVcIl0nXG4gIClcbiAgbGFzdEJ1dHRvblNlbGVjdGVkLnNldEF0dHJpYnV0ZSgnYXJpYS1wcmVzc2VkJywgZmFsc2UpXG4gIGxhc3RCdXR0b25TZWxlY3RlZC5jbGFzc0xpc3QucmVtb3ZlKCdiZy1tYWluJylcbiAgbGFzdEJ1dHRvblNlbGVjdGVkLmNsYXNzTGlzdC5yZXBsYWNlKCd0ZXh0LXNlY29uZGFyeScsICd0ZXh0LW1haW4nKVxuXG4gIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcsIHRydWUpXG4gIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdiZy1tYWluJylcbiAgYnV0dG9uLmNsYXNzTGlzdC5yZXBsYWNlKCd0ZXh0LW1haW4nLCAndGV4dC1zZWNvbmRhcnknKVxuXG4gIHJlbW92ZUFsbENvbnRhaW5lcigpXG4gIGNvbnN0IGFzcGVjdFJhdGlvID0gYnV0dG9uLmRhdGFzZXQuYXNwZWN0UmF0aW9cbiAgZ2V0QWxsT3B0aW9ucyhhc3BlY3RSYXRpbylcbn1cblxuLy9MaXN0ZW5lcnNcbmZ1bmN0aW9uIHRyaWdnZXJBZnRlckNoYW5nZW1lbnQoKSB7XG4gIGNvbnN0IHRhcmdldE5vZGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd3JhcHBlcicpXG4gIGNvbnN0IGNvbmZpZyA9IHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH1cblxuICBmdW5jdGlvbiBjYWxsYmFjayhtdXRhdGlvbnNMaXN0LCBvYnNlcnZlcikge1xuICAgIGZvciAobGV0IG11dGF0aW9uIG9mIG11dGF0aW9uc0xpc3QpIHtcbiAgICAgIGlmIChtdXRhdGlvbi50eXBlID09PSAnY2hpbGRMaXN0Jykge1xuICAgICAgICBjb25zdCBbb3B0aW9uc0FycmF5LCBvcHRpb25zQXJyYXlUcmFuc2xhdGVkXSA9IGNyZWF0ZUFycmF5RnJvbU9wdGlvbnMoKVxuICAgICAgICBjcmVhdGVKU09OVG9Db3BpZWQob3B0aW9uc0FycmF5KVxuICAgICAgICBjcmVhdGVTY3JpcHRUb0NvcGllZChvcHRpb25zQXJyYXlUcmFuc2xhdGVkKVxuICAgICAgICBjcmVhdGVMb2NhbGUob3B0aW9uc0FycmF5KVxuICAgICAgICBjcmVhdGVTdHJ1Y3R1cmVkRGF0YVRvQ29waWVkKG9wdGlvbnNBcnJheSlcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGNhbGxiYWNrKVxuICBvYnNlcnZlci5vYnNlcnZlKHRhcmdldE5vZGUsIGNvbmZpZylcbn1cbnRyaWdnZXJBZnRlckNoYW5nZW1lbnQoKVxuXG5mdW5jdGlvbiBsaXN0ZW5Qb3B1cElucHV0cygpIHtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLnBvcHVwLWluZm8gaW5wdXQnKS5mb3JFYWNoKChpbnB1dCkgPT4ge1xuICAgIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKGUpID0+IHtcbiAgICAgIGNvbnN0IFtvcHRpb25zQXJyYXksIG9wdGlvbnNBcnJheVRyYW5zbGF0ZWRdID0gY3JlYXRlQXJyYXlGcm9tT3B0aW9ucygpXG4gICAgICBjcmVhdGVKU09OVG9Db3BpZWQob3B0aW9uc0FycmF5KVxuICAgICAgY3JlYXRlU2NyaXB0VG9Db3BpZWQob3B0aW9uc0FycmF5VHJhbnNsYXRlZClcbiAgICAgIGNyZWF0ZUxvY2FsZShvcHRpb25zQXJyYXkpXG4gICAgICBjcmVhdGVTdHJ1Y3R1cmVkRGF0YVRvQ29waWVkKG9wdGlvbnNBcnJheSlcbiAgICB9KVxuICB9KVxufVxuXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3ZlcmxheScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ292ZXJsYXknKS5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKVxuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcucG9wdXAtaW5mbzpub3QoLmhpZGRlbiknKS5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKVxuICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoJ292ZXJmbG93LWhpZGRlbicpXG59KVxuXG4vL0RvbSB0byBBcnJheVxuZnVuY3Rpb24gY3JlYXRlQXJyYXlGcm9tT3B0aW9ucygpIHtcbiAgY29uc3QgY29udGFpbmVycyA9IGdldEFsbENvbnRhaW5lcnMoKVxuICBjb25zdCBvcHRpb25zID0gW11cbiAgY29uc3Qgb3B0aW9uc1RyYW5zbGF0ZWQgPSBbXVxuXG4gIGNvbnRhaW5lcnMuZm9yRWFjaCgoY29udGFpbmVyKSA9PiB7XG4gICAgY29uc3QgbGV2ZWwgPSBOdW1iZXIoY29udGFpbmVyLmRhdGFzZXQubGV2ZWwpXG4gICAgaWYgKGxldmVsID09PSAxKSB7XG4gICAgICBjb25zdCBbb3B0aW9uVmFsdWVzLCBvcHRpb25WYWx1ZXNUcmFuc2xhdGVkXSA9IGdldE9wdGlvblZhbHVlcyhjb250YWluZXIpXG4gICAgICBjb25zdCB0b3BPYmplY3QgPSBjcmVhdGVQYXJlbnRPYmplY3Qob3B0aW9uVmFsdWVzKVxuICAgICAgY29uc3QgdG9wT2JqZWN0VHJhbnNsYXRlZCA9IGNyZWF0ZVBhcmVudE9iamVjdChvcHRpb25WYWx1ZXNUcmFuc2xhdGVkKVxuICAgICAgb3B0aW9ucy5wdXNoKHRvcE9iamVjdClcbiAgICAgIG9wdGlvbnNUcmFuc2xhdGVkLnB1c2godG9wT2JqZWN0VHJhbnNsYXRlZClcbiAgICB9IGVsc2UgaWYgKGxldmVsID09PSAyKSB7XG4gICAgICBjb25zdCB0b3BPYmplY3QgPSBvcHRpb25zW29wdGlvbnMubGVuZ3RoIC0gMV1cbiAgICAgIGNvbnN0IHRvcE9iamVjdFRyYW5zbGF0ZWQgPSBvcHRpb25zVHJhbnNsYXRlZFtvcHRpb25zVHJhbnNsYXRlZC5sZW5ndGggLSAxXVxuICAgICAgY29uc3QgW29wdGlvblZhbHVlcywgb3B0aW9uVmFsdWVzVHJhbnNsYXRlZF0gPSBnZXRPcHRpb25WYWx1ZXMoY29udGFpbmVyKVxuICAgICAgY29uc3QgY2hpbGRPYmplY3QgPSBjcmVhdGVQYXJlbnRPYmplY3Qob3B0aW9uVmFsdWVzKVxuICAgICAgY29uc3QgY2hpbGRPYmplY3R0cmFuc2xhdGVkID0gY3JlYXRlUGFyZW50T2JqZWN0KG9wdGlvblZhbHVlc1RyYW5zbGF0ZWQpXG4gICAgICB0b3BPYmplY3QuY2hpbGRyZW4ucHVzaChjaGlsZE9iamVjdClcbiAgICAgIHRvcE9iamVjdFRyYW5zbGF0ZWQuY2hpbGRyZW4ucHVzaChjaGlsZE9iamVjdHRyYW5zbGF0ZWQpXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGNoaWxkT2JqZWN0ID1cbiAgICAgICAgb3B0aW9uc1tvcHRpb25zLmxlbmd0aCAtIDFdLmNoaWxkcmVuW29wdGlvbnNbb3B0aW9ucy5sZW5ndGggLSAxXS5jaGlsZHJlbi5sZW5ndGggLSAxXVxuICAgICAgY2hpbGRPYmplY3QuY2hpbGRyZW4gPSBjaGlsZE9iamVjdC5jaGlsZHJlbiB8fCBbXVxuXG4gICAgICBjb25zdCBjaGlsZE9iamVjdHRyYW5zbGF0ZWQgPVxuICAgICAgICBvcHRpb25zVHJhbnNsYXRlZFtvcHRpb25zVHJhbnNsYXRlZC5sZW5ndGggLSAxXS5jaGlsZHJlbltcbiAgICAgICAgICBvcHRpb25zVHJhbnNsYXRlZFtvcHRpb25zVHJhbnNsYXRlZC5sZW5ndGggLSAxXS5jaGlsZHJlbi5sZW5ndGggLSAxXG4gICAgICAgIF1cbiAgICAgIGNoaWxkT2JqZWN0dHJhbnNsYXRlZC5jaGlsZHJlbiA9IGNoaWxkT2JqZWN0dHJhbnNsYXRlZC5jaGlsZHJlbiB8fCBbXVxuXG4gICAgICBjb25zdCBbb3B0aW9uVmFsdWVzTGlzdCwgb3B0aW9uVmFsdWVzTGlzdFRyYW5zbGF0ZWRdID0gZ2V0QWxsT3B0aW9uVmFsdWVzKGNvbnRhaW5lcilcbiAgICAgIGNoaWxkT2JqZWN0LmNoaWxkcmVuLnB1c2gob3B0aW9uVmFsdWVzTGlzdClcbiAgICAgIGNoaWxkT2JqZWN0dHJhbnNsYXRlZC5jaGlsZHJlbi5wdXNoKG9wdGlvblZhbHVlc0xpc3RUcmFuc2xhdGVkKVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gW29wdGlvbnMsIG9wdGlvbnNUcmFuc2xhdGVkXVxufVxuZnVuY3Rpb24gZ2V0QWxsQ29udGFpbmVycygpIHtcbiAgY29uc3Qgd3JhcHBlciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd3cmFwcGVyJylcbiAgY29uc3QgY29udGFpbmVycyA9IEFycmF5LmZyb20od3JhcHBlci5xdWVyeVNlbGVjdG9yQWxsKCcub3B0aW9uLWNvbnRhaW5lcicpKVxuICByZXR1cm4gY29udGFpbmVyc1xufVxuZnVuY3Rpb24gZ2V0T3B0aW9uVmFsdWVzKG9wdGlvbikge1xuICBjb25zdCBpbnB1dHMgPSBvcHRpb24ucXVlcnlTZWxlY3RvckFsbCgnaW5wdXQnKVxuICBjb25zdCB2YWx1ZXMgPSB7fVxuICBjb25zdCB2YWx1ZXNUcmFuc2xhdGVkID0ge31cbiAgaW5wdXRzLmZvckVhY2goKGlucHV0KSA9PiB7XG4gICAgdmFsdWVzW2lucHV0Lm5hbWVdID0gaXNOYU4oaW5wdXQudmFsdWUpID8gaW5wdXQudmFsdWUgOiBOdW1iZXIoaW5wdXQudmFsdWUpXG4gICAgY29uc3QgdHJhbnNsYXRlZFZhbHVlID1cbiAgICAgIGlucHV0Lm5hbWUgPT09ICd0ZWNobmljYWxUeXBlJyB8fCBpbnB1dC5uYW1lID09PSAndGVjaG5pY2FsTmFtZSdcbiAgICAgICAgPyBpbnB1dC52YWx1ZVxuICAgICAgICA6IHRyYW5zbGF0ZU5hbWUoaW5wdXQudmFsdWUpXG4gICAgdmFsdWVzVHJhbnNsYXRlZFtpbnB1dC5uYW1lXSA9IGlzTmFOKHRyYW5zbGF0ZWRWYWx1ZSlcbiAgICAgID8gdHJhbnNsYXRlZFZhbHVlXG4gICAgICA6IE51bWJlcih0cmFuc2xhdGVkVmFsdWUpXG4gIH0pXG5cbiAgcmV0dXJuIFt2YWx1ZXMsIHZhbHVlc1RyYW5zbGF0ZWRdXG59XG5mdW5jdGlvbiBnZXRBbGxPcHRpb25WYWx1ZXMoY29udGFpbmVyKSB7XG4gIGNvbnN0IG9wdGlvbnMgPSBBcnJheS5mcm9tKGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCcub3B0aW9uJykpXG4gIGNvbnN0IHZhbHVlcyA9IG9wdGlvbnMubWFwKChvcHRpb24pID0+IGdldE9wdGlvblZhbHVlcyhvcHRpb24pWzBdKVxuICBjb25zdCB2YWx1ZXNUcmFuc2xhdGVkID0gb3B0aW9ucy5tYXAoKG9wdGlvbikgPT4gZ2V0T3B0aW9uVmFsdWVzKG9wdGlvbilbMV0pXG4gIHJldHVybiBbdmFsdWVzLCB2YWx1ZXNUcmFuc2xhdGVkXVxufVxuZnVuY3Rpb24gY3JlYXRlUGFyZW50T2JqZWN0KG9wdGlvblZhbHVlcykge1xuICBjb25zdCB0b3BPYmplY3QgPSB7XG4gICAgLi4ub3B0aW9uVmFsdWVzLFxuICAgIGNoaWxkcmVuOiBbXSxcbiAgfVxuXG4gIHJldHVybiB0b3BPYmplY3Rcbn1cbmZ1bmN0aW9uIHRyYW5zbGF0ZU5hbWUobmFtZSkge1xuICBpZiAoIWlzTmFOKG5hbWUpKSByZXR1cm4gbmFtZVxuICBjb25zdCBuYW1lV2l0aG91dFNwYWNlID0gbmFtZS5yZXBsYWNlKC9cXHMvZywgJ18nKVxuICBjb25zdCBuYW1lV2l0aG91dFNwZWNpYWxDaGFyID0gbmFtZVdpdGhvdXRTcGFjZS5yZXBsYWNlKC9bXlxcd1xcc10vZ2ksICcnKVxuICBjb25zdCBuYW1lSW5Mb3dlckNhc2UgPSBuYW1lV2l0aG91dFNwZWNpYWxDaGFyLnRvTG93ZXJDYXNlKClcbiAgcmV0dXJuIGB7eyAnbG9jYWxlSW1wb3J0ZWQuJHtuYW1lSW5Mb3dlckNhc2V9JyB8IHQgfX1gXG59XG5cbi8vQ3JlYXRlIEpTT05cbmZ1bmN0aW9uIGNyZWF0ZUpTT05Ub0NvcGllZChvcHRpb25zQXJyYXkpIHtcbiAgY29uc3QganNvbiA9IG9wdGlvbnNBcnJheVRvSlNPTihvcHRpb25zQXJyYXkpXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqc29uLXRvLXNhdmUnKS50ZXh0Q29udGVudCA9IGpzb25cbiAgcmV0dXJuIG9wdGlvbnNBcnJheVxufVxuZnVuY3Rpb24gb3B0aW9uc0FycmF5VG9KU09OKGFycikge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoYXJyKVxufVxuXG4vL0NyZWF0ZSBTY3JpcHRcbmZ1bmN0aW9uIGNyZWF0ZVNjcmlwdFRvQ29waWVkKG9wdGlvbnNBcnJheSkge1xuICBjb25zdCBzdHJpbmdTY3JpcHQgPSBvcHRpb25zQXJyYXlUb1N0cmluZ1NjcmlwdChvcHRpb25zQXJyYXkpXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdHJpbmctc2NyaXB0JykudGV4dENvbnRlbnQgPSBzdHJpbmdTY3JpcHRcbn1cbmZ1bmN0aW9uIG9wdGlvbnNBcnJheVRvU3RyaW5nU2NyaXB0KGFycikge1xuICByZXR1cm4gYFxuICA8c2NyaXB0IGlkPVwidmFyaWFudHMtYXZhaWxhYmxlXCI+XG4gICAgd2luZG93LnZhcmlhbnRzID0gJHtKU09OLnN0cmluZ2lmeShhcnIpfTtcbiAgICB3aW5kb3cubW9uZXlTeW1ib2wgPSBcInt7IGxvY2FsaXphdGlvbi5jb3VudHJ5LmN1cnJlbmN5LnN5bWJvbCB9fVwiO1xuICA8L3NjcmlwdD5cbiAgYFxufVxuXG4vLyBDcmVhdGUgTG9jYWxlXG5mdW5jdGlvbiBjcmVhdGVMb2NhbGUob3B0aW9uc0FycmF5KSB7XG4gIGNvbnN0IHVuaXF1ZVZhbHVlcyA9IGV4dHJhY3RVbmlxdWVWYWx1ZXMob3B0aW9uc0FycmF5KVxuICBjb25zdCBsb2NhbGUgPSB7fVxuICB1bmlxdWVWYWx1ZXMuZm9yRWFjaCgodmFsdWUpID0+IHtcbiAgICBjb25zdCB2YWx1ZVdpdGhvdXRTcGFjZSA9IHZhbHVlLnJlcGxhY2UoL1xccy9nLCAnXycpXG4gICAgY29uc3QgdmFsdWVXaXRob3V0U3BlY2lhbENoYXIgPSB2YWx1ZVdpdGhvdXRTcGFjZS5yZXBsYWNlKC9bXlxcd1xcc10vZ2ksICcnKVxuICAgIGNvbnN0IHZhbHVlSW5Mb3dlckNhc2UgPSB2YWx1ZVdpdGhvdXRTcGVjaWFsQ2hhci50b0xvd2VyQ2FzZSgpXG4gICAgbG9jYWxlW3ZhbHVlSW5Mb3dlckNhc2VdID0gdmFsdWVcbiAgfSlcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0cmluZy1sb2NhbGUnKS50ZXh0Q29udGVudCA9IGBcImxvY2FsZUltcG9ydGVkXCI6JHtKU09OLnN0cmluZ2lmeShcbiAgICBsb2NhbGVcbiAgKX1gXG59XG5mdW5jdGlvbiBleHRyYWN0VW5pcXVlVmFsdWVzKG9wdGlvbnNBcnJheSkge1xuICBjb25zdCB1bmlxdWVWYWx1ZXMgPSBuZXcgU2V0KClcbiAgb3B0aW9uc0FycmF5LmZvckVhY2goKG9wdGlvbikgPT4ge1xuICAgIE9iamVjdC5rZXlzKG9wdGlvbikuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICBpZiAoXG4gICAgICAgIGtleSAhPT0gJ2NoaWxkcmVuJyAmJlxuICAgICAgICBrZXkgIT09ICd0ZWNobmljYWxOYW1lJyAmJlxuICAgICAgICBrZXkgIT09ICd0ZWNobmljYWxUeXBlJyAmJlxuICAgICAgICBpc05hTihvcHRpb25ba2V5XSlcbiAgICAgIClcbiAgICAgICAgdW5pcXVlVmFsdWVzLmFkZChvcHRpb25ba2V5XSlcbiAgICAgIGVsc2UgaWYgKGtleSA9PT0gJ2NoaWxkcmVuJykge1xuICAgICAgICBvcHRpb25ba2V5XS5mb3JFYWNoKChjaGlsZCkgPT4ge1xuICAgICAgICAgIE9iamVjdC5rZXlzKGNoaWxkKS5mb3JFYWNoKChjaGlsZEtleSkgPT4ge1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICBjaGlsZEtleSAhPT0gJ2NoaWxkcmVuJyAmJlxuICAgICAgICAgICAgICBjaGlsZEtleSAhPT0gJ3RlY2huaWNhbE5hbWUnICYmXG4gICAgICAgICAgICAgIGNoaWxkS2V5ICE9PSAndGVjaG5pY2FsVHlwZScgJiZcbiAgICAgICAgICAgICAgaXNOYU4oY2hpbGRbY2hpbGRLZXldKVxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgICB1bmlxdWVWYWx1ZXMuYWRkKGNoaWxkW2NoaWxkS2V5XSlcbiAgICAgICAgICAgIGVsc2UgaWYgKGNoaWxkS2V5ID09PSAnY2hpbGRyZW4nKSB7XG4gICAgICAgICAgICAgIGNoaWxkW2NoaWxkS2V5XS5mb3JFYWNoKChncmFuZENoaWxkQXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICBncmFuZENoaWxkQXJyYXkuZm9yRWFjaCgoZ3JhbmRDaGlsZE9iamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgT2JqZWN0LmtleXMoZ3JhbmRDaGlsZE9iamVjdCkuZm9yRWFjaCgoZ3JhbmRDaGlsZEtleSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgICAgZ3JhbmRDaGlsZEtleSAhPT0gJ2NoaWxkcmVuJyAmJlxuICAgICAgICAgICAgICAgICAgICAgIGdyYW5kQ2hpbGRLZXkgIT09ICd0ZWNobmljYWxOYW1lJyAmJlxuICAgICAgICAgICAgICAgICAgICAgIGdyYW5kQ2hpbGRLZXkgIT09ICd0ZWNobmljYWxUeXBlJyAmJlxuICAgICAgICAgICAgICAgICAgICAgIGlzTmFOKGdyYW5kQ2hpbGRPYmplY3RbZ3JhbmRDaGlsZEtleV0pXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICB1bmlxdWVWYWx1ZXMuYWRkKGdyYW5kQ2hpbGRPYmplY3RbZ3JhbmRDaGlsZEtleV0pXG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9KVxuICB9KVxuICByZXR1cm4gdW5pcXVlVmFsdWVzXG59XG5cbi8vQ3JlYXRlIFN0cnVjdHVyZWQgRGF0YVxuZnVuY3Rpb24gY3JlYXRlU3RydWN0dXJlZERhdGFUb0NvcGllZChvcHRpb25zQXJyYXkpIHtcbiAgY29uc3Qgc3RydWN0dXJlZERhdGFBcnIgPSBvcHRpb25zQXJyYXlUb1N0cnVjdHVyZWREYXRhKG9wdGlvbnNBcnJheSlcbiAgY29uc3Qgc3RyaW5nU2NyaXB0ID0gc3RydWN0dXJlZERhdGFUb1N0cmluZyhzdHJ1Y3R1cmVkRGF0YUFycilcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0cmluZy1zdHJ1Y3R1cmVkLWRhdGEnKS50ZXh0Q29udGVudCA9IHN0cmluZ1NjcmlwdFxufVxuZnVuY3Rpb24gb3B0aW9uc0FycmF5VG9TdHJ1Y3R1cmVkRGF0YShhcnIpIHtcbiAgY29uc3Qgc3RydWN0dXJlZERhdGFBcnIgPSBbXVxuICBhcnIuZm9yRWFjaCgoc2l6ZSkgPT4ge1xuICAgIHNpemUuY2hpbGRyZW4uZm9yRWFjaCgobWFyZXJpYWwpID0+IHtcbiAgICAgIGNvbnN0IHN0cnVjdHVyZWREYXRhID0gYFxuICAgICAgICB7XG4gICAgICAgICAgXCJAdHlwZVwiOiBcIk9mZmVyXCIsXG4gICAgICAgICAgXCJwcmljZVwiOiAke3NpemUucHJpY2UgKyBtYXJlcmlhbC5wcmljZX0sXG4gICAgICAgICAgXCJwcmljZUN1cnJlbmN5XCI6IHt7IGNhcnQuY3VycmVuY3kuaXNvX2NvZGUgfCBqc29uIH19LFxuICAgICAgICAgIFwiYXZhaWxhYmlsaXR5XCI6IFwiaHR0cDovL3NjaGVtYS5vcmcvSW5TdG9ja1wiLFxuICAgICAgICAgIFwidXJsXCIgOiB7eyByZXF1ZXN0Lm9yaWdpbiB8IGFwcGVuZDogcHJvZHVjdC51cmwgfCBqc29uIH19LFxuICAgICAgICAgIFwic2VsbGVyXCI6IHtcbiAgICAgICAgICAgICAgXCJAdHlwZVwiOiBcIk9yZ2FuaXphdGlvblwiLFxuICAgICAgICAgICAgICBcIm5hbWVcIjoge3sgcHJvZHVjdC52ZW5kb3IgfCBqc29uIH19XG4gICAgICAgICAgfSxcbiAgICAgICAgICBcImhhc01lcmNoYW50UmV0dXJuUG9saWN5XCI6IHtcbiAgICAgICAgICAgICAgXCJAdHlwZVwiOiBcIk1lcmNoYW50UmV0dXJuUG9saWN5XCIsXG4gICAgICAgICAgICAgIFwicmV0dXJuUG9saWN5Q2F0ZWdvcnlcIjogXCIvcGFnZXMvY29uZGl0aW9ucy1nZW5lcmFsZXMtZGUtdmVudGUtMVwiLFxuICAgICAgICAgICAgICBcIm1lcmNoYW50UmV0dXJuRGF5c1wiOiBcIjE0XCIsXG4gICAgICAgICAgICAgIFwicmV0dXJuTWV0aG9kXCI6IFwiaHR0cDovL3NjaGVtYS5vcmcvUmV0dXJuQnlNYWlsXCJcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYFxuICAgICAgc3RydWN0dXJlZERhdGFBcnIucHVzaChzdHJ1Y3R1cmVkRGF0YSlcbiAgICB9KVxuICB9KVxuICByZXR1cm4gc3RydWN0dXJlZERhdGFBcnJcbn1cbmZ1bmN0aW9uIHN0cnVjdHVyZWREYXRhVG9TdHJpbmcoYXJyKSB7XG4gIHJldHVybiBgXG4gIDxzY3JpcHQgdHlwZT1cImFwcGxpY2F0aW9uL2xkK2pzb25cIj5cbiAgICB7XG4gICAgICBcIkBjb250ZXh0XCI6IFwiaHR0cDovL3NjaGVtYS5vcmcvXCIsXG4gICAgICBcIkB0eXBlXCI6IFwiUHJvZHVjdFwiLFxuICAgICAgXCJAaWRcIjoge3sgcmVxdWVzdC5vcmlnaW4gfCBhcHBlbmQ6IHByb2R1Y3QudXJsIHwganNvbiB9fSxcbiAgICAgIFwibmFtZVwiOiB7eyBwcm9kdWN0LnRpdGxlIHwganNvbiB9fSxcbiAgICAgIFwibG9nb1wiOiBcImh0dHBzOi8vY2RuLnNob3BpZnkuY29tL3MvZmlsZXMvMS8wNjIzLzIzODgvNDI4Ny9maWxlcy9sb2dvLW15c2VsZm1vbmFydC5zdmc/dj0xNzI3MDE5Njc4XCIsXG4gICAgICBcInVybFwiOiB7eyByZXF1ZXN0Lm9yaWdpbiB8IGFwcGVuZDogcHJvZHVjdC51cmwgfCBqc29uIH19LFxuICAgICAgeyUgaWYgcHJvZHVjdC5tZXRhZmllbGRzLmxpbmsubW90aGVyX2NvbGxlY3Rpb24udmFsdWUudGl0bGUgIT0gYmxhbmsgJX1cbiAgICAgICAgXCJjYXRlZ29yeVwiOiB7eyBwcm9kdWN0Lm1ldGFmaWVsZHMubGluay5tb3RoZXJfY29sbGVjdGlvbi52YWx1ZS50aXRsZSB8IGpzb24gfX0sXG4gICAgICB7JSBlbmRpZiAlfVxuICAgICAgeyUgaWYgc2VvX21lZGlhICV9XG4gICAgICAgIFwiaW1hZ2VcIjogW3t7IHNlb19tZWRpYSB8IGltYWdlX3VybDogd2lkdGg6IHNlb19tZWRpYS5wcmV2aWV3X2ltYWdlLndpZHRoIHwgcHJlcGVuZDogXCJodHRwczpcIiB8IGpzb24gfX1dLFxuICAgICAgeyUgZW5kaWYgJX1cbiAgICAgIFwiZGVzY3JpcHRpb25cIjoge3sgcHJvZHVjdC5kZXNjcmlwdGlvbiB8IHN0cmlwX2h0bWwgfCBqc29uIH19LFxuICAgICAgXCJicmFuZFwiOiB7XG4gICAgICAgIFwiQHR5cGVcIjogXCJCcmFuZFwiLFxuICAgICAgICBcIm5hbWVcIjoge3sgcHJvZHVjdC52ZW5kb3IgfCBqc29uIH19XG4gICAgICB9LFxuICAgICAgeyUtIGlmIHJldmlld3Nfc3RydWN0dXJlZF9kYXRhICE9IGJsYW5rIC0lfVxuICAgICAgICB7eyByZXZpZXdzX3N0cnVjdHVyZWRfZGF0YSB9fSxcbiAgICAgIHslLSBlbmRpZiAtJX1cbiAgICAgIFwib2ZmZXJzXCI6IFske2Fycn1dXG4gICAgfVxuICA8L3NjcmlwdD5cbiAgYFxufVxuXG4vLyBFeHBvcnRzXG53aW5kb3cuYWRqdXN0V2lkdGggPSBhZGp1c3RXaWR0aFxud2luZG93LmFkZFNpYmxpbmdPcHRpb25BY3Rpb24gPSBhZGRTaWJsaW5nT3B0aW9uQWN0aW9uXG53aW5kb3cuYWRkQ2hpbGRPcHRpb25BY3Rpb24gPSBhZGRDaGlsZE9wdGlvbkFjdGlvblxud2luZG93LnJlY3Vyc2l2ZVJlbW92ZU9wdGlvbiA9IHJlY3Vyc2l2ZVJlbW92ZU9wdGlvblxud2luZG93LmFkZFNpYmxpbmdPcHRpb25BY3Rpb24yID0gYWRkU2libGluZ09wdGlvbkFjdGlvbjJcbndpbmRvdy5hZGRDb250YWluZXJMZXZlbDNBY3Rpb24gPSBhZGRDb250YWluZXJMZXZlbDNBY3Rpb25cbndpbmRvdy5jb3B5U2NyaXB0ID0gY29weVNjcmlwdFxud2luZG93LnNhdmVUb0RhdGFiYXNlID0gc2F2ZVRvRGF0YWJhc2VcbndpbmRvdy5jb3B5TG9jYWxlID0gY29weUxvY2FsZVxud2luZG93LnNob3dJbmZvUG9wdXAgPSBzaG93SW5mb1BvcHVwXG53aW5kb3cuc2VsZWN0QXNwZWN0UmF0aW8gPSBzZWxlY3RBc3BlY3RSYXRpb1xud2luZG93LmNvcHlTdHJ1Y3R1cmVkRGF0YSA9IGNvcHlTdHJ1Y3R1cmVkRGF0YVxuXG4vL3RhaWx3aW5kY3NzLCBkb24ndCByZW1vdmVcbi8vYmctbWFpblxuLy9iZy1jeWFuLTcwMFxuLy9tbC0xMFxuLy9tbC0yMFxuIl0sIm5hbWVzIjpbIl9yZWdlbmVyYXRvclJ1bnRpbWUiLCJlIiwidCIsInIiLCJPYmplY3QiLCJwcm90b3R5cGUiLCJuIiwiaGFzT3duUHJvcGVydHkiLCJvIiwiZGVmaW5lUHJvcGVydHkiLCJ2YWx1ZSIsImkiLCJTeW1ib2wiLCJhIiwiaXRlcmF0b3IiLCJjIiwiYXN5bmNJdGVyYXRvciIsInUiLCJ0b1N0cmluZ1RhZyIsImRlZmluZSIsImVudW1lcmFibGUiLCJjb25maWd1cmFibGUiLCJ3cml0YWJsZSIsIndyYXAiLCJHZW5lcmF0b3IiLCJjcmVhdGUiLCJDb250ZXh0IiwibWFrZUludm9rZU1ldGhvZCIsInRyeUNhdGNoIiwidHlwZSIsImFyZyIsImNhbGwiLCJoIiwibCIsImYiLCJzIiwieSIsIkdlbmVyYXRvckZ1bmN0aW9uIiwiR2VuZXJhdG9yRnVuY3Rpb25Qcm90b3R5cGUiLCJwIiwiZCIsImdldFByb3RvdHlwZU9mIiwidiIsInZhbHVlcyIsImciLCJkZWZpbmVJdGVyYXRvck1ldGhvZHMiLCJmb3JFYWNoIiwiX2ludm9rZSIsIkFzeW5jSXRlcmF0b3IiLCJpbnZva2UiLCJfdHlwZW9mIiwicmVzb2x2ZSIsIl9fYXdhaXQiLCJ0aGVuIiwiY2FsbEludm9rZVdpdGhNZXRob2RBbmRBcmciLCJFcnJvciIsImRvbmUiLCJtZXRob2QiLCJkZWxlZ2F0ZSIsIm1heWJlSW52b2tlRGVsZWdhdGUiLCJzZW50IiwiX3NlbnQiLCJkaXNwYXRjaEV4Y2VwdGlvbiIsImFicnVwdCIsIlR5cGVFcnJvciIsInJlc3VsdE5hbWUiLCJuZXh0IiwibmV4dExvYyIsInB1c2hUcnlFbnRyeSIsInRyeUxvYyIsImNhdGNoTG9jIiwiZmluYWxseUxvYyIsImFmdGVyTG9jIiwidHJ5RW50cmllcyIsInB1c2giLCJyZXNldFRyeUVudHJ5IiwiY29tcGxldGlvbiIsInJlc2V0IiwiaXNOYU4iLCJsZW5ndGgiLCJkaXNwbGF5TmFtZSIsImlzR2VuZXJhdG9yRnVuY3Rpb24iLCJjb25zdHJ1Y3RvciIsIm5hbWUiLCJtYXJrIiwic2V0UHJvdG90eXBlT2YiLCJfX3Byb3RvX18iLCJhd3JhcCIsImFzeW5jIiwiUHJvbWlzZSIsImtleXMiLCJyZXZlcnNlIiwicG9wIiwicHJldiIsImNoYXJBdCIsInNsaWNlIiwic3RvcCIsInJ2YWwiLCJoYW5kbGUiLCJjb21wbGV0ZSIsImZpbmlzaCIsIl9jYXRjaCIsImRlbGVnYXRlWWllbGQiLCJvd25LZXlzIiwiZ2V0T3duUHJvcGVydHlTeW1ib2xzIiwiZmlsdGVyIiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIiwiYXBwbHkiLCJfb2JqZWN0U3ByZWFkIiwiYXJndW1lbnRzIiwiX2RlZmluZVByb3BlcnR5IiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyIsImRlZmluZVByb3BlcnRpZXMiLCJvYmoiLCJrZXkiLCJfdG9Qcm9wZXJ0eUtleSIsIl90b1ByaW1pdGl2ZSIsInRvUHJpbWl0aXZlIiwiU3RyaW5nIiwiTnVtYmVyIiwiX2NyZWF0ZUZvck9mSXRlcmF0b3JIZWxwZXIiLCJhbGxvd0FycmF5TGlrZSIsIml0IiwiQXJyYXkiLCJpc0FycmF5IiwiX3Vuc3VwcG9ydGVkSXRlcmFibGVUb0FycmF5IiwiRiIsIl9lIiwibm9ybWFsQ29tcGxldGlvbiIsImRpZEVyciIsImVyciIsInN0ZXAiLCJfZTIiLCJfc2xpY2VkVG9BcnJheSIsImFyciIsIl9hcnJheVdpdGhIb2xlcyIsIl9pdGVyYWJsZVRvQXJyYXlMaW1pdCIsIl9ub25JdGVyYWJsZVJlc3QiLCJtaW5MZW4iLCJfYXJyYXlMaWtlVG9BcnJheSIsInRvU3RyaW5nIiwiZnJvbSIsInRlc3QiLCJsZW4iLCJhcnIyIiwiYXN5bmNHZW5lcmF0b3JTdGVwIiwiZ2VuIiwicmVqZWN0IiwiX25leHQiLCJfdGhyb3ciLCJpbmZvIiwiZXJyb3IiLCJfYXN5bmNUb0dlbmVyYXRvciIsImZuIiwic2VsZiIsImFyZ3MiLCJ1bmRlZmluZWQiLCJnZXRBbGxPcHRpb25zIiwiX3giLCJfZ2V0QWxsT3B0aW9ucyIsIl9jYWxsZWUiLCJhc3BlY3RSYXRpbyIsInVybCIsInJlc3BvbnNlIiwiZGF0YSIsInZhcmlhbnRzIiwiX2NhbGxlZSQiLCJfY29udGV4dCIsImNvbmNhdCIsImZldGNoIiwiaGVhZGVycyIsIm9rIiwianNvbiIsImNyZWF0ZURvbUZyb21WYXJpYW50cyIsImxpc3RlblBvcHVwSW5wdXRzIiwidDAiLCJjb25zb2xlIiwibG9nIiwiZmlyc3RMZXZlbCIsIm9wdGlvbkVsZW0iLCJhZGRPcHRpb24iLCJzZXRPcHRpb25WYWx1ZSIsImNoaWxkcmVuIiwic2Vjb25kTGV2ZWwiLCJ0aGlyZExldmVscyIsInRoaXJkTGV2ZWwiLCJhZGRTaWJsaW5nT3B0aW9uIiwiY3JlYXRlT3B0aW9uQ29udGFpbmVyIiwibGV2ZWwiLCJ0ZW1wbGF0ZSIsImRvY3VtZW50IiwiZ2V0RWxlbWVudEJ5SWQiLCJjb250ZW50IiwiY2xvbmUiLCJjbG9uZU5vZGUiLCJjb250YWluZXJPcHRpb25FbGVtZW50IiwicXVlcnlTZWxlY3RvciIsImRhdGFzZXQiLCJtYXJnaW5MZWZ0IiwiY2xhc3NMaXN0IiwiYWRkIiwiYnV0dG9uVGVtcGxhdGUiLCJidXR0b25Db250ZW50IiwiYnV0dG9uQ2xvbmUiLCJidXR0b25BZGRTaWJsaW5nQ29udGFpbmVyIiwiYXBwZW5kQ2hpbGQiLCJnZXRDb2xvciIsImNyZWF0ZU9wdGlvbiIsInBhcmVudENvbnRhaW5lciIsIm9wdGlvbkVsZW1lbnQiLCJuYW1lUHJpY2VFbGVtIiwiYnV0dG9uQWRkSW5mb0VsZW0iLCJiYWNrZ3JvdW5kIiwiY3JlYXRlQ2hpbGRPclNpYmxpbmdCdXR0b25zIiwiYnV0dG9uc1dyYXBwZXIiLCJidXR0b25zIiwicXVlcnlTZWxlY3RvckFsbCIsImNvbG9yIiwiYnV0dG9uIiwiY3JlYXRlU2libGluZ0J1dHRvbiIsIm5leHRDb250YWluZXIiLCJjb250YWluZXIiLCJfY3JlYXRlT3B0aW9uIiwiX2NyZWF0ZU9wdGlvbjIiLCJvcHRpb24iLCJuYW1lUHJpY2UiLCJiZWZvcmUiLCJhZGRPcHRpb25BZnRlciIsInRhcmdldENvbnRhaW5lciIsImNvbnRhaW5lcnMiLCJjbG9zZXN0IiwiY2hpbGQiLCJjb250YWlucyIsImNvbnRhaW5lcnNBZnRlciIsImluZGV4T2YiLCJjb250YWluZXJzQWZ0ZXJTYW1lTGV2ZWwiLCJjb250YWluZXJzQWZ0ZXJQcmV2aW91c0xldmVsIiwiYWRkT3B0aW9uQmVmb3JlIiwibmV3bGV2ZWwiLCJuZXh0RWxlbWVudFNpYmxpbmciLCJ0YXJnZXRPcHRpb24iLCJfY3JlYXRlT3B0aW9uMyIsIl9jcmVhdGVPcHRpb240IiwiYWZ0ZXIiLCJyZWN1cnNpdmVSZW1vdmVPcHRpb24iLCJ0YXJnZXQiLCJiYXNlTGV2ZWwiLCJfdGFyZ2V0JGNsb3Nlc3QiLCJuZXh0TmV4dENvbnRhaW5lciIsInJlbW92ZSIsIm5leHROZXh0VGFnZXRPcHRpb24iLCJvdGhlck9wdGlvbnMiLCJyZW1vdmVBbGxDb250YWluZXIiLCJnZXRBbGxDb250YWluZXJzIiwiYWRqdXN0V2lkdGgiLCJpbnB1dCIsIm1pcnJvclNwYW4iLCJub2RlTmFtZSIsInRleHRDb250ZW50IiwicHJvcGVydHkiLCJhZGRTaWJsaW5nT3B0aW9uQWN0aW9uIiwiYWRkQ2hpbGRPcHRpb25BY3Rpb24iLCJhZGRTaWJsaW5nT3B0aW9uQWN0aW9uMiIsImFkZENvbnRhaW5lckxldmVsM0FjdGlvbiIsImNvcHlTY3JpcHQiLCJfY29weVNjcmlwdCIsIl9jYWxsZWUyIiwiX2NhbGxlZTIkIiwiX2NvbnRleHQyIiwibmF2aWdhdG9yIiwiY2xpcGJvYXJkIiwid3JpdGVUZXh0IiwiY29weUxvY2FsZSIsIl9jb3B5TG9jYWxlIiwiX2NhbGxlZTMiLCJfY2FsbGVlMyQiLCJfY29udGV4dDMiLCJjb3B5U3RydWN0dXJlZERhdGEiLCJfY29weVN0cnVjdHVyZWREYXRhIiwiX2NhbGxlZTQiLCJfY2FsbGVlNCQiLCJfY29udGV4dDQiLCJzYXZlVG9EYXRhYmFzZSIsIl94MiIsIl9zYXZlVG9EYXRhYmFzZSIsIl9jYWxsZWU1IiwiX2RvY3VtZW50JHF1ZXJ5U2VsZWN0IiwiX2NhbGxlZTUkIiwiX2NvbnRleHQ1IiwiZGlzYWJsZWQiLCJib2R5IiwiSlNPTiIsInN0cmluZ2lmeSIsIm1lc3NhZ2UiLCJzaG93SW5mb1BvcHVwIiwicG9wdXAiLCJzZWxlY3RBc3BlY3RSYXRpbyIsImxhc3RCdXR0b25TZWxlY3RlZCIsInNldEF0dHJpYnV0ZSIsInJlcGxhY2UiLCJ0cmlnZ2VyQWZ0ZXJDaGFuZ2VtZW50IiwidGFyZ2V0Tm9kZSIsImNvbmZpZyIsImNoaWxkTGlzdCIsInN1YnRyZWUiLCJjYWxsYmFjayIsIm11dGF0aW9uc0xpc3QiLCJvYnNlcnZlciIsIl9pdGVyYXRvciIsIl9zdGVwIiwibXV0YXRpb24iLCJfY3JlYXRlQXJyYXlGcm9tT3B0aW8iLCJjcmVhdGVBcnJheUZyb21PcHRpb25zIiwiX2NyZWF0ZUFycmF5RnJvbU9wdGlvMiIsIm9wdGlvbnNBcnJheSIsIm9wdGlvbnNBcnJheVRyYW5zbGF0ZWQiLCJjcmVhdGVKU09OVG9Db3BpZWQiLCJjcmVhdGVTY3JpcHRUb0NvcGllZCIsImNyZWF0ZUxvY2FsZSIsImNyZWF0ZVN0cnVjdHVyZWREYXRhVG9Db3BpZWQiLCJNdXRhdGlvbk9ic2VydmVyIiwib2JzZXJ2ZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJfY3JlYXRlQXJyYXlGcm9tT3B0aW8zIiwiX2NyZWF0ZUFycmF5RnJvbU9wdGlvNCIsIm9wdGlvbnMiLCJvcHRpb25zVHJhbnNsYXRlZCIsIl9nZXRPcHRpb25WYWx1ZXMiLCJnZXRPcHRpb25WYWx1ZXMiLCJfZ2V0T3B0aW9uVmFsdWVzMiIsIm9wdGlvblZhbHVlcyIsIm9wdGlvblZhbHVlc1RyYW5zbGF0ZWQiLCJ0b3BPYmplY3QiLCJjcmVhdGVQYXJlbnRPYmplY3QiLCJ0b3BPYmplY3RUcmFuc2xhdGVkIiwiX2dldE9wdGlvblZhbHVlczMiLCJfZ2V0T3B0aW9uVmFsdWVzNCIsImNoaWxkT2JqZWN0IiwiY2hpbGRPYmplY3R0cmFuc2xhdGVkIiwiX2dldEFsbE9wdGlvblZhbHVlcyIsImdldEFsbE9wdGlvblZhbHVlcyIsIl9nZXRBbGxPcHRpb25WYWx1ZXMyIiwib3B0aW9uVmFsdWVzTGlzdCIsIm9wdGlvblZhbHVlc0xpc3RUcmFuc2xhdGVkIiwid3JhcHBlciIsImlucHV0cyIsInZhbHVlc1RyYW5zbGF0ZWQiLCJ0cmFuc2xhdGVkVmFsdWUiLCJ0cmFuc2xhdGVOYW1lIiwibWFwIiwibmFtZVdpdGhvdXRTcGFjZSIsIm5hbWVXaXRob3V0U3BlY2lhbENoYXIiLCJuYW1lSW5Mb3dlckNhc2UiLCJ0b0xvd2VyQ2FzZSIsIm9wdGlvbnNBcnJheVRvSlNPTiIsInN0cmluZ1NjcmlwdCIsIm9wdGlvbnNBcnJheVRvU3RyaW5nU2NyaXB0IiwidW5pcXVlVmFsdWVzIiwiZXh0cmFjdFVuaXF1ZVZhbHVlcyIsImxvY2FsZSIsInZhbHVlV2l0aG91dFNwYWNlIiwidmFsdWVXaXRob3V0U3BlY2lhbENoYXIiLCJ2YWx1ZUluTG93ZXJDYXNlIiwiU2V0IiwiY2hpbGRLZXkiLCJncmFuZENoaWxkQXJyYXkiLCJncmFuZENoaWxkT2JqZWN0IiwiZ3JhbmRDaGlsZEtleSIsInN0cnVjdHVyZWREYXRhQXJyIiwib3B0aW9uc0FycmF5VG9TdHJ1Y3R1cmVkRGF0YSIsInN0cnVjdHVyZWREYXRhVG9TdHJpbmciLCJzaXplIiwibWFyZXJpYWwiLCJzdHJ1Y3R1cmVkRGF0YSIsInByaWNlIiwid2luZG93Il0sInNvdXJjZVJvb3QiOiIifQ==
