/******/ ;(() => {
  // webpackBootstrap
  /*!******************************************!*\
  !*** ./resources/js/tapestry-options.js ***!
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
  function getTapestryPrice() {
    return _getTapestryPrice.apply(this, arguments)
  }
  function _getTapestryPrice() {
    _getTapestryPrice = _asyncToGenerator(
      /*#__PURE__*/ _regeneratorRuntime().mark(function _callee2() {
        var url, response, tapestry, price
        return _regeneratorRuntime().wrap(
          function _callee2$(_context2) {
            while (1)
              switch ((_context2.prev = _context2.next)) {
                case 0:
                  _context2.prev = 0
                  url = '/api/tapestry/price'
                  _context2.next = 4
                  return fetch(url, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  })
                case 4:
                  response = _context2.sent
                  if (response.ok) {
                    _context2.next = 7
                    break
                  }
                  throw new Error()
                case 7:
                  _context2.next = 9
                  return response.json()
                case 9:
                  tapestry = _context2.sent
                  price = tapestry.price
                  return _context2.abrupt('return', price)
                case 14:
                  _context2.prev = 14
                  _context2.t0 = _context2['catch'](0)
                  console.log('error', _context2.t0)
                case 17:
                case 'end':
                  return _context2.stop()
              }
          },
          _callee2,
          null,
          [[0, 14]]
        )
      })
    )
    return _getTapestryPrice.apply(this, arguments)
  }
  function displayTapestryPrice(price) {
    var priceElement = document.getElementById('price-m2')
    priceElement.value = price
  }
  function listenTapestryPriceChange() {
    var priceElement = document.getElementById('price-m2')
    priceElement.addEventListener(
      'change',
      /*#__PURE__*/ _asyncToGenerator(
        /*#__PURE__*/ _regeneratorRuntime().mark(function _callee() {
          var price
          return _regeneratorRuntime().wrap(function _callee$(_context) {
            while (1)
              switch ((_context.prev = _context.next)) {
                case 0:
                  price = priceElement.value
                  _context.next = 3
                  return updateTapestryPrice(price)
                case 3:
                  _context.next = 5
                  return getTapestryPrice()
                case 5:
                  price = _context.sent
                  displayTapestryPrice(price)
                case 7:
                case 'end':
                  return _context.stop()
              }
          }, _callee)
        })
      )
    )
  }
  function updateTapestryPrice(_x) {
    return _updateTapestryPrice.apply(this, arguments)
  }
  function _updateTapestryPrice() {
    _updateTapestryPrice = _asyncToGenerator(
      /*#__PURE__*/ _regeneratorRuntime().mark(function _callee3(price) {
        var url, response
        return _regeneratorRuntime().wrap(
          function _callee3$(_context3) {
            while (1)
              switch ((_context3.prev = _context3.next)) {
                case 0:
                  _context3.prev = 0
                  url = '/api/tapestry/price'
                  _context3.next = 4
                  return fetch(url, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      price: price,
                    }),
                  })
                case 4:
                  response = _context3.sent
                  if (response.ok) {
                    _context3.next = 7
                    break
                  }
                  throw new Error()
                case 7:
                  _context3.next = 12
                  break
                case 9:
                  _context3.prev = 9
                  _context3.t0 = _context3['catch'](0)
                  console.log('error', _context3.t0)
                case 12:
                case 'end':
                  return _context3.stop()
              }
          },
          _callee3,
          null,
          [[0, 9]]
        )
      })
    )
    return _updateTapestryPrice.apply(this, arguments)
  }
  function start() {
    return _start.apply(this, arguments)
  }
  function _start() {
    _start = _asyncToGenerator(
      /*#__PURE__*/ _regeneratorRuntime().mark(function _callee4() {
        var price
        return _regeneratorRuntime().wrap(function _callee4$(_context4) {
          while (1)
            switch ((_context4.prev = _context4.next)) {
              case 0:
                _context4.next = 2
                return getTapestryPrice()
              case 2:
                price = _context4.sent
                displayTapestryPrice(price)
                listenTapestryPriceChange()
              case 5:
              case 'end':
                return _context4.stop()
            }
        }, _callee4)
      })
    )
    return _start.apply(this, arguments)
  }
  start()
  /******/
})()
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFwZXN0cnktb3B0aW9ucy5qcyIsIm1hcHBpbmdzIjoiOzs7OzsrQ0FDQSxxSkFBQUEsbUJBQUEsWUFBQUEsb0JBQUEsV0FBQUMsQ0FBQSxTQUFBQyxDQUFBLEVBQUFELENBQUEsT0FBQUUsQ0FBQSxHQUFBQyxNQUFBLENBQUFDLFNBQUEsRUFBQUMsQ0FBQSxHQUFBSCxDQUFBLENBQUFJLGNBQUEsRUFBQUMsQ0FBQSxHQUFBSixNQUFBLENBQUFLLGNBQUEsY0FBQVAsQ0FBQSxFQUFBRCxDQUFBLEVBQUFFLENBQUEsSUFBQUQsQ0FBQSxDQUFBRCxDQUFBLElBQUFFLENBQUEsQ0FBQU8sS0FBQSxLQUFBQyxDQUFBLHdCQUFBQyxNQUFBLEdBQUFBLE1BQUEsT0FBQUMsQ0FBQSxHQUFBRixDQUFBLENBQUFHLFFBQUEsa0JBQUFDLENBQUEsR0FBQUosQ0FBQSxDQUFBSyxhQUFBLHVCQUFBQyxDQUFBLEdBQUFOLENBQUEsQ0FBQU8sV0FBQSw4QkFBQUMsT0FBQWpCLENBQUEsRUFBQUQsQ0FBQSxFQUFBRSxDQUFBLFdBQUFDLE1BQUEsQ0FBQUssY0FBQSxDQUFBUCxDQUFBLEVBQUFELENBQUEsSUFBQVMsS0FBQSxFQUFBUCxDQUFBLEVBQUFpQixVQUFBLE1BQUFDLFlBQUEsTUFBQUMsUUFBQSxTQUFBcEIsQ0FBQSxDQUFBRCxDQUFBLFdBQUFrQixNQUFBLG1CQUFBakIsQ0FBQSxJQUFBaUIsTUFBQSxZQUFBQSxPQUFBakIsQ0FBQSxFQUFBRCxDQUFBLEVBQUFFLENBQUEsV0FBQUQsQ0FBQSxDQUFBRCxDQUFBLElBQUFFLENBQUEsZ0JBQUFvQixLQUFBckIsQ0FBQSxFQUFBRCxDQUFBLEVBQUFFLENBQUEsRUFBQUcsQ0FBQSxRQUFBSyxDQUFBLEdBQUFWLENBQUEsSUFBQUEsQ0FBQSxDQUFBSSxTQUFBLFlBQUFtQixTQUFBLEdBQUF2QixDQUFBLEdBQUF1QixTQUFBLEVBQUFYLENBQUEsR0FBQVQsTUFBQSxDQUFBcUIsTUFBQSxDQUFBZCxDQUFBLENBQUFOLFNBQUEsR0FBQVUsQ0FBQSxPQUFBVyxPQUFBLENBQUFwQixDQUFBLGdCQUFBRSxDQUFBLENBQUFLLENBQUEsZUFBQUgsS0FBQSxFQUFBaUIsZ0JBQUEsQ0FBQXpCLENBQUEsRUFBQUMsQ0FBQSxFQUFBWSxDQUFBLE1BQUFGLENBQUEsYUFBQWUsU0FBQTFCLENBQUEsRUFBQUQsQ0FBQSxFQUFBRSxDQUFBLG1CQUFBMEIsSUFBQSxZQUFBQyxHQUFBLEVBQUE1QixDQUFBLENBQUE2QixJQUFBLENBQUE5QixDQUFBLEVBQUFFLENBQUEsY0FBQUQsQ0FBQSxhQUFBMkIsSUFBQSxXQUFBQyxHQUFBLEVBQUE1QixDQUFBLFFBQUFELENBQUEsQ0FBQXNCLElBQUEsR0FBQUEsSUFBQSxNQUFBUyxDQUFBLHFCQUFBQyxDQUFBLHFCQUFBQyxDQUFBLGdCQUFBQyxDQUFBLGdCQUFBQyxDQUFBLGdCQUFBWixVQUFBLGNBQUFhLGtCQUFBLGNBQUFDLDJCQUFBLFNBQUFDLENBQUEsT0FBQXBCLE1BQUEsQ0FBQW9CLENBQUEsRUFBQTFCLENBQUEscUNBQUEyQixDQUFBLEdBQUFwQyxNQUFBLENBQUFxQyxjQUFBLEVBQUFDLENBQUEsR0FBQUYsQ0FBQSxJQUFBQSxDQUFBLENBQUFBLENBQUEsQ0FBQUcsTUFBQSxRQUFBRCxDQUFBLElBQUFBLENBQUEsS0FBQXZDLENBQUEsSUFBQUcsQ0FBQSxDQUFBeUIsSUFBQSxDQUFBVyxDQUFBLEVBQUE3QixDQUFBLE1BQUEwQixDQUFBLEdBQUFHLENBQUEsT0FBQUUsQ0FBQSxHQUFBTiwwQkFBQSxDQUFBakMsU0FBQSxHQUFBbUIsU0FBQSxDQUFBbkIsU0FBQSxHQUFBRCxNQUFBLENBQUFxQixNQUFBLENBQUFjLENBQUEsWUFBQU0sc0JBQUEzQyxDQUFBLGdDQUFBNEMsT0FBQSxXQUFBN0MsQ0FBQSxJQUFBa0IsTUFBQSxDQUFBakIsQ0FBQSxFQUFBRCxDQUFBLFlBQUFDLENBQUEsZ0JBQUE2QyxPQUFBLENBQUE5QyxDQUFBLEVBQUFDLENBQUEsc0JBQUE4QyxjQUFBOUMsQ0FBQSxFQUFBRCxDQUFBLGFBQUFnRCxPQUFBOUMsQ0FBQSxFQUFBSyxDQUFBLEVBQUFHLENBQUEsRUFBQUUsQ0FBQSxRQUFBRSxDQUFBLEdBQUFhLFFBQUEsQ0FBQTFCLENBQUEsQ0FBQUMsQ0FBQSxHQUFBRCxDQUFBLEVBQUFNLENBQUEsbUJBQUFPLENBQUEsQ0FBQWMsSUFBQSxRQUFBWixDQUFBLEdBQUFGLENBQUEsQ0FBQWUsR0FBQSxFQUFBRSxDQUFBLEdBQUFmLENBQUEsQ0FBQVAsS0FBQSxTQUFBc0IsQ0FBQSxnQkFBQWtCLE9BQUEsQ0FBQWxCLENBQUEsS0FBQTFCLENBQUEsQ0FBQXlCLElBQUEsQ0FBQUMsQ0FBQSxlQUFBL0IsQ0FBQSxDQUFBa0QsT0FBQSxDQUFBbkIsQ0FBQSxDQUFBb0IsT0FBQSxFQUFBQyxJQUFBLFdBQUFuRCxDQUFBLElBQUErQyxNQUFBLFNBQUEvQyxDQUFBLEVBQUFTLENBQUEsRUFBQUUsQ0FBQSxnQkFBQVgsQ0FBQSxJQUFBK0MsTUFBQSxVQUFBL0MsQ0FBQSxFQUFBUyxDQUFBLEVBQUFFLENBQUEsUUFBQVosQ0FBQSxDQUFBa0QsT0FBQSxDQUFBbkIsQ0FBQSxFQUFBcUIsSUFBQSxXQUFBbkQsQ0FBQSxJQUFBZSxDQUFBLENBQUFQLEtBQUEsR0FBQVIsQ0FBQSxFQUFBUyxDQUFBLENBQUFNLENBQUEsZ0JBQUFmLENBQUEsV0FBQStDLE1BQUEsVUFBQS9DLENBQUEsRUFBQVMsQ0FBQSxFQUFBRSxDQUFBLFNBQUFBLENBQUEsQ0FBQUUsQ0FBQSxDQUFBZSxHQUFBLFNBQUEzQixDQUFBLEVBQUFLLENBQUEsb0JBQUFFLEtBQUEsV0FBQUEsTUFBQVIsQ0FBQSxFQUFBSSxDQUFBLGFBQUFnRCwyQkFBQSxlQUFBckQsQ0FBQSxXQUFBQSxDQUFBLEVBQUFFLENBQUEsSUFBQThDLE1BQUEsQ0FBQS9DLENBQUEsRUFBQUksQ0FBQSxFQUFBTCxDQUFBLEVBQUFFLENBQUEsZ0JBQUFBLENBQUEsR0FBQUEsQ0FBQSxHQUFBQSxDQUFBLENBQUFrRCxJQUFBLENBQUFDLDBCQUFBLEVBQUFBLDBCQUFBLElBQUFBLDBCQUFBLHFCQUFBM0IsaUJBQUExQixDQUFBLEVBQUFFLENBQUEsRUFBQUcsQ0FBQSxRQUFBRSxDQUFBLEdBQUF3QixDQUFBLG1CQUFBckIsQ0FBQSxFQUFBRSxDQUFBLFFBQUFMLENBQUEsS0FBQTBCLENBQUEsUUFBQXFCLEtBQUEsc0NBQUEvQyxDQUFBLEtBQUEyQixDQUFBLG9CQUFBeEIsQ0FBQSxRQUFBRSxDQUFBLFdBQUFILEtBQUEsRUFBQVIsQ0FBQSxFQUFBc0QsSUFBQSxlQUFBbEQsQ0FBQSxDQUFBbUQsTUFBQSxHQUFBOUMsQ0FBQSxFQUFBTCxDQUFBLENBQUF3QixHQUFBLEdBQUFqQixDQUFBLFVBQUFFLENBQUEsR0FBQVQsQ0FBQSxDQUFBb0QsUUFBQSxNQUFBM0MsQ0FBQSxRQUFBRSxDQUFBLEdBQUEwQyxtQkFBQSxDQUFBNUMsQ0FBQSxFQUFBVCxDQUFBLE9BQUFXLENBQUEsUUFBQUEsQ0FBQSxLQUFBbUIsQ0FBQSxtQkFBQW5CLENBQUEscUJBQUFYLENBQUEsQ0FBQW1ELE1BQUEsRUFBQW5ELENBQUEsQ0FBQXNELElBQUEsR0FBQXRELENBQUEsQ0FBQXVELEtBQUEsR0FBQXZELENBQUEsQ0FBQXdCLEdBQUEsc0JBQUF4QixDQUFBLENBQUFtRCxNQUFBLFFBQUFqRCxDQUFBLEtBQUF3QixDQUFBLFFBQUF4QixDQUFBLEdBQUEyQixDQUFBLEVBQUE3QixDQUFBLENBQUF3QixHQUFBLEVBQUF4QixDQUFBLENBQUF3RCxpQkFBQSxDQUFBeEQsQ0FBQSxDQUFBd0IsR0FBQSx1QkFBQXhCLENBQUEsQ0FBQW1ELE1BQUEsSUFBQW5ELENBQUEsQ0FBQXlELE1BQUEsV0FBQXpELENBQUEsQ0FBQXdCLEdBQUEsR0FBQXRCLENBQUEsR0FBQTBCLENBQUEsTUFBQUssQ0FBQSxHQUFBWCxRQUFBLENBQUEzQixDQUFBLEVBQUFFLENBQUEsRUFBQUcsQ0FBQSxvQkFBQWlDLENBQUEsQ0FBQVYsSUFBQSxRQUFBckIsQ0FBQSxHQUFBRixDQUFBLENBQUFrRCxJQUFBLEdBQUFyQixDQUFBLEdBQUFGLENBQUEsRUFBQU0sQ0FBQSxDQUFBVCxHQUFBLEtBQUFNLENBQUEscUJBQUExQixLQUFBLEVBQUE2QixDQUFBLENBQUFULEdBQUEsRUFBQTBCLElBQUEsRUFBQWxELENBQUEsQ0FBQWtELElBQUEsa0JBQUFqQixDQUFBLENBQUFWLElBQUEsS0FBQXJCLENBQUEsR0FBQTJCLENBQUEsRUFBQTdCLENBQUEsQ0FBQW1ELE1BQUEsWUFBQW5ELENBQUEsQ0FBQXdCLEdBQUEsR0FBQVMsQ0FBQSxDQUFBVCxHQUFBLG1CQUFBNkIsb0JBQUExRCxDQUFBLEVBQUFFLENBQUEsUUFBQUcsQ0FBQSxHQUFBSCxDQUFBLENBQUFzRCxNQUFBLEVBQUFqRCxDQUFBLEdBQUFQLENBQUEsQ0FBQWEsUUFBQSxDQUFBUixDQUFBLE9BQUFFLENBQUEsS0FBQU4sQ0FBQSxTQUFBQyxDQUFBLENBQUF1RCxRQUFBLHFCQUFBcEQsQ0FBQSxJQUFBTCxDQUFBLENBQUFhLFFBQUEsZUFBQVgsQ0FBQSxDQUFBc0QsTUFBQSxhQUFBdEQsQ0FBQSxDQUFBMkIsR0FBQSxHQUFBNUIsQ0FBQSxFQUFBeUQsbUJBQUEsQ0FBQTFELENBQUEsRUFBQUUsQ0FBQSxlQUFBQSxDQUFBLENBQUFzRCxNQUFBLGtCQUFBbkQsQ0FBQSxLQUFBSCxDQUFBLENBQUFzRCxNQUFBLFlBQUF0RCxDQUFBLENBQUEyQixHQUFBLE9BQUFrQyxTQUFBLHVDQUFBMUQsQ0FBQSxpQkFBQThCLENBQUEsTUFBQXpCLENBQUEsR0FBQWlCLFFBQUEsQ0FBQXBCLENBQUEsRUFBQVAsQ0FBQSxDQUFBYSxRQUFBLEVBQUFYLENBQUEsQ0FBQTJCLEdBQUEsbUJBQUFuQixDQUFBLENBQUFrQixJQUFBLFNBQUExQixDQUFBLENBQUFzRCxNQUFBLFlBQUF0RCxDQUFBLENBQUEyQixHQUFBLEdBQUFuQixDQUFBLENBQUFtQixHQUFBLEVBQUEzQixDQUFBLENBQUF1RCxRQUFBLFNBQUF0QixDQUFBLE1BQUF2QixDQUFBLEdBQUFGLENBQUEsQ0FBQW1CLEdBQUEsU0FBQWpCLENBQUEsR0FBQUEsQ0FBQSxDQUFBMkMsSUFBQSxJQUFBckQsQ0FBQSxDQUFBRixDQUFBLENBQUFnRSxVQUFBLElBQUFwRCxDQUFBLENBQUFILEtBQUEsRUFBQVAsQ0FBQSxDQUFBK0QsSUFBQSxHQUFBakUsQ0FBQSxDQUFBa0UsT0FBQSxlQUFBaEUsQ0FBQSxDQUFBc0QsTUFBQSxLQUFBdEQsQ0FBQSxDQUFBc0QsTUFBQSxXQUFBdEQsQ0FBQSxDQUFBMkIsR0FBQSxHQUFBNUIsQ0FBQSxHQUFBQyxDQUFBLENBQUF1RCxRQUFBLFNBQUF0QixDQUFBLElBQUF2QixDQUFBLElBQUFWLENBQUEsQ0FBQXNELE1BQUEsWUFBQXRELENBQUEsQ0FBQTJCLEdBQUEsT0FBQWtDLFNBQUEsc0NBQUE3RCxDQUFBLENBQUF1RCxRQUFBLFNBQUF0QixDQUFBLGNBQUFnQyxhQUFBbEUsQ0FBQSxRQUFBRCxDQUFBLEtBQUFvRSxNQUFBLEVBQUFuRSxDQUFBLFlBQUFBLENBQUEsS0FBQUQsQ0FBQSxDQUFBcUUsUUFBQSxHQUFBcEUsQ0FBQSxXQUFBQSxDQUFBLEtBQUFELENBQUEsQ0FBQXNFLFVBQUEsR0FBQXJFLENBQUEsS0FBQUQsQ0FBQSxDQUFBdUUsUUFBQSxHQUFBdEUsQ0FBQSxXQUFBdUUsVUFBQSxDQUFBQyxJQUFBLENBQUF6RSxDQUFBLGNBQUEwRSxjQUFBekUsQ0FBQSxRQUFBRCxDQUFBLEdBQUFDLENBQUEsQ0FBQTBFLFVBQUEsUUFBQTNFLENBQUEsQ0FBQTRCLElBQUEsb0JBQUE1QixDQUFBLENBQUE2QixHQUFBLEVBQUE1QixDQUFBLENBQUEwRSxVQUFBLEdBQUEzRSxDQUFBLGFBQUF5QixRQUFBeEIsQ0FBQSxTQUFBdUUsVUFBQSxNQUFBSixNQUFBLGFBQUFuRSxDQUFBLENBQUE0QyxPQUFBLENBQUFzQixZQUFBLGNBQUFTLEtBQUEsaUJBQUFsQyxPQUFBMUMsQ0FBQSxRQUFBQSxDQUFBLFdBQUFBLENBQUEsUUFBQUUsQ0FBQSxHQUFBRixDQUFBLENBQUFZLENBQUEsT0FBQVYsQ0FBQSxTQUFBQSxDQUFBLENBQUE0QixJQUFBLENBQUE5QixDQUFBLDRCQUFBQSxDQUFBLENBQUFpRSxJQUFBLFNBQUFqRSxDQUFBLE9BQUE2RSxLQUFBLENBQUE3RSxDQUFBLENBQUE4RSxNQUFBLFNBQUF2RSxDQUFBLE9BQUFHLENBQUEsWUFBQXVELEtBQUEsYUFBQTFELENBQUEsR0FBQVAsQ0FBQSxDQUFBOEUsTUFBQSxPQUFBekUsQ0FBQSxDQUFBeUIsSUFBQSxDQUFBOUIsQ0FBQSxFQUFBTyxDQUFBLFVBQUEwRCxJQUFBLENBQUF4RCxLQUFBLEdBQUFULENBQUEsQ0FBQU8sQ0FBQSxHQUFBMEQsSUFBQSxDQUFBVixJQUFBLE9BQUFVLElBQUEsU0FBQUEsSUFBQSxDQUFBeEQsS0FBQSxHQUFBUixDQUFBLEVBQUFnRSxJQUFBLENBQUFWLElBQUEsT0FBQVUsSUFBQSxZQUFBdkQsQ0FBQSxDQUFBdUQsSUFBQSxHQUFBdkQsQ0FBQSxnQkFBQXFELFNBQUEsQ0FBQWQsT0FBQSxDQUFBakQsQ0FBQSxrQ0FBQW9DLGlCQUFBLENBQUFoQyxTQUFBLEdBQUFpQywwQkFBQSxFQUFBOUIsQ0FBQSxDQUFBb0MsQ0FBQSxtQkFBQWxDLEtBQUEsRUFBQTRCLDBCQUFBLEVBQUFqQixZQUFBLFNBQUFiLENBQUEsQ0FBQThCLDBCQUFBLG1CQUFBNUIsS0FBQSxFQUFBMkIsaUJBQUEsRUFBQWhCLFlBQUEsU0FBQWdCLGlCQUFBLENBQUEyQyxXQUFBLEdBQUE3RCxNQUFBLENBQUFtQiwwQkFBQSxFQUFBckIsQ0FBQSx3QkFBQWhCLENBQUEsQ0FBQWdGLG1CQUFBLGFBQUEvRSxDQUFBLFFBQUFELENBQUEsd0JBQUFDLENBQUEsSUFBQUEsQ0FBQSxDQUFBZ0YsV0FBQSxXQUFBakYsQ0FBQSxLQUFBQSxDQUFBLEtBQUFvQyxpQkFBQSw2QkFBQXBDLENBQUEsQ0FBQStFLFdBQUEsSUFBQS9FLENBQUEsQ0FBQWtGLElBQUEsT0FBQWxGLENBQUEsQ0FBQW1GLElBQUEsYUFBQWxGLENBQUEsV0FBQUUsTUFBQSxDQUFBaUYsY0FBQSxHQUFBakYsTUFBQSxDQUFBaUYsY0FBQSxDQUFBbkYsQ0FBQSxFQUFBb0MsMEJBQUEsS0FBQXBDLENBQUEsQ0FBQW9GLFNBQUEsR0FBQWhELDBCQUFBLEVBQUFuQixNQUFBLENBQUFqQixDQUFBLEVBQUFlLENBQUEseUJBQUFmLENBQUEsQ0FBQUcsU0FBQSxHQUFBRCxNQUFBLENBQUFxQixNQUFBLENBQUFtQixDQUFBLEdBQUExQyxDQUFBLEtBQUFELENBQUEsQ0FBQXNGLEtBQUEsYUFBQXJGLENBQUEsYUFBQWtELE9BQUEsRUFBQWxELENBQUEsT0FBQTJDLHFCQUFBLENBQUFHLGFBQUEsQ0FBQTNDLFNBQUEsR0FBQWMsTUFBQSxDQUFBNkIsYUFBQSxDQUFBM0MsU0FBQSxFQUFBVSxDQUFBLGlDQUFBZCxDQUFBLENBQUErQyxhQUFBLEdBQUFBLGFBQUEsRUFBQS9DLENBQUEsQ0FBQXVGLEtBQUEsYUFBQXRGLENBQUEsRUFBQUMsQ0FBQSxFQUFBRyxDQUFBLEVBQUFFLENBQUEsRUFBQUcsQ0FBQSxlQUFBQSxDQUFBLEtBQUFBLENBQUEsR0FBQThFLE9BQUEsT0FBQTVFLENBQUEsT0FBQW1DLGFBQUEsQ0FBQXpCLElBQUEsQ0FBQXJCLENBQUEsRUFBQUMsQ0FBQSxFQUFBRyxDQUFBLEVBQUFFLENBQUEsR0FBQUcsQ0FBQSxVQUFBVixDQUFBLENBQUFnRixtQkFBQSxDQUFBOUUsQ0FBQSxJQUFBVSxDQUFBLEdBQUFBLENBQUEsQ0FBQXFELElBQUEsR0FBQWIsSUFBQSxXQUFBbkQsQ0FBQSxXQUFBQSxDQUFBLENBQUFzRCxJQUFBLEdBQUF0RCxDQUFBLENBQUFRLEtBQUEsR0FBQUcsQ0FBQSxDQUFBcUQsSUFBQSxXQUFBckIscUJBQUEsQ0FBQUQsQ0FBQSxHQUFBekIsTUFBQSxDQUFBeUIsQ0FBQSxFQUFBM0IsQ0FBQSxnQkFBQUUsTUFBQSxDQUFBeUIsQ0FBQSxFQUFBL0IsQ0FBQSxpQ0FBQU0sTUFBQSxDQUFBeUIsQ0FBQSw2REFBQTNDLENBQUEsQ0FBQXlGLElBQUEsYUFBQXhGLENBQUEsUUFBQUQsQ0FBQSxHQUFBRyxNQUFBLENBQUFGLENBQUEsR0FBQUMsQ0FBQSxnQkFBQUcsQ0FBQSxJQUFBTCxDQUFBLEVBQUFFLENBQUEsQ0FBQXVFLElBQUEsQ0FBQXBFLENBQUEsVUFBQUgsQ0FBQSxDQUFBd0YsT0FBQSxhQUFBekIsS0FBQSxXQUFBL0QsQ0FBQSxDQUFBNEUsTUFBQSxTQUFBN0UsQ0FBQSxHQUFBQyxDQUFBLENBQUF5RixHQUFBLFFBQUExRixDQUFBLElBQUFELENBQUEsU0FBQWlFLElBQUEsQ0FBQXhELEtBQUEsR0FBQVIsQ0FBQSxFQUFBZ0UsSUFBQSxDQUFBVixJQUFBLE9BQUFVLElBQUEsV0FBQUEsSUFBQSxDQUFBVixJQUFBLE9BQUFVLElBQUEsUUFBQWpFLENBQUEsQ0FBQTBDLE1BQUEsR0FBQUEsTUFBQSxFQUFBakIsT0FBQSxDQUFBckIsU0FBQSxLQUFBNkUsV0FBQSxFQUFBeEQsT0FBQSxFQUFBbUQsS0FBQSxXQUFBQSxNQUFBNUUsQ0FBQSxhQUFBNEYsSUFBQSxXQUFBM0IsSUFBQSxXQUFBTixJQUFBLFFBQUFDLEtBQUEsR0FBQTNELENBQUEsT0FBQXNELElBQUEsWUFBQUUsUUFBQSxjQUFBRCxNQUFBLGdCQUFBM0IsR0FBQSxHQUFBNUIsQ0FBQSxPQUFBdUUsVUFBQSxDQUFBM0IsT0FBQSxDQUFBNkIsYUFBQSxJQUFBMUUsQ0FBQSxXQUFBRSxDQUFBLGtCQUFBQSxDQUFBLENBQUEyRixNQUFBLE9BQUF4RixDQUFBLENBQUF5QixJQUFBLE9BQUE1QixDQUFBLE1BQUEyRSxLQUFBLEVBQUEzRSxDQUFBLENBQUE0RixLQUFBLGNBQUE1RixDQUFBLElBQUFELENBQUEsTUFBQThGLElBQUEsV0FBQUEsS0FBQSxTQUFBeEMsSUFBQSxXQUFBdEQsQ0FBQSxRQUFBdUUsVUFBQSxJQUFBRyxVQUFBLGtCQUFBMUUsQ0FBQSxDQUFBMkIsSUFBQSxRQUFBM0IsQ0FBQSxDQUFBNEIsR0FBQSxjQUFBbUUsSUFBQSxLQUFBbkMsaUJBQUEsV0FBQUEsa0JBQUE3RCxDQUFBLGFBQUF1RCxJQUFBLFFBQUF2RCxDQUFBLE1BQUFFLENBQUEsa0JBQUErRixPQUFBNUYsQ0FBQSxFQUFBRSxDQUFBLFdBQUFLLENBQUEsQ0FBQWdCLElBQUEsWUFBQWhCLENBQUEsQ0FBQWlCLEdBQUEsR0FBQTdCLENBQUEsRUFBQUUsQ0FBQSxDQUFBK0QsSUFBQSxHQUFBNUQsQ0FBQSxFQUFBRSxDQUFBLEtBQUFMLENBQUEsQ0FBQXNELE1BQUEsV0FBQXRELENBQUEsQ0FBQTJCLEdBQUEsR0FBQTVCLENBQUEsS0FBQU0sQ0FBQSxhQUFBQSxDQUFBLFFBQUFpRSxVQUFBLENBQUFNLE1BQUEsTUFBQXZFLENBQUEsU0FBQUEsQ0FBQSxRQUFBRyxDQUFBLFFBQUE4RCxVQUFBLENBQUFqRSxDQUFBLEdBQUFLLENBQUEsR0FBQUYsQ0FBQSxDQUFBaUUsVUFBQSxpQkFBQWpFLENBQUEsQ0FBQTBELE1BQUEsU0FBQTZCLE1BQUEsYUFBQXZGLENBQUEsQ0FBQTBELE1BQUEsU0FBQXdCLElBQUEsUUFBQTlFLENBQUEsR0FBQVQsQ0FBQSxDQUFBeUIsSUFBQSxDQUFBcEIsQ0FBQSxlQUFBTSxDQUFBLEdBQUFYLENBQUEsQ0FBQXlCLElBQUEsQ0FBQXBCLENBQUEscUJBQUFJLENBQUEsSUFBQUUsQ0FBQSxhQUFBNEUsSUFBQSxHQUFBbEYsQ0FBQSxDQUFBMkQsUUFBQSxTQUFBNEIsTUFBQSxDQUFBdkYsQ0FBQSxDQUFBMkQsUUFBQSxnQkFBQXVCLElBQUEsR0FBQWxGLENBQUEsQ0FBQTRELFVBQUEsU0FBQTJCLE1BQUEsQ0FBQXZGLENBQUEsQ0FBQTRELFVBQUEsY0FBQXhELENBQUEsYUFBQThFLElBQUEsR0FBQWxGLENBQUEsQ0FBQTJELFFBQUEsU0FBQTRCLE1BQUEsQ0FBQXZGLENBQUEsQ0FBQTJELFFBQUEscUJBQUFyRCxDQUFBLFFBQUFzQyxLQUFBLHFEQUFBc0MsSUFBQSxHQUFBbEYsQ0FBQSxDQUFBNEQsVUFBQSxTQUFBMkIsTUFBQSxDQUFBdkYsQ0FBQSxDQUFBNEQsVUFBQSxZQUFBUixNQUFBLFdBQUFBLE9BQUE3RCxDQUFBLEVBQUFELENBQUEsYUFBQUUsQ0FBQSxRQUFBc0UsVUFBQSxDQUFBTSxNQUFBLE1BQUE1RSxDQUFBLFNBQUFBLENBQUEsUUFBQUssQ0FBQSxRQUFBaUUsVUFBQSxDQUFBdEUsQ0FBQSxPQUFBSyxDQUFBLENBQUE2RCxNQUFBLFNBQUF3QixJQUFBLElBQUF2RixDQUFBLENBQUF5QixJQUFBLENBQUF2QixDQUFBLHdCQUFBcUYsSUFBQSxHQUFBckYsQ0FBQSxDQUFBK0QsVUFBQSxRQUFBNUQsQ0FBQSxHQUFBSCxDQUFBLGFBQUFHLENBQUEsaUJBQUFULENBQUEsbUJBQUFBLENBQUEsS0FBQVMsQ0FBQSxDQUFBMEQsTUFBQSxJQUFBcEUsQ0FBQSxJQUFBQSxDQUFBLElBQUFVLENBQUEsQ0FBQTRELFVBQUEsS0FBQTVELENBQUEsY0FBQUUsQ0FBQSxHQUFBRixDQUFBLEdBQUFBLENBQUEsQ0FBQWlFLFVBQUEsY0FBQS9ELENBQUEsQ0FBQWdCLElBQUEsR0FBQTNCLENBQUEsRUFBQVcsQ0FBQSxDQUFBaUIsR0FBQSxHQUFBN0IsQ0FBQSxFQUFBVSxDQUFBLFNBQUE4QyxNQUFBLGdCQUFBUyxJQUFBLEdBQUF2RCxDQUFBLENBQUE0RCxVQUFBLEVBQUFuQyxDQUFBLFNBQUErRCxRQUFBLENBQUF0RixDQUFBLE1BQUFzRixRQUFBLFdBQUFBLFNBQUFqRyxDQUFBLEVBQUFELENBQUEsb0JBQUFDLENBQUEsQ0FBQTJCLElBQUEsUUFBQTNCLENBQUEsQ0FBQTRCLEdBQUEscUJBQUE1QixDQUFBLENBQUEyQixJQUFBLG1CQUFBM0IsQ0FBQSxDQUFBMkIsSUFBQSxRQUFBcUMsSUFBQSxHQUFBaEUsQ0FBQSxDQUFBNEIsR0FBQSxnQkFBQTVCLENBQUEsQ0FBQTJCLElBQUEsU0FBQW9FLElBQUEsUUFBQW5FLEdBQUEsR0FBQTVCLENBQUEsQ0FBQTRCLEdBQUEsT0FBQTJCLE1BQUEsa0JBQUFTLElBQUEseUJBQUFoRSxDQUFBLENBQUEyQixJQUFBLElBQUE1QixDQUFBLFVBQUFpRSxJQUFBLEdBQUFqRSxDQUFBLEdBQUFtQyxDQUFBLEtBQUFnRSxNQUFBLFdBQUFBLE9BQUFsRyxDQUFBLGFBQUFELENBQUEsUUFBQXdFLFVBQUEsQ0FBQU0sTUFBQSxNQUFBOUUsQ0FBQSxTQUFBQSxDQUFBLFFBQUFFLENBQUEsUUFBQXNFLFVBQUEsQ0FBQXhFLENBQUEsT0FBQUUsQ0FBQSxDQUFBb0UsVUFBQSxLQUFBckUsQ0FBQSxjQUFBaUcsUUFBQSxDQUFBaEcsQ0FBQSxDQUFBeUUsVUFBQSxFQUFBekUsQ0FBQSxDQUFBcUUsUUFBQSxHQUFBRyxhQUFBLENBQUF4RSxDQUFBLEdBQUFpQyxDQUFBLHlCQUFBaUUsT0FBQW5HLENBQUEsYUFBQUQsQ0FBQSxRQUFBd0UsVUFBQSxDQUFBTSxNQUFBLE1BQUE5RSxDQUFBLFNBQUFBLENBQUEsUUFBQUUsQ0FBQSxRQUFBc0UsVUFBQSxDQUFBeEUsQ0FBQSxPQUFBRSxDQUFBLENBQUFrRSxNQUFBLEtBQUFuRSxDQUFBLFFBQUFJLENBQUEsR0FBQUgsQ0FBQSxDQUFBeUUsVUFBQSxrQkFBQXRFLENBQUEsQ0FBQXVCLElBQUEsUUFBQXJCLENBQUEsR0FBQUYsQ0FBQSxDQUFBd0IsR0FBQSxFQUFBNkMsYUFBQSxDQUFBeEUsQ0FBQSxZQUFBSyxDQUFBLFlBQUErQyxLQUFBLDhCQUFBK0MsYUFBQSxXQUFBQSxjQUFBckcsQ0FBQSxFQUFBRSxDQUFBLEVBQUFHLENBQUEsZ0JBQUFvRCxRQUFBLEtBQUE1QyxRQUFBLEVBQUE2QixNQUFBLENBQUExQyxDQUFBLEdBQUFnRSxVQUFBLEVBQUE5RCxDQUFBLEVBQUFnRSxPQUFBLEVBQUE3RCxDQUFBLG9CQUFBbUQsTUFBQSxVQUFBM0IsR0FBQSxHQUFBNUIsQ0FBQSxHQUFBa0MsQ0FBQSxPQUFBbkMsQ0FBQTtBQUFBLFNBQUFzRyxtQkFBQUMsR0FBQSxFQUFBckQsT0FBQSxFQUFBc0QsTUFBQSxFQUFBQyxLQUFBLEVBQUFDLE1BQUEsRUFBQUMsR0FBQSxFQUFBOUUsR0FBQSxjQUFBK0UsSUFBQSxHQUFBTCxHQUFBLENBQUFJLEdBQUEsRUFBQTlFLEdBQUEsT0FBQXBCLEtBQUEsR0FBQW1HLElBQUEsQ0FBQW5HLEtBQUEsV0FBQW9HLEtBQUEsSUFBQUwsTUFBQSxDQUFBSyxLQUFBLGlCQUFBRCxJQUFBLENBQUFyRCxJQUFBLElBQUFMLE9BQUEsQ0FBQXpDLEtBQUEsWUFBQStFLE9BQUEsQ0FBQXRDLE9BQUEsQ0FBQXpDLEtBQUEsRUFBQTJDLElBQUEsQ0FBQXFELEtBQUEsRUFBQUMsTUFBQTtBQUFBLFNBQUFJLGtCQUFBQyxFQUFBLDZCQUFBQyxJQUFBLFNBQUFDLElBQUEsR0FBQUMsU0FBQSxhQUFBMUIsT0FBQSxXQUFBdEMsT0FBQSxFQUFBc0QsTUFBQSxRQUFBRCxHQUFBLEdBQUFRLEVBQUEsQ0FBQUksS0FBQSxDQUFBSCxJQUFBLEVBQUFDLElBQUEsWUFBQVIsTUFBQWhHLEtBQUEsSUFBQTZGLGtCQUFBLENBQUFDLEdBQUEsRUFBQXJELE9BQUEsRUFBQXNELE1BQUEsRUFBQUMsS0FBQSxFQUFBQyxNQUFBLFVBQUFqRyxLQUFBLGNBQUFpRyxPQUFBVSxHQUFBLElBQUFkLGtCQUFBLENBQUFDLEdBQUEsRUFBQXJELE9BQUEsRUFBQXNELE1BQUEsRUFBQUMsS0FBQSxFQUFBQyxNQUFBLFdBQUFVLEdBQUEsS0FBQVgsS0FBQSxDQUFBWSxTQUFBO0FBQUEsU0FEZUMsZ0JBQWdCQSxDQUFBO0VBQUEsT0FBQUMsaUJBQUEsQ0FBQUosS0FBQSxPQUFBRCxTQUFBO0FBQUE7QUFBQSxTQUFBSyxrQkFBQTtFQUFBQSxpQkFBQSxHQUFBVCxpQkFBQSxlQUFBL0csbUJBQUEsR0FBQW9GLElBQUEsQ0FBL0IsU0FBQXFDLFNBQUE7SUFBQSxJQUFBQyxHQUFBLEVBQUFDLFFBQUEsRUFBQUMsUUFBQSxFQUFBQyxLQUFBO0lBQUEsT0FBQTdILG1CQUFBLEdBQUF1QixJQUFBLFVBQUF1RyxVQUFBQyxTQUFBO01BQUEsa0JBQUFBLFNBQUEsQ0FBQWxDLElBQUEsR0FBQWtDLFNBQUEsQ0FBQTdELElBQUE7UUFBQTtVQUFBNkQsU0FBQSxDQUFBbEMsSUFBQTtVQUVVNkIsR0FBRyxHQUFHLHFCQUFxQjtVQUFBSyxTQUFBLENBQUE3RCxJQUFBO1VBQUEsT0FDVjhELEtBQUssQ0FBQ04sR0FBRyxFQUFFO1lBQ2hDakUsTUFBTSxFQUFFLEtBQUs7WUFDYndFLE9BQU8sRUFBRTtjQUNQLGNBQWMsRUFBRTtZQUNsQjtVQUNGLENBQUMsQ0FBQztRQUFBO1VBTElOLFFBQVEsR0FBQUksU0FBQSxDQUFBbkUsSUFBQTtVQUFBLElBT1QrRCxRQUFRLENBQUNPLEVBQUU7WUFBQUgsU0FBQSxDQUFBN0QsSUFBQTtZQUFBO1VBQUE7VUFBQSxNQUNSLElBQUlYLEtBQUssQ0FBQyxDQUFDO1FBQUE7VUFBQXdFLFNBQUEsQ0FBQTdELElBQUE7VUFBQSxPQUdJeUQsUUFBUSxDQUFDUSxJQUFJLENBQUMsQ0FBQztRQUFBO1VBQWhDUCxRQUFRLEdBQUFHLFNBQUEsQ0FBQW5FLElBQUE7VUFDUmlFLEtBQUssR0FBR0QsUUFBUSxDQUFDQyxLQUFLO1VBQUEsT0FBQUUsU0FBQSxDQUFBaEUsTUFBQSxXQUNyQjhELEtBQUs7UUFBQTtVQUFBRSxTQUFBLENBQUFsQyxJQUFBO1VBQUFrQyxTQUFBLENBQUFLLEVBQUEsR0FBQUwsU0FBQTtVQUVaTSxPQUFPLENBQUNDLEdBQUcsQ0FBQyxPQUFPLEVBQUFQLFNBQUEsQ0FBQUssRUFBTyxDQUFDO1FBQUE7UUFBQTtVQUFBLE9BQUFMLFNBQUEsQ0FBQS9CLElBQUE7TUFBQTtJQUFBLEdBQUF5QixRQUFBO0VBQUEsQ0FFOUI7RUFBQSxPQUFBRCxpQkFBQSxDQUFBSixLQUFBLE9BQUFELFNBQUE7QUFBQTtBQUVELFNBQVNvQixvQkFBb0JBLENBQUNWLEtBQUssRUFBRTtFQUNuQyxJQUFNVyxZQUFZLEdBQUdDLFFBQVEsQ0FBQ0MsY0FBYyxDQUFDLFVBQVUsQ0FBQztFQUN4REYsWUFBWSxDQUFDOUgsS0FBSyxHQUFHbUgsS0FBSztBQUM1QjtBQUVBLFNBQVNjLHlCQUF5QkEsQ0FBQSxFQUFHO0VBQ25DLElBQU1ILFlBQVksR0FBR0MsUUFBUSxDQUFDQyxjQUFjLENBQUMsVUFBVSxDQUFDO0VBQ3hERixZQUFZLENBQUNJLGdCQUFnQixDQUFDLFFBQVEsZUFBQTdCLGlCQUFBLGVBQUEvRyxtQkFBQSxHQUFBb0YsSUFBQSxDQUFFLFNBQUF5RCxRQUFBO0lBQUEsSUFBQWhCLEtBQUE7SUFBQSxPQUFBN0gsbUJBQUEsR0FBQXVCLElBQUEsVUFBQXVILFNBQUFDLFFBQUE7TUFBQSxrQkFBQUEsUUFBQSxDQUFBbEQsSUFBQSxHQUFBa0QsUUFBQSxDQUFBN0UsSUFBQTtRQUFBO1VBQ2xDMkQsS0FBSyxHQUFHVyxZQUFZLENBQUM5SCxLQUFLO1VBQUFxSSxRQUFBLENBQUE3RSxJQUFBO1VBQUEsT0FDeEI4RSxtQkFBbUIsQ0FBQ25CLEtBQUssQ0FBQztRQUFBO1VBQUFrQixRQUFBLENBQUE3RSxJQUFBO1VBQUEsT0FDbEJxRCxnQkFBZ0IsQ0FBQyxDQUFDO1FBQUE7VUFBaENNLEtBQUssR0FBQWtCLFFBQUEsQ0FBQW5GLElBQUE7VUFDTDJFLG9CQUFvQixDQUFDVixLQUFLLENBQUM7UUFBQTtRQUFBO1VBQUEsT0FBQWtCLFFBQUEsQ0FBQS9DLElBQUE7TUFBQTtJQUFBLEdBQUE2QyxPQUFBO0VBQUEsQ0FDNUIsR0FBQztBQUNKO0FBQUMsU0FFY0csbUJBQW1CQSxDQUFBQyxFQUFBO0VBQUEsT0FBQUMsb0JBQUEsQ0FBQTlCLEtBQUEsT0FBQUQsU0FBQTtBQUFBO0FBQUEsU0FBQStCLHFCQUFBO0VBQUFBLG9CQUFBLEdBQUFuQyxpQkFBQSxlQUFBL0csbUJBQUEsR0FBQW9GLElBQUEsQ0FBbEMsU0FBQStELFNBQW1DdEIsS0FBSztJQUFBLElBQUFILEdBQUEsRUFBQUMsUUFBQTtJQUFBLE9BQUEzSCxtQkFBQSxHQUFBdUIsSUFBQSxVQUFBNkgsVUFBQUMsU0FBQTtNQUFBLGtCQUFBQSxTQUFBLENBQUF4RCxJQUFBLEdBQUF3RCxTQUFBLENBQUFuRixJQUFBO1FBQUE7VUFBQW1GLFNBQUEsQ0FBQXhELElBQUE7VUFFOUI2QixHQUFHLEdBQUcscUJBQXFCO1VBQUEyQixTQUFBLENBQUFuRixJQUFBO1VBQUEsT0FDVjhELEtBQUssQ0FBQ04sR0FBRyxFQUFFO1lBQ2hDakUsTUFBTSxFQUFFLEtBQUs7WUFDYndFLE9BQU8sRUFBRTtjQUNQLGNBQWMsRUFBRTtZQUNsQixDQUFDO1lBQ0RxQixJQUFJLEVBQUVDLElBQUksQ0FBQ0MsU0FBUyxDQUFDO2NBQ25CM0IsS0FBSyxFQUFFQTtZQUNULENBQUM7VUFDSCxDQUFDLENBQUM7UUFBQTtVQVJJRixRQUFRLEdBQUEwQixTQUFBLENBQUF6RixJQUFBO1VBQUEsSUFVVCtELFFBQVEsQ0FBQ08sRUFBRTtZQUFBbUIsU0FBQSxDQUFBbkYsSUFBQTtZQUFBO1VBQUE7VUFBQSxNQUNSLElBQUlYLEtBQUssQ0FBQyxDQUFDO1FBQUE7VUFBQThGLFNBQUEsQ0FBQW5GLElBQUE7VUFBQTtRQUFBO1VBQUFtRixTQUFBLENBQUF4RCxJQUFBO1VBQUF3RCxTQUFBLENBQUFqQixFQUFBLEdBQUFpQixTQUFBO1VBR25CaEIsT0FBTyxDQUFDQyxHQUFHLENBQUMsT0FBTyxFQUFBZSxTQUFBLENBQUFqQixFQUFPLENBQUM7UUFBQTtRQUFBO1VBQUEsT0FBQWlCLFNBQUEsQ0FBQXJELElBQUE7TUFBQTtJQUFBLEdBQUFtRCxRQUFBO0VBQUEsQ0FFOUI7RUFBQSxPQUFBRCxvQkFBQSxDQUFBOUIsS0FBQSxPQUFBRCxTQUFBO0FBQUE7QUFBQSxTQUVjc0MsS0FBS0EsQ0FBQTtFQUFBLE9BQUFDLE1BQUEsQ0FBQXRDLEtBQUEsT0FBQUQsU0FBQTtBQUFBO0FBQUEsU0FBQXVDLE9BQUE7RUFBQUEsTUFBQSxHQUFBM0MsaUJBQUEsZUFBQS9HLG1CQUFBLEdBQUFvRixJQUFBLENBQXBCLFNBQUF1RSxTQUFBO0lBQUEsSUFBQTlCLEtBQUE7SUFBQSxPQUFBN0gsbUJBQUEsR0FBQXVCLElBQUEsVUFBQXFJLFVBQUFDLFNBQUE7TUFBQSxrQkFBQUEsU0FBQSxDQUFBaEUsSUFBQSxHQUFBZ0UsU0FBQSxDQUFBM0YsSUFBQTtRQUFBO1VBQUEyRixTQUFBLENBQUEzRixJQUFBO1VBQUEsT0FDc0JxRCxnQkFBZ0IsQ0FBQyxDQUFDO1FBQUE7VUFBaENNLEtBQUssR0FBQWdDLFNBQUEsQ0FBQWpHLElBQUE7VUFDWDJFLG9CQUFvQixDQUFDVixLQUFLLENBQUM7VUFDM0JjLHlCQUF5QixDQUFDLENBQUM7UUFBQTtRQUFBO1VBQUEsT0FBQWtCLFNBQUEsQ0FBQTdELElBQUE7TUFBQTtJQUFBLEdBQUEyRCxRQUFBO0VBQUEsQ0FDNUI7RUFBQSxPQUFBRCxNQUFBLENBQUF0QyxLQUFBLE9BQUFELFNBQUE7QUFBQTtBQUNEc0MsS0FBSyxDQUFDLENBQUMsQyIsInNvdXJjZXMiOlsid2VicGFjazovL2Rhc2hib2FyZC1teXNlbGZtb25hcnQvLi9yZXNvdXJjZXMvanMvdGFwZXN0cnktb3B0aW9ucy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJhc3luYyBmdW5jdGlvbiBnZXRUYXBlc3RyeVByaWNlKCkge1xuICB0cnkge1xuICAgIGNvbnN0IHVybCA9ICcvYXBpL3RhcGVzdHJ5L3ByaWNlJ1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKClcbiAgICB9XG5cbiAgICBjb25zdCB0YXBlc3RyeSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKVxuICAgIGNvbnN0IHByaWNlID0gdGFwZXN0cnkucHJpY2VcbiAgICByZXR1cm4gcHJpY2VcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmxvZygnZXJyb3InLCBlcnJvcilcbiAgfVxufVxuXG5mdW5jdGlvbiBkaXNwbGF5VGFwZXN0cnlQcmljZShwcmljZSkge1xuICBjb25zdCBwcmljZUVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJpY2UtbTInKVxuICBwcmljZUVsZW1lbnQudmFsdWUgPSBwcmljZVxufVxuXG5mdW5jdGlvbiBsaXN0ZW5UYXBlc3RyeVByaWNlQ2hhbmdlKCkge1xuICBjb25zdCBwcmljZUVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJpY2UtbTInKVxuICBwcmljZUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgYXN5bmMgKCkgPT4ge1xuICAgIGxldCBwcmljZSA9IHByaWNlRWxlbWVudC52YWx1ZVxuICAgIGF3YWl0IHVwZGF0ZVRhcGVzdHJ5UHJpY2UocHJpY2UpXG4gICAgcHJpY2UgPSBhd2FpdCBnZXRUYXBlc3RyeVByaWNlKClcbiAgICBkaXNwbGF5VGFwZXN0cnlQcmljZShwcmljZSlcbiAgfSlcbn1cblxuYXN5bmMgZnVuY3Rpb24gdXBkYXRlVGFwZXN0cnlQcmljZShwcmljZSkge1xuICB0cnkge1xuICAgIGNvbnN0IHVybCA9ICcvYXBpL3RhcGVzdHJ5L3ByaWNlJ1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICBtZXRob2Q6ICdQVVQnLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgcHJpY2U6IHByaWNlLFxuICAgICAgfSksXG4gICAgfSlcblxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigpXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUubG9nKCdlcnJvcicsIGVycm9yKVxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHN0YXJ0KCkge1xuICBjb25zdCBwcmljZSA9IGF3YWl0IGdldFRhcGVzdHJ5UHJpY2UoKVxuICBkaXNwbGF5VGFwZXN0cnlQcmljZShwcmljZSlcbiAgbGlzdGVuVGFwZXN0cnlQcmljZUNoYW5nZSgpXG59XG5zdGFydCgpXG4iXSwibmFtZXMiOlsiX3JlZ2VuZXJhdG9yUnVudGltZSIsImUiLCJ0IiwiciIsIk9iamVjdCIsInByb3RvdHlwZSIsIm4iLCJoYXNPd25Qcm9wZXJ0eSIsIm8iLCJkZWZpbmVQcm9wZXJ0eSIsInZhbHVlIiwiaSIsIlN5bWJvbCIsImEiLCJpdGVyYXRvciIsImMiLCJhc3luY0l0ZXJhdG9yIiwidSIsInRvU3RyaW5nVGFnIiwiZGVmaW5lIiwiZW51bWVyYWJsZSIsImNvbmZpZ3VyYWJsZSIsIndyaXRhYmxlIiwid3JhcCIsIkdlbmVyYXRvciIsImNyZWF0ZSIsIkNvbnRleHQiLCJtYWtlSW52b2tlTWV0aG9kIiwidHJ5Q2F0Y2giLCJ0eXBlIiwiYXJnIiwiY2FsbCIsImgiLCJsIiwiZiIsInMiLCJ5IiwiR2VuZXJhdG9yRnVuY3Rpb24iLCJHZW5lcmF0b3JGdW5jdGlvblByb3RvdHlwZSIsInAiLCJkIiwiZ2V0UHJvdG90eXBlT2YiLCJ2IiwidmFsdWVzIiwiZyIsImRlZmluZUl0ZXJhdG9yTWV0aG9kcyIsImZvckVhY2giLCJfaW52b2tlIiwiQXN5bmNJdGVyYXRvciIsImludm9rZSIsIl90eXBlb2YiLCJyZXNvbHZlIiwiX19hd2FpdCIsInRoZW4iLCJjYWxsSW52b2tlV2l0aE1ldGhvZEFuZEFyZyIsIkVycm9yIiwiZG9uZSIsIm1ldGhvZCIsImRlbGVnYXRlIiwibWF5YmVJbnZva2VEZWxlZ2F0ZSIsInNlbnQiLCJfc2VudCIsImRpc3BhdGNoRXhjZXB0aW9uIiwiYWJydXB0IiwiVHlwZUVycm9yIiwicmVzdWx0TmFtZSIsIm5leHQiLCJuZXh0TG9jIiwicHVzaFRyeUVudHJ5IiwidHJ5TG9jIiwiY2F0Y2hMb2MiLCJmaW5hbGx5TG9jIiwiYWZ0ZXJMb2MiLCJ0cnlFbnRyaWVzIiwicHVzaCIsInJlc2V0VHJ5RW50cnkiLCJjb21wbGV0aW9uIiwicmVzZXQiLCJpc05hTiIsImxlbmd0aCIsImRpc3BsYXlOYW1lIiwiaXNHZW5lcmF0b3JGdW5jdGlvbiIsImNvbnN0cnVjdG9yIiwibmFtZSIsIm1hcmsiLCJzZXRQcm90b3R5cGVPZiIsIl9fcHJvdG9fXyIsImF3cmFwIiwiYXN5bmMiLCJQcm9taXNlIiwia2V5cyIsInJldmVyc2UiLCJwb3AiLCJwcmV2IiwiY2hhckF0Iiwic2xpY2UiLCJzdG9wIiwicnZhbCIsImhhbmRsZSIsImNvbXBsZXRlIiwiZmluaXNoIiwiX2NhdGNoIiwiZGVsZWdhdGVZaWVsZCIsImFzeW5jR2VuZXJhdG9yU3RlcCIsImdlbiIsInJlamVjdCIsIl9uZXh0IiwiX3Rocm93Iiwia2V5IiwiaW5mbyIsImVycm9yIiwiX2FzeW5jVG9HZW5lcmF0b3IiLCJmbiIsInNlbGYiLCJhcmdzIiwiYXJndW1lbnRzIiwiYXBwbHkiLCJlcnIiLCJ1bmRlZmluZWQiLCJnZXRUYXBlc3RyeVByaWNlIiwiX2dldFRhcGVzdHJ5UHJpY2UiLCJfY2FsbGVlMiIsInVybCIsInJlc3BvbnNlIiwidGFwZXN0cnkiLCJwcmljZSIsIl9jYWxsZWUyJCIsIl9jb250ZXh0MiIsImZldGNoIiwiaGVhZGVycyIsIm9rIiwianNvbiIsInQwIiwiY29uc29sZSIsImxvZyIsImRpc3BsYXlUYXBlc3RyeVByaWNlIiwicHJpY2VFbGVtZW50IiwiZG9jdW1lbnQiLCJnZXRFbGVtZW50QnlJZCIsImxpc3RlblRhcGVzdHJ5UHJpY2VDaGFuZ2UiLCJhZGRFdmVudExpc3RlbmVyIiwiX2NhbGxlZSIsIl9jYWxsZWUkIiwiX2NvbnRleHQiLCJ1cGRhdGVUYXBlc3RyeVByaWNlIiwiX3giLCJfdXBkYXRlVGFwZXN0cnlQcmljZSIsIl9jYWxsZWUzIiwiX2NhbGxlZTMkIiwiX2NvbnRleHQzIiwiYm9keSIsIkpTT04iLCJzdHJpbmdpZnkiLCJzdGFydCIsIl9zdGFydCIsIl9jYWxsZWU0IiwiX2NhbGxlZTQkIiwiX2NvbnRleHQ0Il0sInNvdXJjZVJvb3QiOiIifQ==
