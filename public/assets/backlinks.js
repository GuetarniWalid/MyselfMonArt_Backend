/******/ ;(() => {
  // webpackBootstrap
  /******/ 'use strict'
  /******/ var __webpack_modules__ = {
    /***/ './node_modules/gridjs/dist/gridjs.module.js':
      /*!***************************************************!*\
  !*** ./node_modules/gridjs/dist/gridjs.module.js ***!
  \***************************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__)
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ Cell: () => /* binding */ X,
          /* harmony export */ Component: () => /* binding */ N,
          /* harmony export */ Config: () => /* binding */ pn,
          /* harmony export */ Grid: () => /* binding */ Ln,
          /* harmony export */ PluginPosition: () => /* binding */ zt,
          /* harmony export */ Row: () => /* binding */ Z,
          /* harmony export */ className: () => /* binding */ et,
          /* harmony export */ createElement: () => /* binding */ w,
          /* harmony export */ createRef: () => /* binding */ k,
          /* harmony export */ h: () => /* binding */ w,
          /* harmony export */ html: () => /* binding */ G,
          /* harmony export */ useConfig: () => /* binding */ It,
          /* harmony export */ useEffect: () => /* binding */ gt,
          /* harmony export */ useRef: () => /* binding */ bt,
          /* harmony export */ useSelector: () => /* binding */ jt,
          /* harmony export */ useState: () => /* binding */ yt,
          /* harmony export */ useStore: () => /* binding */ Ht,
          /* harmony export */ useTranslator: () => /* binding */ At,
          /* harmony export */
        })
        function t(t, n) {
          for (var e = 0; e < n.length; e++) {
            var r = n[e]
            ;(r.enumerable = r.enumerable || !1),
              (r.configurable = !0),
              'value' in r && (r.writable = !0),
              Object.defineProperty(
                t,
                'symbol' ==
                  typeof (o = (function (t, n) {
                    if ('object' != typeof t || null === t) return t
                    var e = t[Symbol.toPrimitive]
                    if (void 0 !== e) {
                      var r = e.call(t, 'string')
                      if ('object' != typeof r) return r
                      throw new TypeError('@@toPrimitive must return a primitive value.')
                    }
                    return String(t)
                  })(r.key))
                  ? o
                  : String(o),
                r
              )
          }
          var o
        }
        function n(n, e, r) {
          return (
            e && t(n.prototype, e),
            r && t(n, r),
            Object.defineProperty(n, 'prototype', { writable: !1 }),
            n
          )
        }
        function e() {
          return (
            (e = Object.assign
              ? Object.assign.bind()
              : function (t) {
                  for (var n = 1; n < arguments.length; n++) {
                    var e = arguments[n]
                    for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && (t[r] = e[r])
                  }
                  return t
                }),
            e.apply(this, arguments)
          )
        }
        function r(t, n) {
          ;(t.prototype = Object.create(n.prototype)), (t.prototype.constructor = t), o(t, n)
        }
        function o(t, n) {
          return (
            (o = Object.setPrototypeOf
              ? Object.setPrototypeOf.bind()
              : function (t, n) {
                  return (t.__proto__ = n), t
                }),
            o(t, n)
          )
        }
        function i(t) {
          if (void 0 === t)
            throw new ReferenceError("this hasn't been initialised - super() hasn't been called")
          return t
        }
        function u(t, n) {
          ;(null == n || n > t.length) && (n = t.length)
          for (var e = 0, r = new Array(n); e < n; e++) r[e] = t[e]
          return r
        }
        function s(t, n) {
          var e = ('undefined' != typeof Symbol && t[Symbol.iterator]) || t['@@iterator']
          if (e) return (e = e.call(t)).next.bind(e)
          if (
            Array.isArray(t) ||
            (e = (function (t, n) {
              if (t) {
                if ('string' == typeof t) return u(t, n)
                var e = Object.prototype.toString.call(t).slice(8, -1)
                return (
                  'Object' === e && t.constructor && (e = t.constructor.name),
                  'Map' === e || 'Set' === e
                    ? Array.from(t)
                    : 'Arguments' === e || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(e)
                      ? u(t, n)
                      : void 0
                )
              }
            })(t)) ||
            (n && t && 'number' == typeof t.length)
          ) {
            e && (t = e)
            var r = 0
            return function () {
              return r >= t.length ? { done: !0 } : { done: !1, value: t[r++] }
            }
          }
          throw new TypeError(
            'Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.'
          )
        }
        var a
        !(function (t) {
          ;(t[(t.Init = 0)] = 'Init'),
            (t[(t.Loading = 1)] = 'Loading'),
            (t[(t.Loaded = 2)] = 'Loaded'),
            (t[(t.Rendered = 3)] = 'Rendered'),
            (t[(t.Error = 4)] = 'Error')
        })(a || (a = {}))
        var l,
          c,
          f,
          p,
          d,
          h,
          _,
          m = {},
          v = [],
          y = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i
        function g(t, n) {
          for (var e in n) t[e] = n[e]
          return t
        }
        function b(t) {
          var n = t.parentNode
          n && n.removeChild(t)
        }
        function w(t, n, e) {
          var r,
            o,
            i,
            u = {}
          for (i in n) 'key' == i ? (r = n[i]) : 'ref' == i ? (o = n[i]) : (u[i] = n[i])
          if (
            (arguments.length > 2 && (u.children = arguments.length > 3 ? l.call(arguments, 2) : e),
            'function' == typeof t && null != t.defaultProps)
          )
            for (i in t.defaultProps) void 0 === u[i] && (u[i] = t.defaultProps[i])
          return x(t, u, r, o, null)
        }
        function x(t, n, e, r, o) {
          var i = {
            type: t,
            props: n,
            key: e,
            ref: r,
            __k: null,
            __: null,
            __b: 0,
            __e: null,
            __d: void 0,
            __c: null,
            __h: null,
            constructor: void 0,
            __v: null == o ? ++f : o,
          }
          return null == o && null != c.vnode && c.vnode(i), i
        }
        function k() {
          return { current: null }
        }
        function S(t) {
          return t.children
        }
        function N(t, n) {
          ;(this.props = t), (this.context = n)
        }
        function P(t, n) {
          if (null == n) return t.__ ? P(t.__, t.__.__k.indexOf(t) + 1) : null
          for (var e; n < t.__k.length; n++)
            if (null != (e = t.__k[n]) && null != e.__e) return e.__e
          return 'function' == typeof t.type ? P(t) : null
        }
        function C(t) {
          var n, e
          if (null != (t = t.__) && null != t.__c) {
            for (t.__e = t.__c.base = null, n = 0; n < t.__k.length; n++)
              if (null != (e = t.__k[n]) && null != e.__e) {
                t.__e = t.__c.base = e.__e
                break
              }
            return C(t)
          }
        }
        function E(t) {
          ;((!t.__d && (t.__d = !0) && d.push(t) && !I.__r++) || h !== c.debounceRendering) &&
            ((h = c.debounceRendering) || setTimeout)(I)
        }
        function I() {
          for (var t; (I.__r = d.length); )
            (t = d.sort(function (t, n) {
              return t.__v.__b - n.__v.__b
            })),
              (d = []),
              t.some(function (t) {
                var n, e, r, o, i, u
                t.__d &&
                  ((i = (o = (n = t).__v).__e),
                  (u = n.__P) &&
                    ((e = []),
                    ((r = g({}, o)).__v = o.__v + 1),
                    M(
                      u,
                      o,
                      r,
                      n.__n,
                      void 0 !== u.ownerSVGElement,
                      null != o.__h ? [i] : null,
                      e,
                      null == i ? P(o) : i,
                      o.__h
                    ),
                    F(e, o),
                    o.__e != i && C(o)))
              })
        }
        function T(t, n, e, r, o, i, u, s, a, l) {
          var c,
            f,
            p,
            d,
            h,
            _,
            y,
            g = (r && r.__k) || v,
            b = g.length
          for (e.__k = [], c = 0; c < n.length; c++)
            if (
              null !=
              (d = e.__k[c] =
                null == (d = n[c]) || 'boolean' == typeof d
                  ? null
                  : 'string' == typeof d || 'number' == typeof d || 'bigint' == typeof d
                    ? x(null, d, null, null, d)
                    : Array.isArray(d)
                      ? x(S, { children: d }, null, null, null)
                      : d.__b > 0
                        ? x(d.type, d.props, d.key, d.ref ? d.ref : null, d.__v)
                        : d)
            ) {
              if (
                ((d.__ = e),
                (d.__b = e.__b + 1),
                null === (p = g[c]) || (p && d.key == p.key && d.type === p.type))
              )
                g[c] = void 0
              else
                for (f = 0; f < b; f++) {
                  if ((p = g[f]) && d.key == p.key && d.type === p.type) {
                    g[f] = void 0
                    break
                  }
                  p = null
                }
              M(t, d, (p = p || m), o, i, u, s, a, l),
                (h = d.__e),
                (f = d.ref) &&
                  p.ref != f &&
                  (y || (y = []), p.ref && y.push(p.ref, null, d), y.push(f, d.__c || h, d)),
                null != h
                  ? (null == _ && (_ = h),
                    'function' == typeof d.type && d.__k === p.__k
                      ? (d.__d = a = L(d, a, t))
                      : (a = A(t, d, p, g, h, a)),
                    'function' == typeof e.type && (e.__d = a))
                  : a && p.__e == a && a.parentNode != t && (a = P(p))
            }
          for (e.__e = _, c = b; c--; ) null != g[c] && W(g[c], g[c])
          if (y) for (c = 0; c < y.length; c++) U(y[c], y[++c], y[++c])
        }
        function L(t, n, e) {
          for (var r, o = t.__k, i = 0; o && i < o.length; i++)
            (r = o[i]) &&
              ((r.__ = t), (n = 'function' == typeof r.type ? L(r, n, e) : A(e, r, r, o, r.__e, n)))
          return n
        }
        function A(t, n, e, r, o, i) {
          var u, s, a
          if (void 0 !== n.__d) (u = n.__d), (n.__d = void 0)
          else if (null == e || o != i || null == o.parentNode)
            t: if (null == i || i.parentNode !== t) t.appendChild(o), (u = null)
            else {
              for (s = i, a = 0; (s = s.nextSibling) && a < r.length; a += 1) if (s == o) break t
              t.insertBefore(o, i), (u = i)
            }
          return void 0 !== u ? u : o.nextSibling
        }
        function O(t, n, e) {
          '-' === n[0]
            ? t.setProperty(n, e)
            : (t[n] = null == e ? '' : 'number' != typeof e || y.test(n) ? e : e + 'px')
        }
        function H(t, n, e, r, o) {
          var i
          t: if ('style' === n)
            if ('string' == typeof e) t.style.cssText = e
            else {
              if (('string' == typeof r && (t.style.cssText = r = ''), r))
                for (n in r) (e && n in e) || O(t.style, n, '')
              if (e) for (n in e) (r && e[n] === r[n]) || O(t.style, n, e[n])
            }
          else if ('o' === n[0] && 'n' === n[1])
            (i = n !== (n = n.replace(/Capture$/, ''))),
              (n = n.toLowerCase() in t ? n.toLowerCase().slice(2) : n.slice(2)),
              t.l || (t.l = {}),
              (t.l[n + i] = e),
              e ? r || t.addEventListener(n, i ? D : j, i) : t.removeEventListener(n, i ? D : j, i)
          else if ('dangerouslySetInnerHTML' !== n) {
            if (o) n = n.replace(/xlink(H|:h)/, 'h').replace(/sName$/, 's')
            else if (
              'href' !== n &&
              'list' !== n &&
              'form' !== n &&
              'tabIndex' !== n &&
              'download' !== n &&
              n in t
            )
              try {
                t[n] = null == e ? '' : e
                break t
              } catch (t) {}
            'function' == typeof e ||
              (null == e || (!1 === e && -1 == n.indexOf('-'))
                ? t.removeAttribute(n)
                : t.setAttribute(n, e))
          }
        }
        function j(t) {
          this.l[t.type + !1](c.event ? c.event(t) : t)
        }
        function D(t) {
          this.l[t.type + !0](c.event ? c.event(t) : t)
        }
        function M(t, n, e, r, o, i, u, s, a) {
          var l,
            f,
            p,
            d,
            h,
            _,
            m,
            v,
            y,
            b,
            w,
            x,
            k,
            P,
            C,
            E = n.type
          if (void 0 !== n.constructor) return null
          null != e.__h && ((a = e.__h), (s = n.__e = e.__e), (n.__h = null), (i = [s])),
            (l = c.__b) && l(n)
          try {
            t: if ('function' == typeof E) {
              if (
                ((v = n.props),
                (y = (l = E.contextType) && r[l.__c]),
                (b = l ? (y ? y.props.value : l.__) : r),
                e.__c
                  ? (m = (f = n.__c = e.__c).__ = f.__E)
                  : ('prototype' in E && E.prototype.render
                      ? (n.__c = f = new E(v, b))
                      : ((n.__c = f = new N(v, b)), (f.constructor = E), (f.render = B)),
                    y && y.sub(f),
                    (f.props = v),
                    f.state || (f.state = {}),
                    (f.context = b),
                    (f.__n = r),
                    (p = f.__d = !0),
                    (f.__h = []),
                    (f._sb = [])),
                null == f.__s && (f.__s = f.state),
                null != E.getDerivedStateFromProps &&
                  (f.__s == f.state && (f.__s = g({}, f.__s)),
                  g(f.__s, E.getDerivedStateFromProps(v, f.__s))),
                (d = f.props),
                (h = f.state),
                p)
              )
                null == E.getDerivedStateFromProps &&
                  null != f.componentWillMount &&
                  f.componentWillMount(),
                  null != f.componentDidMount && f.__h.push(f.componentDidMount)
              else {
                if (
                  (null == E.getDerivedStateFromProps &&
                    v !== d &&
                    null != f.componentWillReceiveProps &&
                    f.componentWillReceiveProps(v, b),
                  (!f.__e &&
                    null != f.shouldComponentUpdate &&
                    !1 === f.shouldComponentUpdate(v, f.__s, b)) ||
                    n.__v === e.__v)
                ) {
                  for (
                    f.props = v,
                      f.state = f.__s,
                      n.__v !== e.__v && (f.__d = !1),
                      f.__v = n,
                      n.__e = e.__e,
                      n.__k = e.__k,
                      n.__k.forEach(function (t) {
                        t && (t.__ = n)
                      }),
                      w = 0;
                    w < f._sb.length;
                    w++
                  )
                    f.__h.push(f._sb[w])
                  ;(f._sb = []), f.__h.length && u.push(f)
                  break t
                }
                null != f.componentWillUpdate && f.componentWillUpdate(v, f.__s, b),
                  null != f.componentDidUpdate &&
                    f.__h.push(function () {
                      f.componentDidUpdate(d, h, _)
                    })
              }
              if (
                ((f.context = b),
                (f.props = v),
                (f.__v = n),
                (f.__P = t),
                (x = c.__r),
                (k = 0),
                'prototype' in E && E.prototype.render)
              ) {
                for (
                  f.state = f.__s,
                    f.__d = !1,
                    x && x(n),
                    l = f.render(f.props, f.state, f.context),
                    P = 0;
                  P < f._sb.length;
                  P++
                )
                  f.__h.push(f._sb[P])
                f._sb = []
              } else
                do {
                  ;(f.__d = !1),
                    x && x(n),
                    (l = f.render(f.props, f.state, f.context)),
                    (f.state = f.__s)
                } while (f.__d && ++k < 25)
              ;(f.state = f.__s),
                null != f.getChildContext && (r = g(g({}, r), f.getChildContext())),
                p || null == f.getSnapshotBeforeUpdate || (_ = f.getSnapshotBeforeUpdate(d, h)),
                (C = null != l && l.type === S && null == l.key ? l.props.children : l),
                T(t, Array.isArray(C) ? C : [C], n, e, r, o, i, u, s, a),
                (f.base = n.__e),
                (n.__h = null),
                f.__h.length && u.push(f),
                m && (f.__E = f.__ = null),
                (f.__e = !1)
            } else
              null == i && n.__v === e.__v
                ? ((n.__k = e.__k), (n.__e = e.__e))
                : (n.__e = R(e.__e, n, e, r, o, i, u, a))
            ;(l = c.diffed) && l(n)
          } catch (t) {
            ;(n.__v = null),
              (a || null != i) && ((n.__e = s), (n.__h = !!a), (i[i.indexOf(s)] = null)),
              c.__e(t, n, e)
          }
        }
        function F(t, n) {
          c.__c && c.__c(n, t),
            t.some(function (n) {
              try {
                ;(t = n.__h),
                  (n.__h = []),
                  t.some(function (t) {
                    t.call(n)
                  })
              } catch (t) {
                c.__e(t, n.__v)
              }
            })
        }
        function R(t, n, e, r, o, i, u, s) {
          var a,
            c,
            f,
            p = e.props,
            d = n.props,
            h = n.type,
            _ = 0
          if (('svg' === h && (o = !0), null != i))
            for (; _ < i.length; _++)
              if (
                (a = i[_]) &&
                'setAttribute' in a == !!h &&
                (h ? a.localName === h : 3 === a.nodeType)
              ) {
                ;(t = a), (i[_] = null)
                break
              }
          if (null == t) {
            if (null === h) return document.createTextNode(d)
            ;(t = o
              ? document.createElementNS('http://www.w3.org/2000/svg', h)
              : document.createElement(h, d.is && d)),
              (i = null),
              (s = !1)
          }
          if (null === h) p === d || (s && t.data === d) || (t.data = d)
          else {
            if (
              ((i = i && l.call(t.childNodes)),
              (c = (p = e.props || m).dangerouslySetInnerHTML),
              (f = d.dangerouslySetInnerHTML),
              !s)
            ) {
              if (null != i)
                for (p = {}, _ = 0; _ < t.attributes.length; _++)
                  p[t.attributes[_].name] = t.attributes[_].value
              ;(f || c) &&
                ((f && ((c && f.__html == c.__html) || f.__html === t.innerHTML)) ||
                  (t.innerHTML = (f && f.__html) || ''))
            }
            if (
              ((function (t, n, e, r, o) {
                var i
                for (i in e) 'children' === i || 'key' === i || i in n || H(t, i, null, e[i], r)
                for (i in n)
                  (o && 'function' != typeof n[i]) ||
                    'children' === i ||
                    'key' === i ||
                    'value' === i ||
                    'checked' === i ||
                    e[i] === n[i] ||
                    H(t, i, n[i], e[i], r)
              })(t, d, p, o, s),
              f)
            )
              n.__k = []
            else if (
              ((_ = n.props.children),
              T(
                t,
                Array.isArray(_) ? _ : [_],
                n,
                e,
                r,
                o && 'foreignObject' !== h,
                i,
                u,
                i ? i[0] : e.__k && P(e, 0),
                s
              ),
              null != i)
            )
              for (_ = i.length; _--; ) null != i[_] && b(i[_])
            s ||
              ('value' in d &&
                void 0 !== (_ = d.value) &&
                (_ !== t.value || ('progress' === h && !_) || ('option' === h && _ !== p.value)) &&
                H(t, 'value', _, p.value, !1),
              'checked' in d &&
                void 0 !== (_ = d.checked) &&
                _ !== t.checked &&
                H(t, 'checked', _, p.checked, !1))
          }
          return t
        }
        function U(t, n, e) {
          try {
            'function' == typeof t ? t(n) : (t.current = n)
          } catch (t) {
            c.__e(t, e)
          }
        }
        function W(t, n, e) {
          var r, o
          if (
            (c.unmount && c.unmount(t),
            (r = t.ref) && ((r.current && r.current !== t.__e) || U(r, null, n)),
            null != (r = t.__c))
          ) {
            if (r.componentWillUnmount)
              try {
                r.componentWillUnmount()
              } catch (t) {
                c.__e(t, n)
              }
            ;(r.base = r.__P = null), (t.__c = void 0)
          }
          if ((r = t.__k))
            for (o = 0; o < r.length; o++) r[o] && W(r[o], n, e || 'function' != typeof t.type)
          e || null == t.__e || b(t.__e), (t.__ = t.__e = t.__d = void 0)
        }
        function B(t, n, e) {
          return this.constructor(t, e)
        }
        function q(t, n, e) {
          var r, o, i
          c.__ && c.__(t, n),
            (o = (r = 'function' == typeof e) ? null : (e && e.__k) || n.__k),
            (i = []),
            M(
              n,
              (t = ((!r && e) || n).__k = w(S, null, [t])),
              o || m,
              m,
              void 0 !== n.ownerSVGElement,
              !r && e ? [e] : o ? null : n.firstChild ? l.call(n.childNodes) : null,
              i,
              !r && e ? e : o ? o.__e : n.firstChild,
              r
            ),
            F(i, t)
        }
        function z() {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (t) {
            var n = (16 * Math.random()) | 0
            return ('x' == t ? n : (3 & n) | 8).toString(16)
          })
        }
        ;(l = v.slice),
          (c = {
            __e: function (t, n, e, r) {
              for (var o, i, u; (n = n.__); )
                if ((o = n.__c) && !o.__)
                  try {
                    if (
                      ((i = o.constructor) &&
                        null != i.getDerivedStateFromError &&
                        (o.setState(i.getDerivedStateFromError(t)), (u = o.__d)),
                      null != o.componentDidCatch && (o.componentDidCatch(t, r || {}), (u = o.__d)),
                      u)
                    )
                      return (o.__E = o)
                  } catch (n) {
                    t = n
                  }
              throw t
            },
          }),
          (f = 0),
          (p = function (t) {
            return null != t && void 0 === t.constructor
          }),
          (N.prototype.setState = function (t, n) {
            var e
            ;(e =
              null != this.__s && this.__s !== this.state
                ? this.__s
                : (this.__s = g({}, this.state))),
              'function' == typeof t && (t = t(g({}, e), this.props)),
              t && g(e, t),
              null != t && this.__v && (n && this._sb.push(n), E(this))
          }),
          (N.prototype.forceUpdate = function (t) {
            this.__v && ((this.__e = !0), t && this.__h.push(t), E(this))
          }),
          (N.prototype.render = S),
          (d = []),
          (I.__r = 0),
          (_ = 0)
        var V = /*#__PURE__*/ (function () {
          function t(t) {
            ;(this._id = void 0), (this._id = t || z())
          }
          return (
            n(t, [
              {
                key: 'id',
                get: function () {
                  return this._id
                },
              },
            ]),
            t
          )
        })()
        function $(t) {
          return w(t.parentElement || 'span', { dangerouslySetInnerHTML: { __html: t.content } })
        }
        function G(t, n) {
          return w($, { content: t, parentElement: n })
        }
        var K,
          X = /*#__PURE__*/ (function (t) {
            function n(n) {
              var e
              return ((e = t.call(this) || this).data = void 0), e.update(n), e
            }
            r(n, t)
            var e = n.prototype
            return (
              (e.cast = function (t) {
                return t instanceof HTMLElement ? G(t.outerHTML) : t
              }),
              (e.update = function (t) {
                return (this.data = this.cast(t)), this
              }),
              n
            )
          })(V),
          Z = /*#__PURE__*/ (function (t) {
            function e(n) {
              var e
              return ((e = t.call(this) || this)._cells = void 0), (e.cells = n || []), e
            }
            r(e, t)
            var o = e.prototype
            return (
              (o.cell = function (t) {
                return this._cells[t]
              }),
              (o.toArray = function () {
                return this.cells.map(function (t) {
                  return t.data
                })
              }),
              (e.fromCells = function (t) {
                return new e(
                  t.map(function (t) {
                    return new X(t.data)
                  })
                )
              }),
              n(e, [
                {
                  key: 'cells',
                  get: function () {
                    return this._cells
                  },
                  set: function (t) {
                    this._cells = t
                  },
                },
                {
                  key: 'length',
                  get: function () {
                    return this.cells.length
                  },
                },
              ]),
              e
            )
          })(V),
          J = /*#__PURE__*/ (function (t) {
            function e(n) {
              var e
              return (
                ((e = t.call(this) || this)._rows = void 0),
                (e._length = void 0),
                (e.rows = n instanceof Array ? n : n instanceof Z ? [n] : []),
                e
              )
            }
            return (
              r(e, t),
              (e.prototype.toArray = function () {
                return this.rows.map(function (t) {
                  return t.toArray()
                })
              }),
              (e.fromRows = function (t) {
                return new e(
                  t.map(function (t) {
                    return Z.fromCells(t.cells)
                  })
                )
              }),
              (e.fromArray = function (t) {
                return new e(
                  (t = (function (t) {
                    return !t[0] || t[0] instanceof Array ? t : [t]
                  })(t)).map(function (t) {
                    return new Z(
                      t.map(function (t) {
                        return new X(t)
                      })
                    )
                  })
                )
              }),
              n(e, [
                {
                  key: 'rows',
                  get: function () {
                    return this._rows
                  },
                  set: function (t) {
                    this._rows = t
                  },
                },
                {
                  key: 'length',
                  get: function () {
                    return this._length || this.rows.length
                  },
                  set: function (t) {
                    this._length = t
                  },
                },
              ]),
              e
            )
          })(V),
          Q = /*#__PURE__*/ (function () {
            function t() {
              this.callbacks = void 0
            }
            var n = t.prototype
            return (
              (n.init = function (t) {
                this.callbacks || (this.callbacks = {}),
                  t && !this.callbacks[t] && (this.callbacks[t] = [])
              }),
              (n.listeners = function () {
                return this.callbacks
              }),
              (n.on = function (t, n) {
                return this.init(t), this.callbacks[t].push(n), this
              }),
              (n.off = function (t, n) {
                var e = t
                return (
                  this.init(),
                  this.callbacks[e] && 0 !== this.callbacks[e].length
                    ? ((this.callbacks[e] = this.callbacks[e].filter(function (t) {
                        return t != n
                      })),
                      this)
                    : this
                )
              }),
              (n.emit = function (t) {
                var n = arguments,
                  e = t
                return (
                  this.init(e),
                  this.callbacks[e].length > 0 &&
                    (this.callbacks[e].forEach(function (t) {
                      return t.apply(void 0, [].slice.call(n, 1))
                    }),
                    !0)
                )
              }),
              t
            )
          })()
        function Y(t, n) {
          if (typeof t != typeof n) return !1
          if (null === t && null === n) return !0
          if ('object' != typeof t) return t === n
          if (Array.isArray(t) && Array.isArray(n)) {
            if (t.length !== n.length) return !1
            for (var e = 0; e < t.length; e++) if (!Y(t[e], n[e])) return !1
            return !0
          }
          if (
            t.hasOwnProperty('constructor') &&
            n.hasOwnProperty('constructor') &&
            t.hasOwnProperty('props') &&
            n.hasOwnProperty('props') &&
            t.hasOwnProperty('key') &&
            n.hasOwnProperty('key') &&
            t.hasOwnProperty('ref') &&
            n.hasOwnProperty('ref') &&
            t.hasOwnProperty('type') &&
            n.hasOwnProperty('type')
          )
            return Y(t.props, n.props)
          var r = Object.keys(t),
            o = Object.keys(n)
          if (r.length !== o.length) return !1
          for (var i = 0, u = r; i < u.length; i++) {
            var s = u[i]
            if (!n.hasOwnProperty(s) || !Y(t[s], n[s])) return !1
          }
          return !0
        }
        !(function (t) {
          ;(t[(t.Initiator = 0)] = 'Initiator'),
            (t[(t.ServerFilter = 1)] = 'ServerFilter'),
            (t[(t.ServerSort = 2)] = 'ServerSort'),
            (t[(t.ServerLimit = 3)] = 'ServerLimit'),
            (t[(t.Extractor = 4)] = 'Extractor'),
            (t[(t.Transformer = 5)] = 'Transformer'),
            (t[(t.Filter = 6)] = 'Filter'),
            (t[(t.Sort = 7)] = 'Sort'),
            (t[(t.Limit = 8)] = 'Limit')
        })(K || (K = {}))
        var tt = /*#__PURE__*/ (function (t) {
            function o(n) {
              var e
              return (
                ((e = t.call(this) || this).id = void 0),
                (e._props = void 0),
                (e._props = {}),
                (e.id = z()),
                n && e.setProps(n),
                e
              )
            }
            r(o, t)
            var i = o.prototype
            return (
              (i.process = function () {
                var t = [].slice.call(arguments)
                this.validateProps instanceof Function && this.validateProps.apply(this, t),
                  this.emit.apply(this, ['beforeProcess'].concat(t))
                var n = this._process.apply(this, t)
                return this.emit.apply(this, ['afterProcess'].concat(t)), n
              }),
              (i.setProps = function (t) {
                var n = e({}, this._props, t)
                return (
                  Y(n, this._props) || ((this._props = n), this.emit('propsUpdated', this)), this
                )
              }),
              n(o, [
                {
                  key: 'props',
                  get: function () {
                    return this._props
                  },
                },
              ]),
              o
            )
          })(Q),
          nt = /*#__PURE__*/ (function (t) {
            function e() {
              return t.apply(this, arguments) || this
            }
            return (
              r(e, t),
              (e.prototype._process = function (t) {
                return this.props.keyword
                  ? ((n = String(this.props.keyword).trim()),
                    (e = this.props.columns),
                    (r = this.props.ignoreHiddenColumns),
                    (o = t),
                    (i = this.props.selector),
                    (n = n.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')),
                    new J(
                      o.rows.filter(function (t, o) {
                        return t.cells.some(function (t, u) {
                          if (!t) return !1
                          if (r && e && e[u] && 'object' == typeof e[u] && e[u].hidden) return !1
                          var s = ''
                          if ('function' == typeof i) s = i(t.data, o, u)
                          else if ('object' == typeof t.data) {
                            var a = t.data
                            a && a.props && a.props.content && (s = a.props.content)
                          } else s = String(t.data)
                          return new RegExp(n, 'gi').test(s)
                        })
                      })
                    ))
                  : t
                var n, e, r, o, i
              }),
              n(e, [
                {
                  key: 'type',
                  get: function () {
                    return K.Filter
                  },
                },
              ]),
              e
            )
          })(tt)
        function et() {
          var t = 'gridjs'
          return (
            '' +
            t +
            [].slice.call(arguments).reduce(function (t, n) {
              return t + '-' + n
            }, '')
          )
        }
        function rt() {
          return [].slice
            .call(arguments)
            .map(function (t) {
              return t ? t.toString() : ''
            })
            .filter(function (t) {
              return t
            })
            .reduce(function (t, n) {
              return (t || '') + ' ' + n
            }, '')
            .trim()
        }
        var ot,
          it,
          ut,
          st,
          at = /*#__PURE__*/ (function (t) {
            function o() {
              return t.apply(this, arguments) || this
            }
            return (
              r(o, t),
              (o.prototype._process = function (t) {
                if (!this.props.keyword) return t
                var n = {}
                return (
                  this.props.url && (n.url = this.props.url(t.url, this.props.keyword)),
                  this.props.body && (n.body = this.props.body(t.body, this.props.keyword)),
                  e({}, t, n)
                )
              }),
              n(o, [
                {
                  key: 'type',
                  get: function () {
                    return K.ServerFilter
                  },
                },
              ]),
              o
            )
          })(tt),
          lt = 0,
          ct = [],
          ft = [],
          pt = c.__b,
          dt = c.__r,
          ht = c.diffed,
          _t = c.__c,
          mt = c.unmount
        function vt(t, n) {
          c.__h && c.__h(it, t, lt || n), (lt = 0)
          var e = it.__H || (it.__H = { __: [], __h: [] })
          return t >= e.__.length && e.__.push({ __V: ft }), e.__[t]
        }
        function yt(t) {
          return (
            (lt = 1),
            (function (t, n, e) {
              var r = vt(ot++, 2)
              if (
                ((r.t = t),
                !r.__c &&
                  ((r.__ = [
                    Et(void 0, n),
                    function (t) {
                      var n = r.__N ? r.__N[0] : r.__[0],
                        e = r.t(n, t)
                      n !== e && ((r.__N = [e, r.__[1]]), r.__c.setState({}))
                    },
                  ]),
                  (r.__c = it),
                  !it.u))
              ) {
                it.u = !0
                var o = it.shouldComponentUpdate
                it.shouldComponentUpdate = function (t, n, e) {
                  if (!r.__c.__H) return !0
                  var i = r.__c.__H.__.filter(function (t) {
                    return t.__c
                  })
                  if (
                    i.every(function (t) {
                      return !t.__N
                    })
                  )
                    return !o || o.call(this, t, n, e)
                  var u = !1
                  return (
                    i.forEach(function (t) {
                      if (t.__N) {
                        var n = t.__[0]
                        ;(t.__ = t.__N), (t.__N = void 0), n !== t.__[0] && (u = !0)
                      }
                    }),
                    !(!u && r.__c.props === t) && (!o || o.call(this, t, n, e))
                  )
                }
              }
              return r.__N || r.__
            })(Et, t)
          )
        }
        function gt(t, n) {
          var e = vt(ot++, 3)
          !c.__s && Ct(e.__H, n) && ((e.__ = t), (e.i = n), it.__H.__h.push(e))
        }
        function bt(t) {
          return (
            (lt = 5),
            wt(function () {
              return { current: t }
            }, [])
          )
        }
        function wt(t, n) {
          var e = vt(ot++, 7)
          return Ct(e.__H, n) ? ((e.__V = t()), (e.i = n), (e.__h = t), e.__V) : e.__
        }
        function xt() {
          for (var t; (t = ct.shift()); )
            if (t.__P && t.__H)
              try {
                t.__H.__h.forEach(Nt), t.__H.__h.forEach(Pt), (t.__H.__h = [])
              } catch (n) {
                ;(t.__H.__h = []), c.__e(n, t.__v)
              }
        }
        ;(c.__b = function (t) {
          ;(it = null), pt && pt(t)
        }),
          (c.__r = function (t) {
            dt && dt(t), (ot = 0)
            var n = (it = t.__c).__H
            n &&
              (ut === it
                ? ((n.__h = []),
                  (it.__h = []),
                  n.__.forEach(function (t) {
                    t.__N && (t.__ = t.__N), (t.__V = ft), (t.__N = t.i = void 0)
                  }))
                : (n.__h.forEach(Nt), n.__h.forEach(Pt), (n.__h = []))),
              (ut = it)
          }),
          (c.diffed = function (t) {
            ht && ht(t)
            var n = t.__c
            n &&
              n.__H &&
              (n.__H.__h.length &&
                ((1 !== ct.push(n) && st === c.requestAnimationFrame) ||
                  ((st = c.requestAnimationFrame) || St)(xt)),
              n.__H.__.forEach(function (t) {
                t.i && (t.__H = t.i), t.__V !== ft && (t.__ = t.__V), (t.i = void 0), (t.__V = ft)
              })),
              (ut = it = null)
          }),
          (c.__c = function (t, n) {
            n.some(function (t) {
              try {
                t.__h.forEach(Nt),
                  (t.__h = t.__h.filter(function (t) {
                    return !t.__ || Pt(t)
                  }))
              } catch (e) {
                n.some(function (t) {
                  t.__h && (t.__h = [])
                }),
                  (n = []),
                  c.__e(e, t.__v)
              }
            }),
              _t && _t(t, n)
          }),
          (c.unmount = function (t) {
            mt && mt(t)
            var n,
              e = t.__c
            e &&
              e.__H &&
              (e.__H.__.forEach(function (t) {
                try {
                  Nt(t)
                } catch (t) {
                  n = t
                }
              }),
              (e.__H = void 0),
              n && c.__e(n, e.__v))
          })
        var kt = 'function' == typeof requestAnimationFrame
        function St(t) {
          var n,
            e = function () {
              clearTimeout(r), kt && cancelAnimationFrame(n), setTimeout(t)
            },
            r = setTimeout(e, 100)
          kt && (n = requestAnimationFrame(e))
        }
        function Nt(t) {
          var n = it,
            e = t.__c
          'function' == typeof e && ((t.__c = void 0), e()), (it = n)
        }
        function Pt(t) {
          var n = it
          ;(t.__c = t.__()), (it = n)
        }
        function Ct(t, n) {
          return (
            !t ||
            t.length !== n.length ||
            n.some(function (n, e) {
              return n !== t[e]
            })
          )
        }
        function Et(t, n) {
          return 'function' == typeof n ? n(t) : n
        }
        function It() {
          return (function (t) {
            var n = it.context[t.__c],
              e = vt(ot++, 9)
            return (e.c = t), n ? (null == e.__ && ((e.__ = !0), n.sub(it)), n.props.value) : t.__
          })(fn)
        }
        var Tt = {
            search: { placeholder: 'Type a keyword...' },
            sort: { sortAsc: 'Sort column ascending', sortDesc: 'Sort column descending' },
            pagination: {
              previous: 'Previous',
              next: 'Next',
              navigate: function (t, n) {
                return 'Page ' + t + ' of ' + n
              },
              page: function (t) {
                return 'Page ' + t
              },
              showing: 'Showing',
              of: 'of',
              to: 'to',
              results: 'results',
            },
            loading: 'Loading...',
            noRecordsFound: 'No matching records found',
            error: 'An error happened while fetching the data',
          },
          Lt = /*#__PURE__*/ (function () {
            function t(t) {
              ;(this._language = void 0),
                (this._defaultLanguage = void 0),
                (this._language = t),
                (this._defaultLanguage = Tt)
            }
            var n = t.prototype
            return (
              (n.getString = function (t, n) {
                if (!n || !t) return null
                var e = t.split('.'),
                  r = e[0]
                if (n[r]) {
                  var o = n[r]
                  return 'string' == typeof o
                    ? function () {
                        return o
                      }
                    : 'function' == typeof o
                      ? o
                      : this.getString(e.slice(1).join('.'), o)
                }
                return null
              }),
              (n.translate = function (t) {
                var n,
                  e = this.getString(t, this._language)
                return (n = e || this.getString(t, this._defaultLanguage))
                  ? n.apply(void 0, [].slice.call(arguments, 1))
                  : t
              }),
              t
            )
          })()
        function At() {
          var t = It()
          return function (n) {
            var e
            return (e = t.translator).translate.apply(e, [n].concat([].slice.call(arguments, 1)))
          }
        }
        var Ot = function (t) {
          return function (n) {
            return e({}, n, { search: { keyword: t } })
          }
        }
        function Ht() {
          return It().store
        }
        function jt(t) {
          var n = Ht(),
            e = yt(t(n.getState())),
            r = e[0],
            o = e[1]
          return (
            gt(function () {
              return n.subscribe(function () {
                var e = t(n.getState())
                r !== e && o(e)
              })
            }, []),
            r
          )
        }
        function Dt() {
          var t,
            n = yt(void 0),
            e = n[0],
            r = n[1],
            o = It(),
            i = o.search,
            u = At(),
            s = Ht().dispatch,
            a = jt(function (t) {
              return t.search
            })
          gt(
            function () {
              e && e.setProps({ keyword: null == a ? void 0 : a.keyword })
            },
            [a, e]
          ),
            gt(
              function () {
                r(
                  i.server
                    ? new at({ keyword: i.keyword, url: i.server.url, body: i.server.body })
                    : new nt({
                        keyword: i.keyword,
                        columns: o.header && o.header.columns,
                        ignoreHiddenColumns:
                          i.ignoreHiddenColumns || void 0 === i.ignoreHiddenColumns,
                        selector: i.selector,
                      })
                ),
                  i.keyword && s(Ot(i.keyword))
              },
              [i]
            ),
            gt(
              function () {
                if (e)
                  return (
                    o.pipeline.register(e),
                    function () {
                      return o.pipeline.unregister(e)
                    }
                  )
              },
              [o, e]
            )
          var l,
            c,
            f,
            p = (function (t, n) {
              return (
                (lt = 8),
                wt(function () {
                  return t
                }, n)
              )
            })(
              ((l = function (t) {
                t.target instanceof HTMLInputElement && s(Ot(t.target.value))
              }),
              (c = e instanceof at ? i.debounceTimeout || 250 : 0),
              function () {
                var t = arguments
                return new Promise(function (n) {
                  f && clearTimeout(f),
                    (f = setTimeout(function () {
                      return n(l.apply(void 0, [].slice.call(t)))
                    }, c))
                })
              }),
              [i, e]
            )
          return w(
            'div',
            { className: et(rt('search', null == (t = o.className) ? void 0 : t.search)) },
            w('input', {
              'type': 'search',
              'placeholder': u('search.placeholder'),
              'aria-label': u('search.placeholder'),
              'onInput': p,
              'className': rt(et('input'), et('search', 'input')),
              'defaultValue': (null == a ? void 0 : a.keyword) || '',
            })
          )
        }
        var Mt = /*#__PURE__*/ (function (t) {
            function e() {
              return t.apply(this, arguments) || this
            }
            r(e, t)
            var o = e.prototype
            return (
              (o.validateProps = function () {
                if (isNaN(Number(this.props.limit)) || isNaN(Number(this.props.page)))
                  throw Error('Invalid parameters passed')
              }),
              (o._process = function (t) {
                var n = this.props.page
                return new J(t.rows.slice(n * this.props.limit, (n + 1) * this.props.limit))
              }),
              n(e, [
                {
                  key: 'type',
                  get: function () {
                    return K.Limit
                  },
                },
              ]),
              e
            )
          })(tt),
          Ft = /*#__PURE__*/ (function (t) {
            function o() {
              return t.apply(this, arguments) || this
            }
            return (
              r(o, t),
              (o.prototype._process = function (t) {
                var n = {}
                return (
                  this.props.url &&
                    (n.url = this.props.url(t.url, this.props.page, this.props.limit)),
                  this.props.body &&
                    (n.body = this.props.body(t.body, this.props.page, this.props.limit)),
                  e({}, t, n)
                )
              }),
              n(o, [
                {
                  key: 'type',
                  get: function () {
                    return K.ServerLimit
                  },
                },
              ]),
              o
            )
          })(tt)
        function Rt() {
          var t = It(),
            n = t.pagination,
            e = n.server,
            r = n.summary,
            o = void 0 === r || r,
            i = n.nextButton,
            u = void 0 === i || i,
            s = n.prevButton,
            a = void 0 === s || s,
            l = n.buttonsCount,
            c = void 0 === l ? 3 : l,
            f = n.limit,
            p = void 0 === f ? 10 : f,
            d = n.page,
            h = void 0 === d ? 0 : d,
            _ = n.resetPageOnUpdate,
            m = void 0 === _ || _,
            v = bt(null),
            y = yt(h),
            g = y[0],
            b = y[1],
            x = yt(0),
            k = x[0],
            N = x[1],
            P = At()
          gt(function () {
            return (
              e
                ? ((v.current = new Ft({ limit: p, page: g, url: e.url, body: e.body })),
                  t.pipeline.register(v.current))
                : ((v.current = new Mt({ limit: p, page: g })), t.pipeline.register(v.current)),
              v.current instanceof Ft
                ? t.pipeline.on('afterProcess', function (t) {
                    return N(t.length)
                  })
                : v.current instanceof Mt &&
                  v.current.on('beforeProcess', function (t) {
                    return N(t.length)
                  }),
              t.pipeline.on('updated', C),
              t.pipeline.on('error', function () {
                N(0), b(0)
              }),
              function () {
                t.pipeline.unregister(v.current), t.pipeline.off('updated', C)
              }
            )
          }, [])
          var C = function (t) {
              m &&
                t !== v.current &&
                (b(0), 0 !== v.current.props.page && v.current.setProps({ page: 0 }))
            },
            E = function () {
              return Math.ceil(k / p)
            },
            I = function (t) {
              if (t >= E() || t < 0 || t === g) return null
              b(t), v.current.setProps({ page: t })
            }
          return w(
            'div',
            { className: rt(et('pagination'), t.className.pagination) },
            w(
              S,
              null,
              o &&
                k > 0 &&
                w(
                  'div',
                  {
                    'role': 'status',
                    'aria-live': 'polite',
                    'className': rt(et('summary'), t.className.paginationSummary),
                    'title': P('pagination.navigate', g + 1, E()),
                  },
                  P('pagination.showing'),
                  ' ',
                  w('b', null, P('' + (g * p + 1))),
                  ' ',
                  P('pagination.to'),
                  ' ',
                  w('b', null, P('' + Math.min((g + 1) * p, k))),
                  ' ',
                  P('pagination.of'),
                  ' ',
                  w('b', null, P('' + k)),
                  ' ',
                  P('pagination.results')
                )
            ),
            w(
              'div',
              { className: et('pages') },
              a &&
                w(
                  'button',
                  {
                    'tabIndex': 0,
                    'role': 'button',
                    'disabled': 0 === g,
                    'onClick': function () {
                      return I(g - 1)
                    },
                    'title': P('pagination.previous'),
                    'aria-label': P('pagination.previous'),
                    'className': rt(t.className.paginationButton, t.className.paginationButtonPrev),
                  },
                  P('pagination.previous')
                ),
              (function () {
                if (c <= 0) return null
                var n = Math.min(E(), c),
                  e = Math.min(g, Math.floor(n / 2))
                return (
                  g + Math.floor(n / 2) >= E() && (e = n - (E() - g)),
                  w(
                    S,
                    null,
                    E() > n &&
                      g - e > 0 &&
                      w(
                        S,
                        null,
                        w(
                          'button',
                          {
                            'tabIndex': 0,
                            'role': 'button',
                            'onClick': function () {
                              return I(0)
                            },
                            'title': P('pagination.firstPage'),
                            'aria-label': P('pagination.firstPage'),
                            'className': t.className.paginationButton,
                          },
                          P('1')
                        ),
                        w(
                          'button',
                          {
                            tabIndex: -1,
                            className: rt(et('spread'), t.className.paginationButton),
                          },
                          '...'
                        )
                      ),
                    Array.from(Array(n).keys())
                      .map(function (t) {
                        return g + (t - e)
                      })
                      .map(function (n) {
                        return w(
                          'button',
                          {
                            'tabIndex': 0,
                            'role': 'button',
                            'onClick': function () {
                              return I(n)
                            },
                            'className': rt(
                              g === n
                                ? rt(et('currentPage'), t.className.paginationButtonCurrent)
                                : null,
                              t.className.paginationButton
                            ),
                            'title': P('pagination.page', n + 1),
                            'aria-label': P('pagination.page', n + 1),
                          },
                          P('' + (n + 1))
                        )
                      }),
                    E() > n &&
                      E() > g + e + 1 &&
                      w(
                        S,
                        null,
                        w(
                          'button',
                          {
                            tabIndex: -1,
                            className: rt(et('spread'), t.className.paginationButton),
                          },
                          '...'
                        ),
                        w(
                          'button',
                          {
                            'tabIndex': 0,
                            'role': 'button',
                            'onClick': function () {
                              return I(E() - 1)
                            },
                            'title': P('pagination.page', E()),
                            'aria-label': P('pagination.page', E()),
                            'className': t.className.paginationButton,
                          },
                          P('' + E())
                        )
                      )
                  )
                )
              })(),
              u &&
                w(
                  'button',
                  {
                    'tabIndex': 0,
                    'role': 'button',
                    'disabled': E() === g + 1 || 0 === E(),
                    'onClick': function () {
                      return I(g + 1)
                    },
                    'title': P('pagination.next'),
                    'aria-label': P('pagination.next'),
                    'className': rt(t.className.paginationButton, t.className.paginationButtonNext),
                  },
                  P('pagination.next')
                )
            )
          )
        }
        function Ut(t, n) {
          return 'string' == typeof t
            ? t.indexOf('%') > -1
              ? (n / 100) * parseInt(t, 10)
              : parseInt(t, 10)
            : t
        }
        function Wt(t) {
          return t ? Math.floor(t) + 'px' : ''
        }
        function Bt(t) {
          var n = t.tableRef.cloneNode(!0)
          return (
            (n.style.position = 'absolute'),
            (n.style.width = '100%'),
            (n.style.zIndex = '-2147483640'),
            (n.style.visibility = 'hidden'),
            w('div', {
              ref: function (t) {
                t && t.appendChild(n)
              },
            })
          )
        }
        function qt(t) {
          if (!t) return ''
          var n = t.split(' ')
          return 1 === n.length && /([a-z][A-Z])+/g.test(t)
            ? t
            : n
                .map(function (t, n) {
                  return 0 == n
                    ? t.toLowerCase()
                    : t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
                })
                .join('')
        }
        var zt,
          Vt = new /*#__PURE__*/ ((function () {
            function t() {}
            var n = t.prototype
            return (
              (n.format = function (t, n) {
                return '[Grid.js] [' + n.toUpperCase() + ']: ' + t
              }),
              (n.error = function (t, n) {
                void 0 === n && (n = !1)
                var e = this.format(t, 'error')
                if (n) throw Error(e)
                console.error(e)
              }),
              (n.warn = function (t) {
                console.warn(this.format(t, 'warn'))
              }),
              (n.info = function (t) {
                console.info(this.format(t, 'info'))
              }),
              t
            )
          })())()
        !(function (t) {
          ;(t[(t.Header = 0)] = 'Header'),
            (t[(t.Footer = 1)] = 'Footer'),
            (t[(t.Cell = 2)] = 'Cell')
        })(zt || (zt = {}))
        var $t = /*#__PURE__*/ (function () {
          function t() {
            ;(this.plugins = void 0), (this.plugins = [])
          }
          var n = t.prototype
          return (
            (n.get = function (t) {
              return this.plugins.find(function (n) {
                return n.id === t
              })
            }),
            (n.add = function (t) {
              return t.id
                ? this.get(t.id)
                  ? (Vt.error('Duplicate plugin ID: ' + t.id), this)
                  : (this.plugins.push(t), this)
                : (Vt.error('Plugin ID cannot be empty'), this)
            }),
            (n.remove = function (t) {
              var n = this.get(t)
              return n && this.plugins.splice(this.plugins.indexOf(n), 1), this
            }),
            (n.list = function (t) {
              var n
              return (
                (n =
                  null != t || null != t
                    ? this.plugins.filter(function (n) {
                        return n.position === t
                      })
                    : this.plugins),
                n.sort(function (t, n) {
                  return t.order && n.order ? t.order - n.order : 1
                })
              )
            }),
            t
          )
        })()
        function Gt(t) {
          var n = this,
            r = It()
          if (t.pluginId) {
            var o = r.plugin.get(t.pluginId)
            return o ? w(S, {}, w(o.component, e({ plugin: o }, t.props))) : null
          }
          return void 0 !== t.position
            ? w(
                S,
                {},
                r.plugin.list(t.position).map(function (t) {
                  return w(t.component, e({ plugin: t }, n.props.props))
                })
              )
            : null
        }
        var Kt = /*#__PURE__*/ (function (t) {
            function o() {
              var n
              return ((n = t.call(this) || this)._columns = void 0), (n._columns = []), n
            }
            r(o, t)
            var i = o.prototype
            return (
              (i.adjustWidth = function (t, n, r) {
                var i = t.container,
                  u = t.autoWidth
                if (!i) return this
                var a = i.clientWidth,
                  l = {}
                n.current &&
                  u &&
                  (q(w(Bt, { tableRef: n.current }), r.current),
                  (l = (function (t) {
                    var n = t.querySelector('table')
                    if (!n) return {}
                    var r = n.className,
                      o = n.style.cssText
                    ;(n.className = r + ' ' + et('shadowTable')),
                      (n.style.tableLayout = 'auto'),
                      (n.style.width = 'auto'),
                      (n.style.padding = '0'),
                      (n.style.margin = '0'),
                      (n.style.border = 'none'),
                      (n.style.outline = 'none')
                    var i = Array.from(n.parentNode.querySelectorAll('thead th')).reduce(function (
                      t,
                      n
                    ) {
                      var r
                      return (
                        (n.style.width = n.clientWidth + 'px'),
                        e(
                          (((r = {})[n.getAttribute('data-column-id')] = {
                            minWidth: n.clientWidth,
                          }),
                          r),
                          t
                        )
                      )
                    }, {})
                    return (
                      (n.className = r),
                      (n.style.cssText = o),
                      (n.style.tableLayout = 'auto'),
                      Array.from(n.parentNode.querySelectorAll('thead th')).reduce(function (t, n) {
                        return (t[n.getAttribute('data-column-id')].width = n.clientWidth), t
                      }, i)
                    )
                  })(r.current)))
                for (
                  var c,
                    f = s(
                      o.tabularFormat(this.columns).reduce(function (t, n) {
                        return t.concat(n)
                      }, [])
                    );
                  !(c = f()).done;

                ) {
                  var p = c.value
                  ;(p.columns && p.columns.length > 0) ||
                    (!p.width && u
                      ? p.id in l &&
                        ((p.width = Wt(l[p.id].width)), (p.minWidth = Wt(l[p.id].minWidth)))
                      : (p.width = Wt(Ut(p.width, a))))
                }
                return n.current && u && q(null, r.current), this
              }),
              (i.setSort = function (t, n) {
                for (var r, o = s(n || this.columns || []); !(r = o()).done; ) {
                  var i = r.value
                  i.columns && i.columns.length > 0
                    ? (i.sort = void 0)
                    : void 0 === i.sort && t
                      ? (i.sort = {})
                      : i.sort
                        ? 'object' == typeof i.sort && (i.sort = e({}, i.sort))
                        : (i.sort = void 0),
                    i.columns && this.setSort(t, i.columns)
                }
              }),
              (i.setResizable = function (t, n) {
                for (var e, r = s(n || this.columns || []); !(e = r()).done; ) {
                  var o = e.value
                  void 0 === o.resizable && (o.resizable = t),
                    o.columns && this.setResizable(t, o.columns)
                }
              }),
              (i.setID = function (t) {
                for (var n, e = s(t || this.columns || []); !(n = e()).done; ) {
                  var r = n.value
                  r.id || 'string' != typeof r.name || (r.id = qt(r.name)),
                    r.id ||
                      Vt.error(
                        'Could not find a valid ID for one of the columns. Make sure a valid "id" is set for all columns.'
                      ),
                    r.columns && this.setID(r.columns)
                }
              }),
              (i.populatePlugins = function (t, n) {
                for (var r, o = s(n); !(r = o()).done; ) {
                  var i = r.value
                  void 0 !== i.plugin && t.add(e({ id: i.id }, i.plugin, { position: zt.Cell }))
                }
              }),
              (o.fromColumns = function (t) {
                for (var n, e = new o(), r = s(t); !(n = r()).done; ) {
                  var i = n.value
                  if ('string' == typeof i || p(i)) e.columns.push({ name: i })
                  else if ('object' == typeof i) {
                    var u = i
                    u.columns && (u.columns = o.fromColumns(u.columns).columns),
                      'object' == typeof u.plugin && void 0 === u.data && (u.data = null),
                      e.columns.push(i)
                  }
                }
                return e
              }),
              (o.createFromConfig = function (t) {
                var n = new o()
                return (
                  t.from
                    ? (n.columns = o.fromHTMLTable(t.from).columns)
                    : t.columns
                      ? (n.columns = o.fromColumns(t.columns).columns)
                      : !t.data ||
                        'object' != typeof t.data[0] ||
                        t.data[0] instanceof Array ||
                        (n.columns = Object.keys(t.data[0]).map(function (t) {
                          return { name: t }
                        })),
                  n.columns.length
                    ? (n.setID(),
                      n.setSort(t.sort),
                      n.setResizable(t.resizable),
                      n.populatePlugins(t.plugin, n.columns),
                      n)
                    : null
                )
              }),
              (o.fromHTMLTable = function (t) {
                for (
                  var n, e = new o(), r = s(t.querySelector('thead').querySelectorAll('th'));
                  !(n = r()).done;

                ) {
                  var i = n.value
                  e.columns.push({ name: i.innerHTML, width: i.width })
                }
                return e
              }),
              (o.tabularFormat = function (t) {
                var n = [],
                  e = t || [],
                  r = []
                if (e && e.length) {
                  n.push(e)
                  for (var o, i = s(e); !(o = i()).done; ) {
                    var u = o.value
                    u.columns && u.columns.length && (r = r.concat(u.columns))
                  }
                  r.length && (n = n.concat(this.tabularFormat(r)))
                }
                return n
              }),
              (o.leafColumns = function (t) {
                var n = [],
                  e = t || []
                if (e && e.length)
                  for (var r, o = s(e); !(r = o()).done; ) {
                    var i = r.value
                    ;(i.columns && 0 !== i.columns.length) || n.push(i),
                      i.columns && (n = n.concat(this.leafColumns(i.columns)))
                  }
                return n
              }),
              (o.maximumDepth = function (t) {
                return this.tabularFormat([t]).length - 1
              }),
              n(o, [
                {
                  key: 'columns',
                  get: function () {
                    return this._columns
                  },
                  set: function (t) {
                    this._columns = t
                  },
                },
                {
                  key: 'visibleColumns',
                  get: function () {
                    return this._columns.filter(function (t) {
                      return !t.hidden
                    })
                  },
                },
              ]),
              o
            )
          })(V),
          Xt = function () {},
          Zt = /*#__PURE__*/ (function (t) {
            function n(n) {
              var e
              return ((e = t.call(this) || this).data = void 0), e.set(n), e
            }
            r(n, t)
            var e = n.prototype
            return (
              (e.get = function () {
                try {
                  return Promise.resolve(this.data()).then(function (t) {
                    return { data: t, total: t.length }
                  })
                } catch (t) {
                  return Promise.reject(t)
                }
              }),
              (e.set = function (t) {
                return (
                  t instanceof Array
                    ? (this.data = function () {
                        return t
                      })
                    : t instanceof Function && (this.data = t),
                  this
                )
              }),
              n
            )
          })(Xt),
          Jt = /*#__PURE__*/ (function (t) {
            function n(n) {
              var e
              return ((e = t.call(this) || this).options = void 0), (e.options = n), e
            }
            r(n, t)
            var o = n.prototype
            return (
              (o.handler = function (t) {
                return 'function' == typeof this.options.handle
                  ? this.options.handle(t)
                  : t.ok
                    ? t.json()
                    : (Vt.error('Could not fetch data: ' + t.status + ' - ' + t.statusText, !0),
                      null)
              }),
              (o.get = function (t) {
                var n = e({}, this.options, t)
                return 'function' == typeof n.data
                  ? n.data(n)
                  : fetch(n.url, n)
                      .then(this.handler.bind(this))
                      .then(function (t) {
                        return {
                          data: n.then(t),
                          total: 'function' == typeof n.total ? n.total(t) : void 0,
                        }
                      })
              }),
              n
            )
          })(Xt),
          Qt = /*#__PURE__*/ (function () {
            function t() {}
            return (
              (t.createFromConfig = function (t) {
                var n = null
                return (
                  t.data && (n = new Zt(t.data)),
                  t.from &&
                    ((n = new Zt(this.tableElementToArray(t.from))),
                    (t.from.style.display = 'none')),
                  t.server && (n = new Jt(t.server)),
                  n || Vt.error('Could not determine the storage type', !0),
                  n
                )
              }),
              (t.tableElementToArray = function (t) {
                for (
                  var n, e, r = [], o = s(t.querySelector('tbody').querySelectorAll('tr'));
                  !(n = o()).done;

                ) {
                  for (var i, u = [], a = s(n.value.querySelectorAll('td')); !(i = a()).done; ) {
                    var l = i.value
                    1 === l.childNodes.length && l.childNodes[0].nodeType === Node.TEXT_NODE
                      ? u.push(
                          ((e = l.innerHTML),
                          new DOMParser().parseFromString(e, 'text/html').documentElement
                            .textContent)
                        )
                      : u.push(G(l.innerHTML))
                  }
                  r.push(u)
                }
                return r
              }),
              t
            )
          })(),
          Yt =
            'undefined' != typeof Symbol
              ? Symbol.iterator || (Symbol.iterator = Symbol('Symbol.iterator'))
              : '@@iterator'
        function tn(t, n, e) {
          if (!t.s) {
            if (e instanceof nn) {
              if (!e.s) return void (e.o = tn.bind(null, t, n))
              1 & n && (n = e.s), (e = e.v)
            }
            if (e && e.then) return void e.then(tn.bind(null, t, n), tn.bind(null, t, 2))
            ;(t.s = n), (t.v = e)
            var r = t.o
            r && r(t)
          }
        }
        var nn = /*#__PURE__*/ (function () {
          function t() {}
          return (
            (t.prototype.then = function (n, e) {
              var r = new t(),
                o = this.s
              if (o) {
                var i = 1 & o ? n : e
                if (i) {
                  try {
                    tn(r, 1, i(this.v))
                  } catch (t) {
                    tn(r, 2, t)
                  }
                  return r
                }
                return this
              }
              return (
                (this.o = function (t) {
                  try {
                    var o = t.v
                    1 & t.s ? tn(r, 1, n ? n(o) : o) : e ? tn(r, 1, e(o)) : tn(r, 2, o)
                  } catch (t) {
                    tn(r, 2, t)
                  }
                }),
                r
              )
            }),
            t
          )
        })()
        function en(t) {
          return t instanceof nn && 1 & t.s
        }
        var rn = /*#__PURE__*/ (function (t) {
            function e(n) {
              var e
              return (
                ((e = t.call(this) || this)._steps = new Map()),
                (e.cache = new Map()),
                (e.lastProcessorIndexUpdated = -1),
                n &&
                  n.forEach(function (t) {
                    return e.register(t)
                  }),
                e
              )
            }
            r(e, t)
            var o = e.prototype
            return (
              (o.clearCache = function () {
                ;(this.cache = new Map()), (this.lastProcessorIndexUpdated = -1)
              }),
              (o.register = function (t, n) {
                if ((void 0 === n && (n = null), !t)) throw Error('Processor is not defined')
                if (null === t.type) throw Error('Processor type is not defined')
                if (this.findProcessorIndexByID(t.id) > -1)
                  throw Error('Processor ID ' + t.id + ' is already defined')
                return (
                  t.on('propsUpdated', this.processorPropsUpdated.bind(this)),
                  this.addProcessorByPriority(t, n),
                  this.afterRegistered(t),
                  t
                )
              }),
              (o.tryRegister = function (t, n) {
                void 0 === n && (n = null)
                try {
                  return this.register(t, n)
                } catch (t) {}
              }),
              (o.unregister = function (t) {
                if (t && -1 !== this.findProcessorIndexByID(t.id)) {
                  var n = this._steps.get(t.type)
                  n &&
                    n.length &&
                    (this._steps.set(
                      t.type,
                      n.filter(function (n) {
                        return n != t
                      })
                    ),
                    this.emit('updated', t))
                }
              }),
              (o.addProcessorByPriority = function (t, n) {
                var e = this._steps.get(t.type)
                if (!e) {
                  var r = []
                  this._steps.set(t.type, r), (e = r)
                }
                if (null === n || n < 0) e.push(t)
                else if (e[n]) {
                  var o = e.slice(0, n - 1),
                    i = e.slice(n + 1)
                  this._steps.set(t.type, o.concat(t).concat(i))
                } else e[n] = t
              }),
              (o.getStepsByType = function (t) {
                return this.steps.filter(function (n) {
                  return n.type === t
                })
              }),
              (o.getSortedProcessorTypes = function () {
                return Object.keys(K)
                  .filter(function (t) {
                    return !isNaN(Number(t))
                  })
                  .map(function (t) {
                    return Number(t)
                  })
              }),
              (o.process = function (t) {
                try {
                  var n = function (t) {
                      return (e.lastProcessorIndexUpdated = o.length), e.emit('afterProcess', i), i
                    },
                    e = this,
                    r = e.lastProcessorIndexUpdated,
                    o = e.steps,
                    i = t,
                    u = (function (t, n) {
                      try {
                        var u = (function (t, n, e) {
                          if ('function' == typeof t[Yt]) {
                            var r,
                              o,
                              i,
                              u = t[Yt]()
                            if (
                              ((function t(e) {
                                try {
                                  for (; !(r = u.next()).done; )
                                    if ((e = n(r.value)) && e.then) {
                                      if (!en(e))
                                        return void e.then(
                                          t,
                                          i || (i = tn.bind(null, (o = new nn()), 2))
                                        )
                                      e = e.v
                                    }
                                  o ? tn(o, 1, e) : (o = e)
                                } catch (t) {
                                  tn(o || (o = new nn()), 2, t)
                                }
                              })(),
                              u.return)
                            ) {
                              var s = function (t) {
                                try {
                                  r.done || u.return()
                                } catch (t) {}
                                return t
                              }
                              if (o && o.then)
                                return o.then(s, function (t) {
                                  throw s(t)
                                })
                              s()
                            }
                            return o
                          }
                          if (!('length' in t)) throw new TypeError('Object is not iterable')
                          for (var a = [], l = 0; l < t.length; l++) a.push(t[l])
                          return (function (t, n, e) {
                            var r,
                              o,
                              i = -1
                            return (
                              (function e(u) {
                                try {
                                  for (; ++i < t.length; )
                                    if ((u = n(i)) && u.then) {
                                      if (!en(u))
                                        return void u.then(
                                          e,
                                          o || (o = tn.bind(null, (r = new nn()), 2))
                                        )
                                      u = u.v
                                    }
                                  r ? tn(r, 1, u) : (r = u)
                                } catch (t) {
                                  tn(r || (r = new nn()), 2, t)
                                }
                              })(),
                              r
                            )
                          })(a, function (t) {
                            return n(a[t])
                          })
                        })(o, function (t) {
                          var n = e.findProcessorIndexByID(t.id),
                            o = (function () {
                              if (n >= r)
                                return Promise.resolve(t.process(i)).then(function (n) {
                                  e.cache.set(t.id, (i = n))
                                })
                              i = e.cache.get(t.id)
                            })()
                          if (o && o.then) return o.then(function () {})
                        })
                      } catch (t) {
                        return n(t)
                      }
                      return u && u.then ? u.then(void 0, n) : u
                    })(0, function (t) {
                      throw (Vt.error(t), e.emit('error', i), t)
                    })
                  return Promise.resolve(u && u.then ? u.then(n) : n())
                } catch (t) {
                  return Promise.reject(t)
                }
              }),
              (o.findProcessorIndexByID = function (t) {
                return this.steps.findIndex(function (n) {
                  return n.id == t
                })
              }),
              (o.setLastProcessorIndex = function (t) {
                var n = this.findProcessorIndexByID(t.id)
                this.lastProcessorIndexUpdated > n && (this.lastProcessorIndexUpdated = n)
              }),
              (o.processorPropsUpdated = function (t) {
                this.setLastProcessorIndex(t), this.emit('propsUpdated'), this.emit('updated', t)
              }),
              (o.afterRegistered = function (t) {
                this.setLastProcessorIndex(t), this.emit('afterRegister'), this.emit('updated', t)
              }),
              n(e, [
                {
                  key: 'steps',
                  get: function () {
                    for (var t, n = [], e = s(this.getSortedProcessorTypes()); !(t = e()).done; ) {
                      var r = this._steps.get(t.value)
                      r && r.length && (n = n.concat(r))
                    }
                    return n.filter(function (t) {
                      return t
                    })
                  },
                },
              ]),
              e
            )
          })(Q),
          on = /*#__PURE__*/ (function (t) {
            function e() {
              return t.apply(this, arguments) || this
            }
            return (
              r(e, t),
              (e.prototype._process = function (t) {
                try {
                  return Promise.resolve(this.props.storage.get(t))
                } catch (t) {
                  return Promise.reject(t)
                }
              }),
              n(e, [
                {
                  key: 'type',
                  get: function () {
                    return K.Extractor
                  },
                },
              ]),
              e
            )
          })(tt),
          un = /*#__PURE__*/ (function (t) {
            function e() {
              return t.apply(this, arguments) || this
            }
            return (
              r(e, t),
              (e.prototype._process = function (t) {
                var n = J.fromArray(t.data)
                return (n.length = t.total), n
              }),
              n(e, [
                {
                  key: 'type',
                  get: function () {
                    return K.Transformer
                  },
                },
              ]),
              e
            )
          })(tt),
          sn = /*#__PURE__*/ (function (t) {
            function o() {
              return t.apply(this, arguments) || this
            }
            return (
              r(o, t),
              (o.prototype._process = function () {
                return Object.entries(this.props.serverStorageOptions)
                  .filter(function (t) {
                    return 'function' != typeof t[1]
                  })
                  .reduce(function (t, n) {
                    var r
                    return e({}, t, (((r = {})[n[0]] = n[1]), r))
                  }, {})
              }),
              n(o, [
                {
                  key: 'type',
                  get: function () {
                    return K.Initiator
                  },
                },
              ]),
              o
            )
          })(tt),
          an = /*#__PURE__*/ (function (t) {
            function e() {
              return t.apply(this, arguments) || this
            }
            r(e, t)
            var o = e.prototype
            return (
              (o.castData = function (t) {
                if (!t || !t.length) return []
                if (!this.props.header || !this.props.header.columns) return t
                var n = Kt.leafColumns(this.props.header.columns)
                return t[0] instanceof Array
                  ? t.map(function (t) {
                      var e = 0
                      return n.map(function (n, r) {
                        return void 0 !== n.data
                          ? (e++, 'function' == typeof n.data ? n.data(t) : n.data)
                          : t[r - e]
                      })
                    })
                  : 'object' != typeof t[0] || t[0] instanceof Array
                    ? []
                    : t.map(function (t) {
                        return n.map(function (n, e) {
                          return void 0 !== n.data
                            ? 'function' == typeof n.data
                              ? n.data(t)
                              : n.data
                            : n.id
                              ? t[n.id]
                              : (Vt.error(
                                  'Could not find the correct cell for column at position ' +
                                    e +
                                    ".\n                          Make sure either 'id' or 'selector' is defined for all columns."
                                ),
                                null)
                        })
                      })
              }),
              (o._process = function (t) {
                return { data: this.castData(t.data), total: t.total }
              }),
              n(e, [
                {
                  key: 'type',
                  get: function () {
                    return K.Transformer
                  },
                },
              ]),
              e
            )
          })(tt),
          ln = /*#__PURE__*/ (function () {
            function t() {}
            return (
              (t.createFromConfig = function (t) {
                var n = new rn()
                return (
                  t.storage instanceof Jt && n.register(new sn({ serverStorageOptions: t.server })),
                  n.register(new on({ storage: t.storage })),
                  n.register(new an({ header: t.header })),
                  n.register(new un()),
                  n
                )
              }),
              t
            )
          })(),
          cn = function (t) {
            var n = this
            ;(this.state = void 0),
              (this.listeners = []),
              (this.isDispatching = !1),
              (this.getState = function () {
                return n.state
              }),
              (this.getListeners = function () {
                return n.listeners
              }),
              (this.dispatch = function (t) {
                if ('function' != typeof t) throw new Error('Reducer is not a function')
                if (n.isDispatching) throw new Error('Reducers may not dispatch actions')
                n.isDispatching = !0
                var e = n.state
                try {
                  n.state = t(n.state)
                } finally {
                  n.isDispatching = !1
                }
                for (var r, o = s(n.listeners); !(r = o()).done; ) (0, r.value)(n.state, e)
                return n.state
              }),
              (this.subscribe = function (t) {
                if ('function' != typeof t) throw new Error('Listener is not a function')
                return (
                  (n.listeners = [].concat(n.listeners, [t])),
                  function () {
                    return (n.listeners = n.listeners.filter(function (n) {
                      return n !== t
                    }))
                  }
                )
              }),
              (this.state = t)
          },
          fn = (function (t, n) {
            var e = {
              __c: (n = '__cC' + _++),
              __: null,
              Consumer: function (t, n) {
                return t.children(n)
              },
              Provider: function (t) {
                var e, r
                return (
                  this.getChildContext ||
                    ((e = []),
                    ((r = {})[n] = this),
                    (this.getChildContext = function () {
                      return r
                    }),
                    (this.shouldComponentUpdate = function (t) {
                      this.props.value !== t.value && e.some(E)
                    }),
                    (this.sub = function (t) {
                      e.push(t)
                      var n = t.componentWillUnmount
                      t.componentWillUnmount = function () {
                        e.splice(e.indexOf(t), 1), n && n.call(t)
                      }
                    })),
                  t.children
                )
              },
            }
            return (e.Provider.__ = e.Consumer.contextType = e)
          })(),
          pn = /*#__PURE__*/ (function () {
            function t() {
              Object.assign(this, t.defaultConfig())
            }
            var n = t.prototype
            return (
              (n.assign = function (t) {
                return Object.assign(this, t)
              }),
              (n.update = function (n) {
                return n ? (this.assign(t.fromPartialConfig(e({}, this, n))), this) : this
              }),
              (t.defaultConfig = function () {
                return {
                  store: new cn({ status: a.Init, header: void 0, data: null }),
                  plugin: new $t(),
                  tableRef: { current: null },
                  width: '100%',
                  height: 'auto',
                  processingThrottleMs: 100,
                  autoWidth: !0,
                  style: {},
                  className: {},
                }
              }),
              (t.fromPartialConfig = function (n) {
                var e = new t().assign(n)
                return (
                  'boolean' == typeof n.sort && n.sort && e.assign({ sort: { multiColumn: !0 } }),
                  e.assign({ header: Kt.createFromConfig(e) }),
                  e.assign({ storage: Qt.createFromConfig(e) }),
                  e.assign({ pipeline: ln.createFromConfig(e) }),
                  e.assign({ translator: new Lt(e.language) }),
                  (e.plugin = new $t()),
                  e.search && e.plugin.add({ id: 'search', position: zt.Header, component: Dt }),
                  e.pagination &&
                    e.plugin.add({ id: 'pagination', position: zt.Footer, component: Rt }),
                  e.plugins &&
                    e.plugins.forEach(function (t) {
                      return e.plugin.add(t)
                    }),
                  e
                )
              }),
              t
            )
          })()
        function dn(t) {
          var n,
            r = It()
          return w(
            'td',
            e(
              {
                'role': t.role,
                'colSpan': t.colSpan,
                'data-column-id': t.column && t.column.id,
                'className': rt(et('td'), t.className, r.className.td),
                'style': e({}, t.style, r.style.td),
                'onClick': function (n) {
                  t.messageCell || r.eventEmitter.emit('cellClick', n, t.cell, t.column, t.row)
                },
              },
              (n = t.column)
                ? 'function' == typeof n.attributes
                  ? n.attributes(t.cell.data, t.row, t.column)
                  : n.attributes
                : {}
            ),
            t.column && 'function' == typeof t.column.formatter
              ? t.column.formatter(t.cell.data, t.row, t.column)
              : t.column && t.column.plugin
                ? w(Gt, {
                    pluginId: t.column.id,
                    props: { column: t.column, cell: t.cell, row: t.row },
                  })
                : t.cell.data
          )
        }
        function hn(t) {
          var n = It(),
            e = jt(function (t) {
              return t.header
            })
          return w(
            'tr',
            {
              className: rt(et('tr'), n.className.tr),
              onClick: function (e) {
                t.messageRow || n.eventEmitter.emit('rowClick', e, t.row)
              },
            },
            t.children
              ? t.children
              : t.row.cells.map(function (n, r) {
                  var o = (function (t) {
                    if (e) {
                      var n = Kt.leafColumns(e.columns)
                      if (n) return n[t]
                    }
                    return null
                  })(r)
                  return o && o.hidden ? null : w(dn, { key: n.id, cell: n, row: t.row, column: o })
                })
          )
        }
        function _n(t) {
          return w(
            hn,
            { messageRow: !0 },
            w(dn, {
              role: 'alert',
              colSpan: t.colSpan,
              messageCell: !0,
              cell: new X(t.message),
              className: rt(et('message'), t.className ? t.className : null),
            })
          )
        }
        function mn() {
          var t = It(),
            n = jt(function (t) {
              return t.data
            }),
            e = jt(function (t) {
              return t.status
            }),
            r = jt(function (t) {
              return t.header
            }),
            o = At(),
            i = function () {
              return r ? r.visibleColumns.length : 0
            }
          return w(
            'tbody',
            { className: rt(et('tbody'), t.className.tbody) },
            n &&
              n.rows.map(function (t) {
                return w(hn, { key: t.id, row: t })
              }),
            e === a.Loading &&
              (!n || 0 === n.length) &&
              w(_n, {
                message: o('loading'),
                colSpan: i(),
                className: rt(et('loading'), t.className.loading),
              }),
            e === a.Rendered &&
              n &&
              0 === n.length &&
              w(_n, {
                message: o('noRecordsFound'),
                colSpan: i(),
                className: rt(et('notfound'), t.className.notfound),
              }),
            e === a.Error &&
              w(_n, {
                message: o('error'),
                colSpan: i(),
                className: rt(et('error'), t.className.error),
              })
          )
        }
        var vn = /*#__PURE__*/ (function (t) {
            function e() {
              return t.apply(this, arguments) || this
            }
            r(e, t)
            var o = e.prototype
            return (
              (o.validateProps = function () {
                for (var t, n = s(this.props.columns); !(t = n()).done; ) {
                  var e = t.value
                  void 0 === e.direction && (e.direction = 1),
                    1 !== e.direction &&
                      -1 !== e.direction &&
                      Vt.error('Invalid sort direction ' + e.direction)
                }
              }),
              (o.compare = function (t, n) {
                return t > n ? 1 : t < n ? -1 : 0
              }),
              (o.compareWrapper = function (t, n) {
                for (var e, r = 0, o = s(this.props.columns); !(e = o()).done; ) {
                  var i = e.value
                  if (0 !== r) break
                  var u = t.cells[i.index].data,
                    a = n.cells[i.index].data
                  r |=
                    'function' == typeof i.compare
                      ? i.compare(u, a) * i.direction
                      : this.compare(u, a) * i.direction
                }
                return r
              }),
              (o._process = function (t) {
                var n = [].concat(t.rows)
                n.sort(this.compareWrapper.bind(this))
                var e = new J(n)
                return (e.length = t.length), e
              }),
              n(e, [
                {
                  key: 'type',
                  get: function () {
                    return K.Sort
                  },
                },
              ]),
              e
            )
          })(tt),
          yn = function (t, n, r, o) {
            return function (i) {
              var u,
                s =
                  null != (u = i.sort) && u.columns
                    ? i.sort.columns.map(function (t) {
                        return e({}, t)
                      })
                    : [],
                a = s.length,
                l = s.find(function (n) {
                  return n.index === t
                }),
                c = !1,
                f = !1,
                p = !1,
                d = !1
              if (
                (void 0 !== l
                  ? r
                    ? -1 === l.direction
                      ? (p = !0)
                      : (d = !0)
                    : 1 === a
                      ? (d = !0)
                      : a > 1 && ((f = !0), (c = !0))
                  : 0 === a
                    ? (c = !0)
                    : a > 0 && !r
                      ? ((c = !0), (f = !0))
                      : a > 0 && r && (c = !0),
                f && (s = []),
                c)
              )
                s.push({ index: t, direction: n, compare: o })
              else if (d) {
                var h = s.indexOf(l)
                s[h].direction = n
              } else if (p) {
                var _ = s.indexOf(l)
                s.splice(_, 1)
              }
              return e({}, i, { sort: { columns: s } })
            }
          },
          gn = function (t, n, r) {
            return function (o) {
              var i = (o.sort ? [].concat(o.sort.columns) : []).find(function (n) {
                return n.index === t
              })
              return e({}, o, i ? yn(t, 1 === i.direction ? -1 : 1, n, r)(o) : yn(t, 1, n, r)(o))
            }
          },
          bn = /*#__PURE__*/ (function (t) {
            function o() {
              return t.apply(this, arguments) || this
            }
            return (
              r(o, t),
              (o.prototype._process = function (t) {
                var n = {}
                return (
                  this.props.url && (n.url = this.props.url(t.url, this.props.columns)),
                  this.props.body && (n.body = this.props.body(t.body, this.props.columns)),
                  e({}, t, n)
                )
              }),
              n(o, [
                {
                  key: 'type',
                  get: function () {
                    return K.ServerSort
                  },
                },
              ]),
              o
            )
          })(tt)
        function wn(t) {
          var n = It(),
            r = Ht().dispatch,
            o = At(),
            i = yt(0),
            u = i[0],
            s = i[1],
            a = n.sort,
            l = jt(function (t) {
              return t.sort
            }),
            c = 'object' == typeof (null == a ? void 0 : a.server) ? K.ServerSort : K.Sort,
            f = function () {
              var t = n.pipeline.getStepsByType(c)
              if (t.length) return t[0]
            }
          return (
            gt(
              function () {
                var t =
                  f() ||
                  (c === K.ServerSort
                    ? new bn(e({ columns: l ? l.columns : [] }, a.server))
                    : new vn({ columns: l ? l.columns : [] }))
                return (
                  n.pipeline.tryRegister(t),
                  function () {
                    return n.pipeline.unregister(t)
                  }
                )
              },
              [n]
            ),
            gt(
              function () {
                if (l) {
                  var n,
                    e = l.columns.find(function (n) {
                      return n.index === t.index
                    })
                  e
                    ? (0 === u && (e.direction = null != (n = t.direction) ? n : 1), s(e.direction))
                    : s(0)
                }
              },
              [l]
            ),
            gt(
              function () {
                var t = f()
                t && l && t.setProps({ columns: l.columns })
              },
              [l]
            ),
            w('button', {
              'tabIndex': -1,
              'aria-label': o('sort.sort' + (1 === u ? 'Desc' : 'Asc')),
              'title': o('sort.sort' + (1 === u ? 'Desc' : 'Asc')),
              'className': rt(
                et('sort'),
                et(
                  'sort',
                  (function (t) {
                    return 1 === t ? 'asc' : -1 === t ? 'desc' : 'neutral'
                  })(u)
                ),
                n.className.sort
              ),
              'onClick': function (n) {
                n.preventDefault(),
                  n.stopPropagation(),
                  r(gn(t.index, !0 === n.shiftKey && a.multiColumn, t.compare))
              },
            })
          )
        }
        var xn = function (t, n) {
          var e
          void 0 === n && (n = 100)
          var r = Date.now(),
            o = function () {
              ;(r = Date.now()), t.apply(void 0, [].slice.call(arguments))
            }
          return function () {
            var t = [].slice.call(arguments),
              i = Date.now(),
              u = i - r
            u >= n
              ? o.apply(void 0, t)
              : (e && clearTimeout(e),
                (e = setTimeout(function () {
                  o.apply(void 0, t), (e = null)
                }, n - u)))
          }
        }
        function kn(t) {
          var n,
            e = function (t) {
              return t instanceof MouseEvent
                ? Math.floor(t.pageX)
                : Math.floor(t.changedTouches[0].pageX)
            },
            r = function (r) {
              r.stopPropagation()
              var u = parseInt(t.thRef.current.style.width, 10) - e(r)
              ;(n = xn(function (t) {
                return o(t, u)
              }, 10)),
                document.addEventListener('mouseup', i),
                document.addEventListener('touchend', i),
                document.addEventListener('mousemove', n),
                document.addEventListener('touchmove', n)
            },
            o = function (n, r) {
              n.stopPropagation()
              var o = t.thRef.current
              r + e(n) >= parseInt(o.style.minWidth, 10) && (o.style.width = r + e(n) + 'px')
            },
            i = function t(e) {
              e.stopPropagation(),
                document.removeEventListener('mouseup', t),
                document.removeEventListener('mousemove', n),
                document.removeEventListener('touchmove', n),
                document.removeEventListener('touchend', t)
            }
          return w('div', {
            className: rt(et('th'), et('resizable')),
            onMouseDown: r,
            onTouchStart: r,
            onClick: function (t) {
              return t.stopPropagation()
            },
          })
        }
        function Sn(t) {
          var n = It(),
            r = bt(null),
            o = yt({}),
            i = o[0],
            u = o[1],
            s = Ht().dispatch
          gt(
            function () {
              if (n.fixedHeader && r.current) {
                var t = r.current.offsetTop
                'number' == typeof t && u({ top: t })
              }
            },
            [r]
          )
          var a,
            l = function () {
              return null != t.column.sort
            },
            c = function (e) {
              e.stopPropagation(),
                l() &&
                  s(gn(t.index, !0 === e.shiftKey && n.sort.multiColumn, t.column.sort.compare))
            }
          return w(
            'th',
            e(
              {
                'ref': r,
                'data-column-id': t.column && t.column.id,
                'className': rt(
                  et('th'),
                  l() ? et('th', 'sort') : null,
                  n.fixedHeader ? et('th', 'fixed') : null,
                  n.className.th
                ),
                'onClick': c,
                'style': e(
                  {},
                  n.style.th,
                  { minWidth: t.column.minWidth, width: t.column.width },
                  i,
                  t.style
                ),
                'onKeyDown': function (t) {
                  l() && 13 === t.which && c(t)
                },
                'rowSpan': t.rowSpan > 1 ? t.rowSpan : void 0,
                'colSpan': t.colSpan > 1 ? t.colSpan : void 0,
              },
              (a = t.column)
                ? 'function' == typeof a.attributes
                  ? a.attributes(null, null, t.column)
                  : a.attributes
                : {},
              l() ? { tabIndex: 0 } : {}
            ),
            w(
              'div',
              { className: et('th', 'content') },
              void 0 !== t.column.name
                ? t.column.name
                : void 0 !== t.column.plugin
                  ? w(Gt, { pluginId: t.column.plugin.id, props: { column: t.column } })
                  : null
            ),
            l() && w(wn, e({ index: t.index }, t.column.sort)),
            t.column.resizable &&
              t.index < n.header.visibleColumns.length - 1 &&
              w(kn, { column: t.column, thRef: r })
          )
        }
        function Nn() {
          var t,
            n = It(),
            e = jt(function (t) {
              return t.header
            })
          return e
            ? w(
                'thead',
                { key: e.id, className: rt(et('thead'), n.className.thead) },
                (t = Kt.tabularFormat(e.columns)).map(function (n, r) {
                  return (function (t, n, r) {
                    var o = Kt.leafColumns(e.columns)
                    return w(
                      hn,
                      null,
                      t.map(function (t) {
                        return t.hidden
                          ? null
                          : (function (t, n, e, r) {
                              var o = (function (t, n, e) {
                                var r = Kt.maximumDepth(t),
                                  o = e - n
                                return {
                                  rowSpan: Math.floor(o - r - r / o),
                                  colSpan: (t.columns && t.columns.length) || 1,
                                }
                              })(t, n, r)
                              return w(Sn, {
                                column: t,
                                index: e,
                                colSpan: o.colSpan,
                                rowSpan: o.rowSpan,
                              })
                            })(t, n, o.indexOf(t), r)
                      })
                    )
                  })(n, r, t.length)
                })
              )
            : null
        }
        var Pn = function (t) {
          return function (n) {
            return e({}, n, { header: t })
          }
        }
        function Cn() {
          var t = It(),
            n = bt(null),
            r = Ht().dispatch
          return (
            gt(
              function () {
                n &&
                  r(
                    (function (t) {
                      return function (n) {
                        return e({}, n, { tableRef: t })
                      }
                    })(n)
                  )
              },
              [n]
            ),
            w(
              'table',
              {
                ref: n,
                role: 'grid',
                className: rt(et('table'), t.className.table),
                style: e({}, t.style.table, { height: t.height }),
              },
              w(Nn, null),
              w(mn, null)
            )
          )
        }
        function En() {
          var t = yt(!0),
            n = t[0],
            r = t[1],
            o = bt(null),
            i = It()
          return (
            gt(
              function () {
                0 === o.current.children.length && r(!1)
              },
              [o]
            ),
            n
              ? w(
                  'div',
                  {
                    ref: o,
                    className: rt(et('head'), i.className.header),
                    style: e({}, i.style.header),
                  },
                  w(Gt, { position: zt.Header })
                )
              : null
          )
        }
        function In() {
          var t = bt(null),
            n = yt(!0),
            r = n[0],
            o = n[1],
            i = It()
          return (
            gt(
              function () {
                0 === t.current.children.length && o(!1)
              },
              [t]
            ),
            r
              ? w(
                  'div',
                  {
                    ref: t,
                    className: rt(et('footer'), i.className.footer),
                    style: e({}, i.style.footer),
                  },
                  w(Gt, { position: zt.Footer })
                )
              : null
          )
        }
        function Tn() {
          var t = It(),
            n = Ht().dispatch,
            r = jt(function (t) {
              return t.status
            }),
            o = jt(function (t) {
              return t.data
            }),
            i = jt(function (t) {
              return t.tableRef
            }),
            u = { current: null },
            s = xn(function () {
              try {
                n(function (t) {
                  return e({}, t, { status: a.Loading })
                })
                var r = (function (r, o) {
                  try {
                    var i = Promise.resolve(t.pipeline.process()).then(function (t) {
                      n(
                        (function (t) {
                          return function (n) {
                            return t ? e({}, n, { data: t, status: a.Loaded }) : n
                          }
                        })(t)
                      ),
                        setTimeout(function () {
                          n(function (t) {
                            return t.status === a.Loaded ? e({}, t, { status: a.Rendered }) : t
                          })
                        }, 0)
                    })
                  } catch (t) {
                    return o(t)
                  }
                  return i && i.then ? i.then(void 0, o) : i
                })(0, function (t) {
                  Vt.error(t),
                    n(function (t) {
                      return e({}, t, { data: null, status: a.Error })
                    })
                })
                return Promise.resolve(r && r.then ? r.then(function () {}) : void 0)
              } catch (t) {
                return Promise.reject(t)
              }
            }, t.processingThrottleMs)
          return (
            gt(function () {
              return (
                n(Pn(t.header)),
                s(),
                t.pipeline.on('updated', s),
                function () {
                  return t.pipeline.off('updated', s)
                }
              )
            }, []),
            gt(
              function () {
                t.header &&
                  r === a.Loaded &&
                  null != o &&
                  o.length &&
                  n(Pn(t.header.adjustWidth(t, i, u)))
              },
              [o, t, u]
            ),
            w(
              'div',
              {
                role: 'complementary',
                className: rt(
                  'gridjs',
                  et('container'),
                  r === a.Loading ? et('loading') : null,
                  t.className.container
                ),
                style: e({}, t.style.container, { width: t.width }),
              },
              r === a.Loading && w('div', { className: et('loading-bar') }),
              w(En, null),
              w('div', { className: et('wrapper'), style: { height: t.height } }, w(Cn, null)),
              w(In, null),
              w('div', { ref: u, id: 'gridjs-temp', className: et('temp') })
            )
          )
        }
        var Ln = /*#__PURE__*/ (function (t) {
          function n(n) {
            var e
            return (
              ((e = t.call(this) || this).config = void 0),
              (e.plugin = void 0),
              (e.config = new pn().assign({ instance: i(e), eventEmitter: i(e) }).update(n)),
              (e.plugin = e.config.plugin),
              e
            )
          }
          r(n, t)
          var e = n.prototype
          return (
            (e.updateConfig = function (t) {
              return this.config.update(t), this
            }),
            (e.createElement = function () {
              return w(fn.Provider, { value: this.config, children: w(Tn, {}) })
            }),
            (e.forceRender = function () {
              return (
                (this.config && this.config.container) ||
                  Vt.error(
                    'Container is empty. Make sure you call render() before forceRender()',
                    !0
                  ),
                this.destroy(),
                q(this.createElement(), this.config.container),
                this
              )
            }),
            (e.destroy = function () {
              this.config.pipeline.clearCache(), q(null, this.config.container)
            }),
            (e.render = function (t) {
              return (
                t || Vt.error('Container element cannot be null', !0),
                t.childNodes.length > 0
                  ? (Vt.error(
                      'The container element ' +
                        t +
                        ' is not empty. Make sure the container is empty and call render() again'
                    ),
                    this)
                  : ((this.config.container = t), q(this.createElement(), t), this)
              )
            }),
            n
          )
        })(Q)
        //# sourceMappingURL=gridjs.module.js.map

        /***/
      },

    /******/
  }
  /************************************************************************/
  /******/ // The module cache
  /******/ var __webpack_module_cache__ = {}
  /******/
  /******/ // The require function
  /******/ function __webpack_require__(moduleId) {
    /******/ // Check if module is in cache
    /******/ var cachedModule = __webpack_module_cache__[moduleId]
    /******/ if (cachedModule !== undefined) {
      /******/ return cachedModule.exports
      /******/
    }
    /******/ // Create a new module (and put it into the cache)
    /******/ var module = (__webpack_module_cache__[moduleId] = {
      /******/ // no module.id needed
      /******/ // no module.loaded needed
      /******/ exports: {},
      /******/
    })
    /******/
    /******/ // Execute the module function
    /******/ __webpack_modules__[moduleId](module, module.exports, __webpack_require__)
    /******/
    /******/ // Return the exports of the module
    /******/ return module.exports
    /******/
  }
  /******/
  /************************************************************************/
  /******/ /* webpack/runtime/define property getters */
  /******/ ;(() => {
    /******/ // define getter functions for harmony exports
    /******/ __webpack_require__.d = (exports, definition) => {
      /******/ for (var key in definition) {
        /******/ if (
          __webpack_require__.o(definition, key) &&
          !__webpack_require__.o(exports, key)
        ) {
          /******/ Object.defineProperty(exports, key, { enumerable: true, get: definition[key] })
          /******/
        }
        /******/
      }
      /******/
    }
    /******/
  })()
  /******/
  /******/ /* webpack/runtime/hasOwnProperty shorthand */
  /******/ ;(() => {
    /******/ __webpack_require__.o = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop)
    /******/
  })()
  /******/
  /******/ /* webpack/runtime/make namespace object */
  /******/ ;(() => {
    /******/ // define __esModule on exports
    /******/ __webpack_require__.r = (exports) => {
      /******/ if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
        /******/ Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
        /******/
      }
      /******/ Object.defineProperty(exports, '__esModule', { value: true })
      /******/
    }
    /******/
  })()
  /******/
  /************************************************************************/
  var __webpack_exports__ = {}
  /*!***********************************!*\
  !*** ./resources/js/backlinks.js ***!
  \***********************************/
  __webpack_require__.r(__webpack_exports__)
  /* harmony import */ var gridjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(
    /*! gridjs */ './node_modules/gridjs/dist/gridjs.module.js'
  )
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
  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError('Cannot call a class as a function')
    }
  }
  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i]
      descriptor.enumerable = descriptor.enumerable || false
      descriptor.configurable = true
      if ('value' in descriptor) descriptor.writable = true
      Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor)
    }
  }
  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps)
    if (staticProps) _defineProperties(Constructor, staticProps)
    Object.defineProperty(Constructor, 'prototype', { writable: false })
    return Constructor
  }
  function _callSuper(t, o, e) {
    return (
      (o = _getPrototypeOf(o)),
      _possibleConstructorReturn(
        t,
        _isNativeReflectConstruct()
          ? Reflect.construct(o, e || [], _getPrototypeOf(t).constructor)
          : o.apply(t, e)
      )
    )
  }
  function _possibleConstructorReturn(self, call) {
    if (call && (_typeof(call) === 'object' || typeof call === 'function')) {
      return call
    } else if (call !== void 0) {
      throw new TypeError('Derived constructors may only return object or undefined')
    }
    return _assertThisInitialized(self)
  }
  function _assertThisInitialized(self) {
    if (self === void 0) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called")
    }
    return self
  }
  function _inherits(subClass, superClass) {
    if (typeof superClass !== 'function' && superClass !== null) {
      throw new TypeError('Super expression must either be null or a function')
    }
    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: { value: subClass, writable: true, configurable: true },
    })
    Object.defineProperty(subClass, 'prototype', { writable: false })
    if (superClass) _setPrototypeOf(subClass, superClass)
  }
  function _wrapNativeSuper(Class) {
    var _cache = typeof Map === 'function' ? new Map() : undefined
    _wrapNativeSuper = function _wrapNativeSuper(Class) {
      if (Class === null || !_isNativeFunction(Class)) return Class
      if (typeof Class !== 'function') {
        throw new TypeError('Super expression must either be null or a function')
      }
      if (typeof _cache !== 'undefined') {
        if (_cache.has(Class)) return _cache.get(Class)
        _cache.set(Class, Wrapper)
      }
      function Wrapper() {
        return _construct(Class, arguments, _getPrototypeOf(this).constructor)
      }
      Wrapper.prototype = Object.create(Class.prototype, {
        constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true },
      })
      return _setPrototypeOf(Wrapper, Class)
    }
    return _wrapNativeSuper(Class)
  }
  function _construct(t, e, r) {
    if (_isNativeReflectConstruct()) return Reflect.construct.apply(null, arguments)
    var o = [null]
    o.push.apply(o, e)
    var p = new (t.bind.apply(t, o))()
    return r && _setPrototypeOf(p, r.prototype), p
  }
  function _isNativeReflectConstruct() {
    try {
      var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {}))
    } catch (t) {}
    return (_isNativeReflectConstruct = function _isNativeReflectConstruct() {
      return !!t
    })()
  }
  function _isNativeFunction(fn) {
    try {
      return Function.toString.call(fn).indexOf('[native code]') !== -1
    } catch (e) {
      return typeof fn === 'function'
    }
  }
  function _setPrototypeOf(o, p) {
    _setPrototypeOf = Object.setPrototypeOf
      ? Object.setPrototypeOf.bind()
      : function _setPrototypeOf(o, p) {
          o.__proto__ = p
          return o
        }
    return _setPrototypeOf(o, p)
  }
  function _getPrototypeOf(o) {
    _getPrototypeOf = Object.setPrototypeOf
      ? Object.getPrototypeOf.bind()
      : function _getPrototypeOf(o) {
          return o.__proto__ || Object.getPrototypeOf(o)
        }
    return _getPrototypeOf(o)
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

  var data = [
    ['John', 'john@example.com', 'ancre', true],
    ['Mark', 'mark@gmail.com', 'ancre', false],
    ['Eoin', 'eoin@gmail.com', 'ancre', true],
    ['Sarah', 'sarahcdd@gmail.com', 'ancre', false],
    ['Afshin', 'afshin@mail.com', 'ancre', 'idle'],
  ]
  var gridContainer = document.getElementById('gridjs-container')
  var grid = new gridjs__WEBPACK_IMPORTED_MODULE_0__.Grid({
    columns: [
      {
        name: 'Site',
        attributes: function attributes(cell, row) {
          return _objectSpread({}, formatAttributes(cell, row))
        },
        formatter: function formatter(cell, _, column) {
          return formatOutput(cell, _, column)
        },
      },
      {
        name: 'Url',
        attributes: function attributes(cell, row) {
          return _objectSpread({}, formatAttributes(cell, row))
        },
        formatter: function formatter(cell, _, column) {
          return formatOutput(cell, _, column)
        },
      },
      {
        name: 'Ancre',
        attributes: function attributes(cell, row) {
          return _objectSpread({}, formatAttributes(cell, row))
        },
        formatter: function formatter(cell, _, column) {
          return formatOutput(cell, _, column)
        },
      },
      {
        name: 'État',
        attributes: function attributes(cell, row) {
          return _objectSpread({}, formatAttributes(cell, row))
        },
        formatter: function formatter(cell, _, column) {
          return formatOutput(cell, _, column)
        },
      },
    ],
    sort: true,
    data: fetchBacklinks,
  }).render(gridContainer)
  grid.on('cellClick', function (e, args) {
    return copyLinkElement(e, args.data)
  })
  grid.on('rowClick', function (e, args) {
    return deleteLinkElement(e, args.cells)
  })

  /***** Utils *****/
  function fetchBacklinks() {
    return _fetchBacklinks.apply(this, arguments)
  }
  function _fetchBacklinks() {
    _fetchBacklinks = _asyncToGenerator(
      /*#__PURE__*/ _regeneratorRuntime().mark(function _callee3() {
        var response, responseDAta, dataFormatted
        return _regeneratorRuntime().wrap(
          function _callee3$(_context3) {
            while (1)
              switch ((_context3.prev = _context3.next)) {
                case 0:
                  _context3.prev = 0
                  _context3.next = 3
                  return fetch('/api/backlinks')
                case 3:
                  response = _context3.sent
                  if (response.ok) {
                    _context3.next = 8
                    break
                  }
                  throw new Error()
                case 8:
                  _context3.next = 10
                  return response.json()
                case 10:
                  responseDAta = _context3.sent
                  dataFormatted = responseDAta.map(function (data) {
                    var _data$state
                    var siteData
                    var urlData
                    var anchorData
                    if (!data.state) {
                      var _data$site, _data$url, _data$anchor
                      siteData =
                        (_data$site = data.site) !== null && _data$site !== void 0
                          ? _data$site
                          : '?'
                      urlData =
                        (_data$url = data.url) !== null && _data$url !== void 0 ? _data$url : '?'
                      anchorData =
                        (_data$anchor = data.anchor) !== null && _data$anchor !== void 0
                          ? _data$anchor
                          : '?'
                    } else {
                      var _data$site2, _data$url2, _data$anchor2
                      siteData =
                        (_data$site2 = data.site) !== null && _data$site2 !== void 0
                          ? _data$site2
                          : 'loading'
                      urlData =
                        (_data$url2 = data.url) !== null && _data$url2 !== void 0
                          ? _data$url2
                          : 'loading'
                      anchorData =
                        (_data$anchor2 = data.anchor) !== null && _data$anchor2 !== void 0
                          ? _data$anchor2
                          : 'loading'
                    }
                    return [
                      siteData,
                      urlData,
                      anchorData,
                      (_data$state = data.state) !== null && _data$state !== void 0
                        ? _data$state
                        : 'loading',
                    ]
                  })
                  return _context3.abrupt('return', dataFormatted.reverse())
                case 13:
                  _context3.next = 18
                  break
                case 15:
                  _context3.prev = 15
                  _context3.t0 = _context3['catch'](0)
                  console.log('An error is occured :(')
                case 18:
                case 'end':
                  return _context3.stop()
              }
          },
          _callee3,
          null,
          [[0, 15]]
        )
      })
    )
    return _fetchBacklinks.apply(this, arguments)
  }
  function backgroundClass(status) {
    switch (status) {
      case 'ok':
        return {
          class: 'gridjs-td !bg-emerald-200 cursor-default max-w-[150px] truncate relative group',
        }
      case 'ko':
        return {
          class: 'gridjs-td !bg-red-200 cursor-default max-w-[150px] truncate relative group',
        }
      default:
        return {
          class: 'gridjs-td !bg-stone-100 cursor-default max-w-[150px] truncate relative group',
        }
    }
  }
  function formatAttributes(cell, row) {
    if (cell === null) return
    var isLinkActive = row === null || row === void 0 ? void 0 : row.cells[3].data
    switch (isLinkActive) {
      case true:
        return _objectSpread({}, backgroundClass('ok'))
      case false:
        return _objectSpread({}, backgroundClass('ko'))
      case 'idle':
        return _objectSpread({}, backgroundClass('idle'))
      default:
        return _objectSpread({}, backgroundClass())
    }
  }
  function formatOutput(cell, _, column) {
    var content
    if (cell === true) {
      content = 'actif'
    } else if (cell === false) {
      content = 'inactif'
    } else if (cell === 'idle') {
      content = createInterrogationPointCell()
    } else if (cell === 'loading') {
      content = createLoadingCell()
    } else if (cell === '?' && column.name !== 'Site') {
      content = createInterrogationPointCell()
    } else if (column.name === 'Site') {
      content =
        cell === '?'
          ? "<span class='w-full block text-center cursor-default'>?</sapn>"
          : '<span>'.concat(cell, '</span>')
      content = (0, gridjs__WEBPACK_IMPORTED_MODULE_0__.html)(
        '\n        '.concat(
          content,
          '\n        <div class="delete absolute top-1/2 -translate-y-1/2 right-2 bg-gray-200/70 text-gray-700 p-2 cursor-pointer hover:bg-gray-300 hidden group-hover:block rounded">\n            <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24">\n                <path fill="currentColor" d="M7 21q-.825 0-1.413-.588T5 19V6H4V4h5V3h6v1h5v2h-1v13q0 .825-.588 1.413T17 21H7ZM17 6H7v13h10V6ZM9 17h2V8H9v9Zm4 0h2V8h-2v9ZM7 6v13V6Z"/>\n            </svg>\n        </div>\n'
        )
      )
    } else if (column.name === 'Url') {
      var _cell$split = cell.split(' '),
        _cell$split2 = _slicedToArray(_cell$split, 3),
        isInputString = _cell$split2[0],
        value = _cell$split2[1],
        raiseError = _cell$split2[2]
      var isInput = isInputString === '#input#'
      if (!isInput) {
        content = (0, gridjs__WEBPACK_IMPORTED_MODULE_0__.html)(
          '\n                <span>'.concat(
            cell,
            '</span>\n                <span class="url absolute inset-0 cursor-pointer"></span>\n                <div class="copy-content absolute top-1/2 -translate-y-1/2 right-2 bg-gray-200/70 text-gray-700 p-2 cursor-pointer hover:bg-gray-300 hidden group-hover:block rounded">\n                    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24">\n                        <path fill="currentColor" d="M9 18q-.825 0-1.413-.588T7 16V4q0-.825.588-1.413T9 2h9q.825 0 1.413.588T20 4v12q0 .825-.588 1.413T18 18H9Zm0-2h9V4H9v12Zm-4 6q-.825 0-1.413-.588T3 20V7q0-.425.288-.713T4 6q.425 0 .713.288T5 7v13h10q.425 0 .713.288T16 21q0 .425-.288.713T15 22H5Zm4-6V4v12Z" />\n                    </svg>\n                </div>\n        '
          )
        )
      } else {
        content = createInputCell(column, value, raiseError === '#raiseError#')
      }
    } else {
      content = cell
    }
    return content
  }
  function createInputCell(column) {
    var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ''
    var raiseError = arguments.length > 2 ? arguments[2] : undefined
    var modal = raiseError
      ? "\n    <p class='absolute px-3 py-2 bg-red-100 text-red-950 rounded-md border-2 border-red-500 -top-5 right-0 left-0 -translate-y-full'>L'url n'est pas valide, veuillez entrer une adresse correcte</p>\n    "
      : ''
    return (0, gridjs__WEBPACK_IMPORTED_MODULE_0__.html)(
      "\n    <input-cell class='relative'>\n        "
        .concat(modal, "\n        <input type='text' placeholder='")
        .concat(column.name, "' class='w-full outline-none bg-stone-100' value='")
        .concat(value, "' />\n    </input-cell>\n    ")
    )
  }
  function createInterrogationPointCell() {
    return (0, gridjs__WEBPACK_IMPORTED_MODULE_0__.html)(
      "<span class='w-full block text-center cursor-default'>?</sapn>"
    )
  }
  function createLoadingCell() {
    return (0, gridjs__WEBPACK_IMPORTED_MODULE_0__.html)(
      '\n    <span class=\'block text-center\'>\n        <svg class="w-5 inline-block cursor-default animate-spin h-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">\n            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>\n            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>\n        </svg>\n    </span>\n    '
    )
  }
  function updateGridData(_x) {
    return _updateGridData.apply(this, arguments)
  }
  function _updateGridData() {
    _updateGridData = _asyncToGenerator(
      /*#__PURE__*/ _regeneratorRuntime().mark(function _callee4(payload) {
        var newData, inputString
        return _regeneratorRuntime().wrap(function _callee4$(_context4) {
          while (1)
            switch ((_context4.prev = _context4.next)) {
              case 0:
                _context4.next = 2
                return fetchBacklinks()
              case 2:
                newData = _context4.sent
                if ((payload === null || payload === void 0 ? void 0 : payload.type) === 'input') {
                  inputString = '#input# '.concat(payload.value)
                  if (payload.error) inputString += ' #raiseError#'
                  newData.push(['idle', inputString, 'idle', 'idle'])
                } else if (
                  (payload === null || payload === void 0 ? void 0 : payload.type) === 'row'
                ) {
                  newData.push(['loading', payload.value, 'loading', 'loading'])
                }
                if (newData.length) {
                  _context4.next = 6
                  break
                }
                return _context4.abrupt('return')
              case 6:
                grid
                  .updateConfig({
                    data: newData,
                  })
                  .forceRender()
              case 7:
              case 'end':
                return _context4.stop()
            }
        }, _callee4)
      })
    )
    return _updateGridData.apply(this, arguments)
  }
  function isValidUrl(url) {
    var pattern = new RegExp(
      '^(https?:\\/\\/)' +
        // protocole (obligatoire)
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' +
        // nom de domaine
        '((\\d{1,3}\\.){3}\\d{1,3}))' +
        // OU une adresse IP (v4)
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
        // port et chemin
        '(\\?[;&a-z\\d%_.~+=-]*)?' +
        // query string
        '(\\#[-a-z\\d_]*)?$',
      'i'
    ) // fragment locator
    return !!pattern.test(url)
  }
  function copyLinkElement(_x2, _x3) {
    return _copyLinkElement.apply(this, arguments)
  }
  function _copyLinkElement() {
    _copyLinkElement = _asyncToGenerator(
      /*#__PURE__*/ _regeneratorRuntime().mark(function _callee5(e, content) {
        var elemClicked, isCellUrl, isCopyButton
        return _regeneratorRuntime().wrap(
          function _callee5$(_context5) {
            while (1)
              switch ((_context5.prev = _context5.next)) {
                case 0:
                  _context5.prev = 0
                  elemClicked = e.target
                  isCellUrl = elemClicked.classList.contains('url')
                  isCopyButton = elemClicked.closest('.copy-content') !== undefined
                  if (!isCellUrl) {
                    _context5.next = 8
                    break
                  }
                  window.open(content)
                  _context5.next = 11
                  break
                case 8:
                  if (!isCopyButton) {
                    _context5.next = 11
                    break
                  }
                  _context5.next = 11
                  return navigator.clipboard.writeText(content)
                case 11:
                  _context5.next = 16
                  break
                case 13:
                  _context5.prev = 13
                  _context5.t0 = _context5['catch'](0)
                  console.error('Erreur lors de la copie', _context5.t0)
                case 16:
                case 'end':
                  return _context5.stop()
              }
          },
          _callee5,
          null,
          [[0, 13]]
        )
      })
    )
    return _copyLinkElement.apply(this, arguments)
  }
  function deleteLinkElement(_x4, _x5) {
    return _deleteLinkElement.apply(this, arguments)
  }
  /***** Events *****/
  function _deleteLinkElement() {
    _deleteLinkElement = _asyncToGenerator(
      /*#__PURE__*/ _regeneratorRuntime().mark(function _callee6(e, cells) {
        var elemClicked, deleteButton, isdeleteButton, cell, loadingButton, response
        return _regeneratorRuntime().wrap(
          function _callee6$(_context6) {
            while (1)
              switch ((_context6.prev = _context6.next)) {
                case 0:
                  _context6.prev = 0
                  elemClicked = e.target
                  deleteButton = elemClicked.closest('.delete')
                  isdeleteButton = deleteButton !== undefined
                  if (!isdeleteButton) {
                    _context6.next = 20
                    break
                  }
                  cell = deleteButton.closest('td')
                  deleteButton.remove()

                  //create loading button
                  loadingButton = document.createElement('span')
                  loadingButton.classList.add(
                    'absolute',
                    'top-1/2',
                    '-translate-y-1/2',
                    'right-2',
                    'bg-gray-200/70',
                    'text-gray-700',
                    'p-2',
                    'cursor-pointer',
                    'hover:bg-gray-300',
                    'rounded'
                  )
                  loadingButton.innerHTML =
                    '\n                <span class=\'block text-center\'>\n                    <svg class="w-5 inline-block cursor-default animate-spin h-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">\n                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>\n                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>\n                    </svg>\n                </span>\n                '
                  cell.appendChild(loadingButton)

                  //call serve to delete from database
                  _context6.next = 13
                  return fetch('/api/backlinks/delete', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      url: cells[1].data,
                    }),
                  })
                case 13:
                  response = _context6.sent
                  if (response.ok) {
                    _context6.next = 18
                    break
                  }
                  throw new Error()
                case 18:
                  _context6.next = 20
                  return updateGridData()
                case 20:
                  _context6.next = 25
                  break
                case 22:
                  _context6.prev = 22
                  _context6.t0 = _context6['catch'](0)
                  console.error('Erreur lors de la suppression du lien', _context6.t0)
                case 25:
                case 'end':
                  return _context6.stop()
              }
          },
          _callee6,
          null,
          [[0, 22]]
        )
      })
    )
    return _deleteLinkElement.apply(this, arguments)
  }
  document.getElementById('add-row').addEventListener('click', function () {
    return updateGridData({
      type: 'input',
      value: '',
    })
  })

  /***** classes *****/
  var InputCell = /*#__PURE__*/ (function (_HTMLElement) {
    function InputCell() {
      var _this
      _classCallCheck(this, InputCell)
      _this = _callSuper(this, InputCell)
      _defineProperty(
        _this,
        'onInputChange',
        /*#__PURE__*/ (function () {
          var _ref = _asyncToGenerator(
            /*#__PURE__*/ _regeneratorRuntime().mark(function _callee(e) {
              var url
              return _regeneratorRuntime().wrap(function _callee$(_context) {
                while (1)
                  switch ((_context.prev = _context.next)) {
                    case 0:
                      url = e.target.value
                      if (url) {
                        _context.next = 6
                        break
                      }
                      updateGridData()
                      return _context.abrupt('return')
                    case 6:
                      if (isValidUrl(url)) {
                        _context.next = 11
                        break
                      }
                      updateGridData({
                        type: 'input',
                        value: e.target.value,
                        error: true,
                      })
                      return _context.abrupt('return')
                    case 11:
                      _context.next = 13
                      return _this.checkLink(e.target.value)
                    case 13:
                    case 'end':
                      return _context.stop()
                  }
              }, _callee)
            })
          )
          return function (_x6) {
            return _ref.apply(this, arguments)
          }
        })()
      )
      _this.input = _this.querySelector('input')
      return _this
    }
    _inherits(InputCell, _HTMLElement)
    return _createClass(InputCell, [
      {
        key: 'connectedCallback',
        value: function connectedCallback() {
          this.input.focus()
          this.input.addEventListener('change', this.onInputChange)
        },
      },
      {
        key: 'disconnectedCallback',
        value: function disconnectedCallback() {
          this.input.removeEventListener('change', this.onInputChange)
        },
      },
      {
        key: 'checkLink',
        value: (function () {
          var _checkLink = _asyncToGenerator(
            /*#__PURE__*/ _regeneratorRuntime().mark(function _callee2(url) {
              var response
              return _regeneratorRuntime().wrap(
                function _callee2$(_context2) {
                  while (1)
                    switch ((_context2.prev = _context2.next)) {
                      case 0:
                        _context2.prev = 0
                        _context2.next = 3
                        return updateGridData({
                          type: 'row',
                          value: url,
                        })
                      case 3:
                        _context2.next = 5
                        return fetch('/api/backlinks/check', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            urls: [url],
                          }),
                        })
                      case 5:
                        response = _context2.sent
                        if (response.ok) {
                          _context2.next = 10
                          break
                        }
                        throw new Error()
                      case 10:
                        _context2.next = 12
                        return updateGridData()
                      case 12:
                        _context2.next = 17
                        break
                      case 14:
                        _context2.prev = 14
                        _context2.t0 = _context2['catch'](0)
                        updateGridData({
                          type: 'input',
                          value: url,
                          error: true,
                        })
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
          function checkLink(_x7) {
            return _checkLink.apply(this, arguments)
          }
          return checkLink
        })(),
      },
    ])
  })(/*#__PURE__*/ _wrapNativeSuper(HTMLElement))
  customElements.define('input-cell', InputCell)
  /******/
})()
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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RUFBRUMsSUFBSSxDQUFDQyxTQUFTLENBQUM7a0JBQ25Cc0IsSUFBSSxFQUFFLENBQUM3RixHQUFHO2dCQUNaLENBQUM7Y0FDSCxDQUFDLENBQUM7WUFBQTtjQVJJbEIsUUFBUSxHQUFBOEcsU0FBQSxDQUFBcFEsSUFBQTtjQUFBLElBVVRzSixRQUFRLENBQUNNLEVBQUU7Z0JBQUF3RyxTQUFBLENBQUE5UCxJQUFBO2dCQUFBO2NBQUE7Y0FBQSxNQUNSLElBQUlYLEtBQUssQ0FBQyxDQUFDO1lBQUE7Y0FBQXlRLFNBQUEsQ0FBQTlQLElBQUE7Y0FBQSxPQUVYeUwsY0FBYyxDQUFDLENBQUM7WUFBQTtjQUFBcUUsU0FBQSxDQUFBOVAsSUFBQTtjQUFBO1lBQUE7Y0FBQThQLFNBQUEsQ0FBQW5PLElBQUE7Y0FBQW1PLFNBQUEsQ0FBQXZGLEVBQUEsR0FBQXVGLFNBQUE7Y0FHeEJyRSxjQUFjLENBQUM7Z0JBQUU5TixJQUFJLEVBQUUsT0FBTztnQkFBRW5CLEtBQUssRUFBRTBOLEdBQUc7Z0JBQUU1RCxLQUFLLEVBQUU7Y0FBSyxDQUFDLENBQUM7WUFBQTtZQUFBO2NBQUEsT0FBQXdKLFNBQUEsQ0FBQWhPLElBQUE7VUFBQTtRQUFBLEdBQUE4TixRQUFBO01BQUEsQ0FFN0Q7TUFBQSxTQUFBVixVQUFBYyxHQUFBO1FBQUEsT0FBQUwsVUFBQSxDQUFBcE0sS0FBQSxPQUFBbUIsU0FBQTtNQUFBO01BQUEsT0FBQXdLLFNBQUE7SUFBQTtFQUFBO0FBQUEsZ0JBQUFuTCxnQkFBQSxDQWpEcUJrTSxXQUFXO0FBbURuQ0MsY0FBYyxDQUFDalQsTUFBTSxDQUFDLFlBQVksRUFBRTBSLFNBQVMsQ0FBQyxDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vZGFzaGJvYXJkLW15c2VsZm1vbmFydC8uL25vZGVfbW9kdWxlcy9ncmlkanMvZGlzdC9ncmlkanMubW9kdWxlLmpzIiwid2VicGFjazovL2Rhc2hib2FyZC1teXNlbGZtb25hcnQvd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vZGFzaGJvYXJkLW15c2VsZm1vbmFydC93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vZGFzaGJvYXJkLW15c2VsZm1vbmFydC93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL2Rhc2hib2FyZC1teXNlbGZtb25hcnQvd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly9kYXNoYm9hcmQtbXlzZWxmbW9uYXJ0Ly4vcmVzb3VyY2VzL2pzL2JhY2tsaW5rcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJmdW5jdGlvbiB0KHQsbil7Zm9yKHZhciBlPTA7ZTxuLmxlbmd0aDtlKyspe3ZhciByPW5bZV07ci5lbnVtZXJhYmxlPXIuZW51bWVyYWJsZXx8ITEsci5jb25maWd1cmFibGU9ITAsXCJ2YWx1ZVwiaW4gciYmKHIud3JpdGFibGU9ITApLE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0LFwic3ltYm9sXCI9PXR5cGVvZihvPWZ1bmN0aW9uKHQsbil7aWYoXCJvYmplY3RcIiE9dHlwZW9mIHR8fG51bGw9PT10KXJldHVybiB0O3ZhciBlPXRbU3ltYm9sLnRvUHJpbWl0aXZlXTtpZih2b2lkIDAhPT1lKXt2YXIgcj1lLmNhbGwodCxcInN0cmluZ1wiKTtpZihcIm9iamVjdFwiIT10eXBlb2YgcilyZXR1cm4gcjt0aHJvdyBuZXcgVHlwZUVycm9yKFwiQEB0b1ByaW1pdGl2ZSBtdXN0IHJldHVybiBhIHByaW1pdGl2ZSB2YWx1ZS5cIil9cmV0dXJuIFN0cmluZyh0KX0oci5rZXkpKT9vOlN0cmluZyhvKSxyKX12YXIgb31mdW5jdGlvbiBuKG4sZSxyKXtyZXR1cm4gZSYmdChuLnByb3RvdHlwZSxlKSxyJiZ0KG4sciksT2JqZWN0LmRlZmluZVByb3BlcnR5KG4sXCJwcm90b3R5cGVcIix7d3JpdGFibGU6ITF9KSxufWZ1bmN0aW9uIGUoKXtyZXR1cm4gZT1PYmplY3QuYXNzaWduP09iamVjdC5hc3NpZ24uYmluZCgpOmZ1bmN0aW9uKHQpe2Zvcih2YXIgbj0xO248YXJndW1lbnRzLmxlbmd0aDtuKyspe3ZhciBlPWFyZ3VtZW50c1tuXTtmb3IodmFyIHIgaW4gZSlPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZSxyKSYmKHRbcl09ZVtyXSl9cmV0dXJuIHR9LGUuYXBwbHkodGhpcyxhcmd1bWVudHMpfWZ1bmN0aW9uIHIodCxuKXt0LnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKG4ucHJvdG90eXBlKSx0LnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj10LG8odCxuKX1mdW5jdGlvbiBvKHQsbil7cmV0dXJuIG89T2JqZWN0LnNldFByb3RvdHlwZU9mP09iamVjdC5zZXRQcm90b3R5cGVPZi5iaW5kKCk6ZnVuY3Rpb24odCxuKXtyZXR1cm4gdC5fX3Byb3RvX189bix0fSxvKHQsbil9ZnVuY3Rpb24gaSh0KXtpZih2b2lkIDA9PT10KXRocm93IG5ldyBSZWZlcmVuY2VFcnJvcihcInRoaXMgaGFzbid0IGJlZW4gaW5pdGlhbGlzZWQgLSBzdXBlcigpIGhhc24ndCBiZWVuIGNhbGxlZFwiKTtyZXR1cm4gdH1mdW5jdGlvbiB1KHQsbil7KG51bGw9PW58fG4+dC5sZW5ndGgpJiYobj10Lmxlbmd0aCk7Zm9yKHZhciBlPTAscj1uZXcgQXJyYXkobik7ZTxuO2UrKylyW2VdPXRbZV07cmV0dXJuIHJ9ZnVuY3Rpb24gcyh0LG4pe3ZhciBlPVwidW5kZWZpbmVkXCIhPXR5cGVvZiBTeW1ib2wmJnRbU3ltYm9sLml0ZXJhdG9yXXx8dFtcIkBAaXRlcmF0b3JcIl07aWYoZSlyZXR1cm4oZT1lLmNhbGwodCkpLm5leHQuYmluZChlKTtpZihBcnJheS5pc0FycmF5KHQpfHwoZT1mdW5jdGlvbih0LG4pe2lmKHQpe2lmKFwic3RyaW5nXCI9PXR5cGVvZiB0KXJldHVybiB1KHQsbik7dmFyIGU9T2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHQpLnNsaWNlKDgsLTEpO3JldHVyblwiT2JqZWN0XCI9PT1lJiZ0LmNvbnN0cnVjdG9yJiYoZT10LmNvbnN0cnVjdG9yLm5hbWUpLFwiTWFwXCI9PT1lfHxcIlNldFwiPT09ZT9BcnJheS5mcm9tKHQpOlwiQXJndW1lbnRzXCI9PT1lfHwvXig/OlVpfEkpbnQoPzo4fDE2fDMyKSg/OkNsYW1wZWQpP0FycmF5JC8udGVzdChlKT91KHQsbik6dm9pZCAwfX0odCkpfHxuJiZ0JiZcIm51bWJlclwiPT10eXBlb2YgdC5sZW5ndGgpe2UmJih0PWUpO3ZhciByPTA7cmV0dXJuIGZ1bmN0aW9uKCl7cmV0dXJuIHI+PXQubGVuZ3RoP3tkb25lOiEwfTp7ZG9uZTohMSx2YWx1ZTp0W3IrK119fX10aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBhdHRlbXB0IHRvIGl0ZXJhdGUgbm9uLWl0ZXJhYmxlIGluc3RhbmNlLlxcbkluIG9yZGVyIHRvIGJlIGl0ZXJhYmxlLCBub24tYXJyYXkgb2JqZWN0cyBtdXN0IGhhdmUgYSBbU3ltYm9sLml0ZXJhdG9yXSgpIG1ldGhvZC5cIil9dmFyIGE7IWZ1bmN0aW9uKHQpe3RbdC5Jbml0PTBdPVwiSW5pdFwiLHRbdC5Mb2FkaW5nPTFdPVwiTG9hZGluZ1wiLHRbdC5Mb2FkZWQ9Ml09XCJMb2FkZWRcIix0W3QuUmVuZGVyZWQ9M109XCJSZW5kZXJlZFwiLHRbdC5FcnJvcj00XT1cIkVycm9yXCJ9KGF8fChhPXt9KSk7dmFyIGwsYyxmLHAsZCxoLF8sbT17fSx2PVtdLHk9L2FjaXR8ZXgoPzpzfGd8bnxwfCQpfHJwaHxncmlkfG93c3xtbmN8bnR3fGluZVtjaF18em9vfF5vcmR8aXRlcmEvaTtmdW5jdGlvbiBnKHQsbil7Zm9yKHZhciBlIGluIG4pdFtlXT1uW2VdO3JldHVybiB0fWZ1bmN0aW9uIGIodCl7dmFyIG49dC5wYXJlbnROb2RlO24mJm4ucmVtb3ZlQ2hpbGQodCl9ZnVuY3Rpb24gdyh0LG4sZSl7dmFyIHIsbyxpLHU9e307Zm9yKGkgaW4gbilcImtleVwiPT1pP3I9bltpXTpcInJlZlwiPT1pP289bltpXTp1W2ldPW5baV07aWYoYXJndW1lbnRzLmxlbmd0aD4yJiYodS5jaGlsZHJlbj1hcmd1bWVudHMubGVuZ3RoPjM/bC5jYWxsKGFyZ3VtZW50cywyKTplKSxcImZ1bmN0aW9uXCI9PXR5cGVvZiB0JiZudWxsIT10LmRlZmF1bHRQcm9wcylmb3IoaSBpbiB0LmRlZmF1bHRQcm9wcyl2b2lkIDA9PT11W2ldJiYodVtpXT10LmRlZmF1bHRQcm9wc1tpXSk7cmV0dXJuIHgodCx1LHIsbyxudWxsKX1mdW5jdGlvbiB4KHQsbixlLHIsbyl7dmFyIGk9e3R5cGU6dCxwcm9wczpuLGtleTplLHJlZjpyLF9fazpudWxsLF9fOm51bGwsX19iOjAsX19lOm51bGwsX19kOnZvaWQgMCxfX2M6bnVsbCxfX2g6bnVsbCxjb25zdHJ1Y3Rvcjp2b2lkIDAsX192Om51bGw9PW8/KytmOm99O3JldHVybiBudWxsPT1vJiZudWxsIT1jLnZub2RlJiZjLnZub2RlKGkpLGl9ZnVuY3Rpb24gaygpe3JldHVybntjdXJyZW50Om51bGx9fWZ1bmN0aW9uIFModCl7cmV0dXJuIHQuY2hpbGRyZW59ZnVuY3Rpb24gTih0LG4pe3RoaXMucHJvcHM9dCx0aGlzLmNvbnRleHQ9bn1mdW5jdGlvbiBQKHQsbil7aWYobnVsbD09bilyZXR1cm4gdC5fXz9QKHQuX18sdC5fXy5fX2suaW5kZXhPZih0KSsxKTpudWxsO2Zvcih2YXIgZTtuPHQuX19rLmxlbmd0aDtuKyspaWYobnVsbCE9KGU9dC5fX2tbbl0pJiZudWxsIT1lLl9fZSlyZXR1cm4gZS5fX2U7cmV0dXJuXCJmdW5jdGlvblwiPT10eXBlb2YgdC50eXBlP1AodCk6bnVsbH1mdW5jdGlvbiBDKHQpe3ZhciBuLGU7aWYobnVsbCE9KHQ9dC5fXykmJm51bGwhPXQuX19jKXtmb3IodC5fX2U9dC5fX2MuYmFzZT1udWxsLG49MDtuPHQuX19rLmxlbmd0aDtuKyspaWYobnVsbCE9KGU9dC5fX2tbbl0pJiZudWxsIT1lLl9fZSl7dC5fX2U9dC5fX2MuYmFzZT1lLl9fZTticmVha31yZXR1cm4gQyh0KX19ZnVuY3Rpb24gRSh0KXsoIXQuX19kJiYodC5fX2Q9ITApJiZkLnB1c2godCkmJiFJLl9fcisrfHxoIT09Yy5kZWJvdW5jZVJlbmRlcmluZykmJigoaD1jLmRlYm91bmNlUmVuZGVyaW5nKXx8c2V0VGltZW91dCkoSSl9ZnVuY3Rpb24gSSgpe2Zvcih2YXIgdDtJLl9fcj1kLmxlbmd0aDspdD1kLnNvcnQoZnVuY3Rpb24odCxuKXtyZXR1cm4gdC5fX3YuX19iLW4uX192Ll9fYn0pLGQ9W10sdC5zb21lKGZ1bmN0aW9uKHQpe3ZhciBuLGUscixvLGksdTt0Ll9fZCYmKGk9KG89KG49dCkuX192KS5fX2UsKHU9bi5fX1ApJiYoZT1bXSwocj1nKHt9LG8pKS5fX3Y9by5fX3YrMSxNKHUsbyxyLG4uX19uLHZvaWQgMCE9PXUub3duZXJTVkdFbGVtZW50LG51bGwhPW8uX19oP1tpXTpudWxsLGUsbnVsbD09aT9QKG8pOmksby5fX2gpLEYoZSxvKSxvLl9fZSE9aSYmQyhvKSkpfSl9ZnVuY3Rpb24gVCh0LG4sZSxyLG8saSx1LHMsYSxsKXt2YXIgYyxmLHAsZCxoLF8seSxnPXImJnIuX19rfHx2LGI9Zy5sZW5ndGg7Zm9yKGUuX19rPVtdLGM9MDtjPG4ubGVuZ3RoO2MrKylpZihudWxsIT0oZD1lLl9fa1tjXT1udWxsPT0oZD1uW2NdKXx8XCJib29sZWFuXCI9PXR5cGVvZiBkP251bGw6XCJzdHJpbmdcIj09dHlwZW9mIGR8fFwibnVtYmVyXCI9PXR5cGVvZiBkfHxcImJpZ2ludFwiPT10eXBlb2YgZD94KG51bGwsZCxudWxsLG51bGwsZCk6QXJyYXkuaXNBcnJheShkKT94KFMse2NoaWxkcmVuOmR9LG51bGwsbnVsbCxudWxsKTpkLl9fYj4wP3goZC50eXBlLGQucHJvcHMsZC5rZXksZC5yZWY/ZC5yZWY6bnVsbCxkLl9fdik6ZCkpe2lmKGQuX189ZSxkLl9fYj1lLl9fYisxLG51bGw9PT0ocD1nW2NdKXx8cCYmZC5rZXk9PXAua2V5JiZkLnR5cGU9PT1wLnR5cGUpZ1tjXT12b2lkIDA7ZWxzZSBmb3IoZj0wO2Y8YjtmKyspe2lmKChwPWdbZl0pJiZkLmtleT09cC5rZXkmJmQudHlwZT09PXAudHlwZSl7Z1tmXT12b2lkIDA7YnJlYWt9cD1udWxsfU0odCxkLHA9cHx8bSxvLGksdSxzLGEsbCksaD1kLl9fZSwoZj1kLnJlZikmJnAucmVmIT1mJiYoeXx8KHk9W10pLHAucmVmJiZ5LnB1c2gocC5yZWYsbnVsbCxkKSx5LnB1c2goZixkLl9fY3x8aCxkKSksbnVsbCE9aD8obnVsbD09XyYmKF89aCksXCJmdW5jdGlvblwiPT10eXBlb2YgZC50eXBlJiZkLl9faz09PXAuX19rP2QuX19kPWE9TChkLGEsdCk6YT1BKHQsZCxwLGcsaCxhKSxcImZ1bmN0aW9uXCI9PXR5cGVvZiBlLnR5cGUmJihlLl9fZD1hKSk6YSYmcC5fX2U9PWEmJmEucGFyZW50Tm9kZSE9dCYmKGE9UChwKSl9Zm9yKGUuX19lPV8sYz1iO2MtLTspbnVsbCE9Z1tjXSYmVyhnW2NdLGdbY10pO2lmKHkpZm9yKGM9MDtjPHkubGVuZ3RoO2MrKylVKHlbY10seVsrK2NdLHlbKytjXSl9ZnVuY3Rpb24gTCh0LG4sZSl7Zm9yKHZhciByLG89dC5fX2ssaT0wO28mJmk8by5sZW5ndGg7aSsrKShyPW9baV0pJiYoci5fXz10LG49XCJmdW5jdGlvblwiPT10eXBlb2Ygci50eXBlP0wocixuLGUpOkEoZSxyLHIsbyxyLl9fZSxuKSk7cmV0dXJuIG59ZnVuY3Rpb24gQSh0LG4sZSxyLG8saSl7dmFyIHUscyxhO2lmKHZvaWQgMCE9PW4uX19kKXU9bi5fX2Qsbi5fX2Q9dm9pZCAwO2Vsc2UgaWYobnVsbD09ZXx8byE9aXx8bnVsbD09by5wYXJlbnROb2RlKXQ6aWYobnVsbD09aXx8aS5wYXJlbnROb2RlIT09dCl0LmFwcGVuZENoaWxkKG8pLHU9bnVsbDtlbHNle2ZvcihzPWksYT0wOyhzPXMubmV4dFNpYmxpbmcpJiZhPHIubGVuZ3RoO2ErPTEpaWYocz09bylicmVhayB0O3QuaW5zZXJ0QmVmb3JlKG8saSksdT1pfXJldHVybiB2b2lkIDAhPT11P3U6by5uZXh0U2libGluZ31mdW5jdGlvbiBPKHQsbixlKXtcIi1cIj09PW5bMF0/dC5zZXRQcm9wZXJ0eShuLGUpOnRbbl09bnVsbD09ZT9cIlwiOlwibnVtYmVyXCIhPXR5cGVvZiBlfHx5LnRlc3Qobik/ZTplK1wicHhcIn1mdW5jdGlvbiBIKHQsbixlLHIsbyl7dmFyIGk7dDppZihcInN0eWxlXCI9PT1uKWlmKFwic3RyaW5nXCI9PXR5cGVvZiBlKXQuc3R5bGUuY3NzVGV4dD1lO2Vsc2V7aWYoXCJzdHJpbmdcIj09dHlwZW9mIHImJih0LnN0eWxlLmNzc1RleHQ9cj1cIlwiKSxyKWZvcihuIGluIHIpZSYmbiBpbiBlfHxPKHQuc3R5bGUsbixcIlwiKTtpZihlKWZvcihuIGluIGUpciYmZVtuXT09PXJbbl18fE8odC5zdHlsZSxuLGVbbl0pfWVsc2UgaWYoXCJvXCI9PT1uWzBdJiZcIm5cIj09PW5bMV0paT1uIT09KG49bi5yZXBsYWNlKC9DYXB0dXJlJC8sXCJcIikpLG49bi50b0xvd2VyQ2FzZSgpaW4gdD9uLnRvTG93ZXJDYXNlKCkuc2xpY2UoMik6bi5zbGljZSgyKSx0Lmx8fCh0Lmw9e30pLHQubFtuK2ldPWUsZT9yfHx0LmFkZEV2ZW50TGlzdGVuZXIobixpP0Q6aixpKTp0LnJlbW92ZUV2ZW50TGlzdGVuZXIobixpP0Q6aixpKTtlbHNlIGlmKFwiZGFuZ2Vyb3VzbHlTZXRJbm5lckhUTUxcIiE9PW4pe2lmKG8pbj1uLnJlcGxhY2UoL3hsaW5rKEh8OmgpLyxcImhcIikucmVwbGFjZSgvc05hbWUkLyxcInNcIik7ZWxzZSBpZihcImhyZWZcIiE9PW4mJlwibGlzdFwiIT09biYmXCJmb3JtXCIhPT1uJiZcInRhYkluZGV4XCIhPT1uJiZcImRvd25sb2FkXCIhPT1uJiZuIGluIHQpdHJ5e3Rbbl09bnVsbD09ZT9cIlwiOmU7YnJlYWsgdH1jYXRjaCh0KXt9XCJmdW5jdGlvblwiPT10eXBlb2YgZXx8KG51bGw9PWV8fCExPT09ZSYmLTE9PW4uaW5kZXhPZihcIi1cIik/dC5yZW1vdmVBdHRyaWJ1dGUobik6dC5zZXRBdHRyaWJ1dGUobixlKSl9fWZ1bmN0aW9uIGoodCl7dGhpcy5sW3QudHlwZSshMV0oYy5ldmVudD9jLmV2ZW50KHQpOnQpfWZ1bmN0aW9uIEQodCl7dGhpcy5sW3QudHlwZSshMF0oYy5ldmVudD9jLmV2ZW50KHQpOnQpfWZ1bmN0aW9uIE0odCxuLGUscixvLGksdSxzLGEpe3ZhciBsLGYscCxkLGgsXyxtLHYseSxiLHcseCxrLFAsQyxFPW4udHlwZTtpZih2b2lkIDAhPT1uLmNvbnN0cnVjdG9yKXJldHVybiBudWxsO251bGwhPWUuX19oJiYoYT1lLl9faCxzPW4uX19lPWUuX19lLG4uX19oPW51bGwsaT1bc10pLChsPWMuX19iKSYmbChuKTt0cnl7dDppZihcImZ1bmN0aW9uXCI9PXR5cGVvZiBFKXtpZih2PW4ucHJvcHMseT0obD1FLmNvbnRleHRUeXBlKSYmcltsLl9fY10sYj1sP3k/eS5wcm9wcy52YWx1ZTpsLl9fOnIsZS5fX2M/bT0oZj1uLl9fYz1lLl9fYykuX189Zi5fX0U6KFwicHJvdG90eXBlXCJpbiBFJiZFLnByb3RvdHlwZS5yZW5kZXI/bi5fX2M9Zj1uZXcgRSh2LGIpOihuLl9fYz1mPW5ldyBOKHYsYiksZi5jb25zdHJ1Y3Rvcj1FLGYucmVuZGVyPUIpLHkmJnkuc3ViKGYpLGYucHJvcHM9dixmLnN0YXRlfHwoZi5zdGF0ZT17fSksZi5jb250ZXh0PWIsZi5fX249cixwPWYuX19kPSEwLGYuX19oPVtdLGYuX3NiPVtdKSxudWxsPT1mLl9fcyYmKGYuX19zPWYuc3RhdGUpLG51bGwhPUUuZ2V0RGVyaXZlZFN0YXRlRnJvbVByb3BzJiYoZi5fX3M9PWYuc3RhdGUmJihmLl9fcz1nKHt9LGYuX19zKSksZyhmLl9fcyxFLmdldERlcml2ZWRTdGF0ZUZyb21Qcm9wcyh2LGYuX19zKSkpLGQ9Zi5wcm9wcyxoPWYuc3RhdGUscCludWxsPT1FLmdldERlcml2ZWRTdGF0ZUZyb21Qcm9wcyYmbnVsbCE9Zi5jb21wb25lbnRXaWxsTW91bnQmJmYuY29tcG9uZW50V2lsbE1vdW50KCksbnVsbCE9Zi5jb21wb25lbnREaWRNb3VudCYmZi5fX2gucHVzaChmLmNvbXBvbmVudERpZE1vdW50KTtlbHNle2lmKG51bGw9PUUuZ2V0RGVyaXZlZFN0YXRlRnJvbVByb3BzJiZ2IT09ZCYmbnVsbCE9Zi5jb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzJiZmLmNvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHModixiKSwhZi5fX2UmJm51bGwhPWYuc2hvdWxkQ29tcG9uZW50VXBkYXRlJiYhMT09PWYuc2hvdWxkQ29tcG9uZW50VXBkYXRlKHYsZi5fX3MsYil8fG4uX192PT09ZS5fX3Ype2ZvcihmLnByb3BzPXYsZi5zdGF0ZT1mLl9fcyxuLl9fdiE9PWUuX192JiYoZi5fX2Q9ITEpLGYuX192PW4sbi5fX2U9ZS5fX2Usbi5fX2s9ZS5fX2ssbi5fX2suZm9yRWFjaChmdW5jdGlvbih0KXt0JiYodC5fXz1uKX0pLHc9MDt3PGYuX3NiLmxlbmd0aDt3KyspZi5fX2gucHVzaChmLl9zYlt3XSk7Zi5fc2I9W10sZi5fX2gubGVuZ3RoJiZ1LnB1c2goZik7YnJlYWsgdH1udWxsIT1mLmNvbXBvbmVudFdpbGxVcGRhdGUmJmYuY29tcG9uZW50V2lsbFVwZGF0ZSh2LGYuX19zLGIpLG51bGwhPWYuY29tcG9uZW50RGlkVXBkYXRlJiZmLl9faC5wdXNoKGZ1bmN0aW9uKCl7Zi5jb21wb25lbnREaWRVcGRhdGUoZCxoLF8pfSl9aWYoZi5jb250ZXh0PWIsZi5wcm9wcz12LGYuX192PW4sZi5fX1A9dCx4PWMuX19yLGs9MCxcInByb3RvdHlwZVwiaW4gRSYmRS5wcm90b3R5cGUucmVuZGVyKXtmb3IoZi5zdGF0ZT1mLl9fcyxmLl9fZD0hMSx4JiZ4KG4pLGw9Zi5yZW5kZXIoZi5wcm9wcyxmLnN0YXRlLGYuY29udGV4dCksUD0wO1A8Zi5fc2IubGVuZ3RoO1ArKylmLl9faC5wdXNoKGYuX3NiW1BdKTtmLl9zYj1bXX1lbHNlIGRve2YuX19kPSExLHgmJngobiksbD1mLnJlbmRlcihmLnByb3BzLGYuc3RhdGUsZi5jb250ZXh0KSxmLnN0YXRlPWYuX19zfXdoaWxlKGYuX19kJiYrK2s8MjUpO2Yuc3RhdGU9Zi5fX3MsbnVsbCE9Zi5nZXRDaGlsZENvbnRleHQmJihyPWcoZyh7fSxyKSxmLmdldENoaWxkQ29udGV4dCgpKSkscHx8bnVsbD09Zi5nZXRTbmFwc2hvdEJlZm9yZVVwZGF0ZXx8KF89Zi5nZXRTbmFwc2hvdEJlZm9yZVVwZGF0ZShkLGgpKSxDPW51bGwhPWwmJmwudHlwZT09PVMmJm51bGw9PWwua2V5P2wucHJvcHMuY2hpbGRyZW46bCxUKHQsQXJyYXkuaXNBcnJheShDKT9DOltDXSxuLGUscixvLGksdSxzLGEpLGYuYmFzZT1uLl9fZSxuLl9faD1udWxsLGYuX19oLmxlbmd0aCYmdS5wdXNoKGYpLG0mJihmLl9fRT1mLl9fPW51bGwpLGYuX19lPSExfWVsc2UgbnVsbD09aSYmbi5fX3Y9PT1lLl9fdj8obi5fX2s9ZS5fX2ssbi5fX2U9ZS5fX2UpOm4uX19lPVIoZS5fX2UsbixlLHIsbyxpLHUsYSk7KGw9Yy5kaWZmZWQpJiZsKG4pfWNhdGNoKHQpe24uX192PW51bGwsKGF8fG51bGwhPWkpJiYobi5fX2U9cyxuLl9faD0hIWEsaVtpLmluZGV4T2YocyldPW51bGwpLGMuX19lKHQsbixlKX19ZnVuY3Rpb24gRih0LG4pe2MuX19jJiZjLl9fYyhuLHQpLHQuc29tZShmdW5jdGlvbihuKXt0cnl7dD1uLl9faCxuLl9faD1bXSx0LnNvbWUoZnVuY3Rpb24odCl7dC5jYWxsKG4pfSl9Y2F0Y2godCl7Yy5fX2UodCxuLl9fdil9fSl9ZnVuY3Rpb24gUih0LG4sZSxyLG8saSx1LHMpe3ZhciBhLGMsZixwPWUucHJvcHMsZD1uLnByb3BzLGg9bi50eXBlLF89MDtpZihcInN2Z1wiPT09aCYmKG89ITApLG51bGwhPWkpZm9yKDtfPGkubGVuZ3RoO18rKylpZigoYT1pW19dKSYmXCJzZXRBdHRyaWJ1dGVcImluIGE9PSEhaCYmKGg/YS5sb2NhbE5hbWU9PT1oOjM9PT1hLm5vZGVUeXBlKSl7dD1hLGlbX109bnVsbDticmVha31pZihudWxsPT10KXtpZihudWxsPT09aClyZXR1cm4gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoZCk7dD1vP2RvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsaCk6ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChoLGQuaXMmJmQpLGk9bnVsbCxzPSExfWlmKG51bGw9PT1oKXA9PT1kfHxzJiZ0LmRhdGE9PT1kfHwodC5kYXRhPWQpO2Vsc2V7aWYoaT1pJiZsLmNhbGwodC5jaGlsZE5vZGVzKSxjPShwPWUucHJvcHN8fG0pLmRhbmdlcm91c2x5U2V0SW5uZXJIVE1MLGY9ZC5kYW5nZXJvdXNseVNldElubmVySFRNTCwhcyl7aWYobnVsbCE9aSlmb3IocD17fSxfPTA7Xzx0LmF0dHJpYnV0ZXMubGVuZ3RoO18rKylwW3QuYXR0cmlidXRlc1tfXS5uYW1lXT10LmF0dHJpYnV0ZXNbX10udmFsdWU7KGZ8fGMpJiYoZiYmKGMmJmYuX19odG1sPT1jLl9faHRtbHx8Zi5fX2h0bWw9PT10LmlubmVySFRNTCl8fCh0LmlubmVySFRNTD1mJiZmLl9faHRtbHx8XCJcIikpfWlmKGZ1bmN0aW9uKHQsbixlLHIsbyl7dmFyIGk7Zm9yKGkgaW4gZSlcImNoaWxkcmVuXCI9PT1pfHxcImtleVwiPT09aXx8aSBpbiBufHxIKHQsaSxudWxsLGVbaV0scik7Zm9yKGkgaW4gbilvJiZcImZ1bmN0aW9uXCIhPXR5cGVvZiBuW2ldfHxcImNoaWxkcmVuXCI9PT1pfHxcImtleVwiPT09aXx8XCJ2YWx1ZVwiPT09aXx8XCJjaGVja2VkXCI9PT1pfHxlW2ldPT09bltpXXx8SCh0LGksbltpXSxlW2ldLHIpfSh0LGQscCxvLHMpLGYpbi5fX2s9W107ZWxzZSBpZihfPW4ucHJvcHMuY2hpbGRyZW4sVCh0LEFycmF5LmlzQXJyYXkoXyk/XzpbX10sbixlLHIsbyYmXCJmb3JlaWduT2JqZWN0XCIhPT1oLGksdSxpP2lbMF06ZS5fX2smJlAoZSwwKSxzKSxudWxsIT1pKWZvcihfPWkubGVuZ3RoO18tLTspbnVsbCE9aVtfXSYmYihpW19dKTtzfHwoXCJ2YWx1ZVwiaW4gZCYmdm9pZCAwIT09KF89ZC52YWx1ZSkmJihfIT09dC52YWx1ZXx8XCJwcm9ncmVzc1wiPT09aCYmIV98fFwib3B0aW9uXCI9PT1oJiZfIT09cC52YWx1ZSkmJkgodCxcInZhbHVlXCIsXyxwLnZhbHVlLCExKSxcImNoZWNrZWRcImluIGQmJnZvaWQgMCE9PShfPWQuY2hlY2tlZCkmJl8hPT10LmNoZWNrZWQmJkgodCxcImNoZWNrZWRcIixfLHAuY2hlY2tlZCwhMSkpfXJldHVybiB0fWZ1bmN0aW9uIFUodCxuLGUpe3RyeXtcImZ1bmN0aW9uXCI9PXR5cGVvZiB0P3Qobik6dC5jdXJyZW50PW59Y2F0Y2godCl7Yy5fX2UodCxlKX19ZnVuY3Rpb24gVyh0LG4sZSl7dmFyIHIsbztpZihjLnVubW91bnQmJmMudW5tb3VudCh0KSwocj10LnJlZikmJihyLmN1cnJlbnQmJnIuY3VycmVudCE9PXQuX19lfHxVKHIsbnVsbCxuKSksbnVsbCE9KHI9dC5fX2MpKXtpZihyLmNvbXBvbmVudFdpbGxVbm1vdW50KXRyeXtyLmNvbXBvbmVudFdpbGxVbm1vdW50KCl9Y2F0Y2godCl7Yy5fX2UodCxuKX1yLmJhc2U9ci5fX1A9bnVsbCx0Ll9fYz12b2lkIDB9aWYocj10Ll9faylmb3Iobz0wO288ci5sZW5ndGg7bysrKXJbb10mJlcocltvXSxuLGV8fFwiZnVuY3Rpb25cIiE9dHlwZW9mIHQudHlwZSk7ZXx8bnVsbD09dC5fX2V8fGIodC5fX2UpLHQuX189dC5fX2U9dC5fX2Q9dm9pZCAwfWZ1bmN0aW9uIEIodCxuLGUpe3JldHVybiB0aGlzLmNvbnN0cnVjdG9yKHQsZSl9ZnVuY3Rpb24gcSh0LG4sZSl7dmFyIHIsbyxpO2MuX18mJmMuX18odCxuKSxvPShyPVwiZnVuY3Rpb25cIj09dHlwZW9mIGUpP251bGw6ZSYmZS5fX2t8fG4uX19rLGk9W10sTShuLHQ9KCFyJiZlfHxuKS5fX2s9dyhTLG51bGwsW3RdKSxvfHxtLG0sdm9pZCAwIT09bi5vd25lclNWR0VsZW1lbnQsIXImJmU/W2VdOm8/bnVsbDpuLmZpcnN0Q2hpbGQ/bC5jYWxsKG4uY2hpbGROb2Rlcyk6bnVsbCxpLCFyJiZlP2U6bz9vLl9fZTpuLmZpcnN0Q2hpbGQsciksRihpLHQpfWZ1bmN0aW9uIHooKXtyZXR1cm5cInh4eHh4eHh4LXh4eHgtNHh4eC15eHh4LXh4eHh4eHh4eHh4eFwiLnJlcGxhY2UoL1t4eV0vZyxmdW5jdGlvbih0KXt2YXIgbj0xNipNYXRoLnJhbmRvbSgpfDA7cmV0dXJuKFwieFwiPT10P246MyZufDgpLnRvU3RyaW5nKDE2KX0pfWw9di5zbGljZSxjPXtfX2U6ZnVuY3Rpb24odCxuLGUscil7Zm9yKHZhciBvLGksdTtuPW4uX187KWlmKChvPW4uX19jKSYmIW8uX18pdHJ5e2lmKChpPW8uY29uc3RydWN0b3IpJiZudWxsIT1pLmdldERlcml2ZWRTdGF0ZUZyb21FcnJvciYmKG8uc2V0U3RhdGUoaS5nZXREZXJpdmVkU3RhdGVGcm9tRXJyb3IodCkpLHU9by5fX2QpLG51bGwhPW8uY29tcG9uZW50RGlkQ2F0Y2gmJihvLmNvbXBvbmVudERpZENhdGNoKHQscnx8e30pLHU9by5fX2QpLHUpcmV0dXJuIG8uX19FPW99Y2F0Y2gobil7dD1ufXRocm93IHR9fSxmPTAscD1mdW5jdGlvbih0KXtyZXR1cm4gbnVsbCE9dCYmdm9pZCAwPT09dC5jb25zdHJ1Y3Rvcn0sTi5wcm90b3R5cGUuc2V0U3RhdGU9ZnVuY3Rpb24odCxuKXt2YXIgZTtlPW51bGwhPXRoaXMuX19zJiZ0aGlzLl9fcyE9PXRoaXMuc3RhdGU/dGhpcy5fX3M6dGhpcy5fX3M9Zyh7fSx0aGlzLnN0YXRlKSxcImZ1bmN0aW9uXCI9PXR5cGVvZiB0JiYodD10KGcoe30sZSksdGhpcy5wcm9wcykpLHQmJmcoZSx0KSxudWxsIT10JiZ0aGlzLl9fdiYmKG4mJnRoaXMuX3NiLnB1c2gobiksRSh0aGlzKSl9LE4ucHJvdG90eXBlLmZvcmNlVXBkYXRlPWZ1bmN0aW9uKHQpe3RoaXMuX192JiYodGhpcy5fX2U9ITAsdCYmdGhpcy5fX2gucHVzaCh0KSxFKHRoaXMpKX0sTi5wcm90b3R5cGUucmVuZGVyPVMsZD1bXSxJLl9fcj0wLF89MDt2YXIgVj0vKiNfX1BVUkVfXyovZnVuY3Rpb24oKXtmdW5jdGlvbiB0KHQpe3RoaXMuX2lkPXZvaWQgMCx0aGlzLl9pZD10fHx6KCl9cmV0dXJuIG4odCxbe2tleTpcImlkXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuX2lkfX1dKSx0fSgpO2Z1bmN0aW9uICQodCl7cmV0dXJuIHcodC5wYXJlbnRFbGVtZW50fHxcInNwYW5cIix7ZGFuZ2Vyb3VzbHlTZXRJbm5lckhUTUw6e19faHRtbDp0LmNvbnRlbnR9fSl9ZnVuY3Rpb24gRyh0LG4pe3JldHVybiB3KCQse2NvbnRlbnQ6dCxwYXJlbnRFbGVtZW50Om59KX12YXIgSyxYPS8qI19fUFVSRV9fKi9mdW5jdGlvbih0KXtmdW5jdGlvbiBuKG4pe3ZhciBlO3JldHVybihlPXQuY2FsbCh0aGlzKXx8dGhpcykuZGF0YT12b2lkIDAsZS51cGRhdGUobiksZX1yKG4sdCk7dmFyIGU9bi5wcm90b3R5cGU7cmV0dXJuIGUuY2FzdD1mdW5jdGlvbih0KXtyZXR1cm4gdCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50P0codC5vdXRlckhUTUwpOnR9LGUudXBkYXRlPWZ1bmN0aW9uKHQpe3JldHVybiB0aGlzLmRhdGE9dGhpcy5jYXN0KHQpLHRoaXN9LG59KFYpLFo9LyojX19QVVJFX18qL2Z1bmN0aW9uKHQpe2Z1bmN0aW9uIGUobil7dmFyIGU7cmV0dXJuKGU9dC5jYWxsKHRoaXMpfHx0aGlzKS5fY2VsbHM9dm9pZCAwLGUuY2VsbHM9bnx8W10sZX1yKGUsdCk7dmFyIG89ZS5wcm90b3R5cGU7cmV0dXJuIG8uY2VsbD1mdW5jdGlvbih0KXtyZXR1cm4gdGhpcy5fY2VsbHNbdF19LG8udG9BcnJheT1mdW5jdGlvbigpe3JldHVybiB0aGlzLmNlbGxzLm1hcChmdW5jdGlvbih0KXtyZXR1cm4gdC5kYXRhfSl9LGUuZnJvbUNlbGxzPWZ1bmN0aW9uKHQpe3JldHVybiBuZXcgZSh0Lm1hcChmdW5jdGlvbih0KXtyZXR1cm4gbmV3IFgodC5kYXRhKX0pKX0sbihlLFt7a2V5OlwiY2VsbHNcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5fY2VsbHN9LHNldDpmdW5jdGlvbih0KXt0aGlzLl9jZWxscz10fX0se2tleTpcImxlbmd0aFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLmNlbGxzLmxlbmd0aH19XSksZX0oViksSj0vKiNfX1BVUkVfXyovZnVuY3Rpb24odCl7ZnVuY3Rpb24gZShuKXt2YXIgZTtyZXR1cm4oZT10LmNhbGwodGhpcyl8fHRoaXMpLl9yb3dzPXZvaWQgMCxlLl9sZW5ndGg9dm9pZCAwLGUucm93cz1uIGluc3RhbmNlb2YgQXJyYXk/bjpuIGluc3RhbmNlb2YgWj9bbl06W10sZX1yZXR1cm4gcihlLHQpLGUucHJvdG90eXBlLnRvQXJyYXk9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5yb3dzLm1hcChmdW5jdGlvbih0KXtyZXR1cm4gdC50b0FycmF5KCl9KX0sZS5mcm9tUm93cz1mdW5jdGlvbih0KXtyZXR1cm4gbmV3IGUodC5tYXAoZnVuY3Rpb24odCl7cmV0dXJuIFouZnJvbUNlbGxzKHQuY2VsbHMpfSkpfSxlLmZyb21BcnJheT1mdW5jdGlvbih0KXtyZXR1cm4gbmV3IGUoKHQ9ZnVuY3Rpb24odCl7cmV0dXJuIXRbMF18fHRbMF1pbnN0YW5jZW9mIEFycmF5P3Q6W3RdfSh0KSkubWFwKGZ1bmN0aW9uKHQpe3JldHVybiBuZXcgWih0Lm1hcChmdW5jdGlvbih0KXtyZXR1cm4gbmV3IFgodCl9KSl9KSl9LG4oZSxbe2tleTpcInJvd3NcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5fcm93c30sc2V0OmZ1bmN0aW9uKHQpe3RoaXMuX3Jvd3M9dH19LHtrZXk6XCJsZW5ndGhcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5fbGVuZ3RofHx0aGlzLnJvd3MubGVuZ3RofSxzZXQ6ZnVuY3Rpb24odCl7dGhpcy5fbGVuZ3RoPXR9fV0pLGV9KFYpLFE9LyojX19QVVJFX18qL2Z1bmN0aW9uKCl7ZnVuY3Rpb24gdCgpe3RoaXMuY2FsbGJhY2tzPXZvaWQgMH12YXIgbj10LnByb3RvdHlwZTtyZXR1cm4gbi5pbml0PWZ1bmN0aW9uKHQpe3RoaXMuY2FsbGJhY2tzfHwodGhpcy5jYWxsYmFja3M9e30pLHQmJiF0aGlzLmNhbGxiYWNrc1t0XSYmKHRoaXMuY2FsbGJhY2tzW3RdPVtdKX0sbi5saXN0ZW5lcnM9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5jYWxsYmFja3N9LG4ub249ZnVuY3Rpb24odCxuKXtyZXR1cm4gdGhpcy5pbml0KHQpLHRoaXMuY2FsbGJhY2tzW3RdLnB1c2gobiksdGhpc30sbi5vZmY9ZnVuY3Rpb24odCxuKXt2YXIgZT10O3JldHVybiB0aGlzLmluaXQoKSx0aGlzLmNhbGxiYWNrc1tlXSYmMCE9PXRoaXMuY2FsbGJhY2tzW2VdLmxlbmd0aD8odGhpcy5jYWxsYmFja3NbZV09dGhpcy5jYWxsYmFja3NbZV0uZmlsdGVyKGZ1bmN0aW9uKHQpe3JldHVybiB0IT1ufSksdGhpcyk6dGhpc30sbi5lbWl0PWZ1bmN0aW9uKHQpe3ZhciBuPWFyZ3VtZW50cyxlPXQ7cmV0dXJuIHRoaXMuaW5pdChlKSx0aGlzLmNhbGxiYWNrc1tlXS5sZW5ndGg+MCYmKHRoaXMuY2FsbGJhY2tzW2VdLmZvckVhY2goZnVuY3Rpb24odCl7cmV0dXJuIHQuYXBwbHkodm9pZCAwLFtdLnNsaWNlLmNhbGwobiwxKSl9KSwhMCl9LHR9KCk7ZnVuY3Rpb24gWSh0LG4pe2lmKHR5cGVvZiB0IT10eXBlb2YgbilyZXR1cm4hMTtpZihudWxsPT09dCYmbnVsbD09PW4pcmV0dXJuITA7aWYoXCJvYmplY3RcIiE9dHlwZW9mIHQpcmV0dXJuIHQ9PT1uO2lmKEFycmF5LmlzQXJyYXkodCkmJkFycmF5LmlzQXJyYXkobikpe2lmKHQubGVuZ3RoIT09bi5sZW5ndGgpcmV0dXJuITE7Zm9yKHZhciBlPTA7ZTx0Lmxlbmd0aDtlKyspaWYoIVkodFtlXSxuW2VdKSlyZXR1cm4hMTtyZXR1cm4hMH1pZih0Lmhhc093blByb3BlcnR5KFwiY29uc3RydWN0b3JcIikmJm4uaGFzT3duUHJvcGVydHkoXCJjb25zdHJ1Y3RvclwiKSYmdC5oYXNPd25Qcm9wZXJ0eShcInByb3BzXCIpJiZuLmhhc093blByb3BlcnR5KFwicHJvcHNcIikmJnQuaGFzT3duUHJvcGVydHkoXCJrZXlcIikmJm4uaGFzT3duUHJvcGVydHkoXCJrZXlcIikmJnQuaGFzT3duUHJvcGVydHkoXCJyZWZcIikmJm4uaGFzT3duUHJvcGVydHkoXCJyZWZcIikmJnQuaGFzT3duUHJvcGVydHkoXCJ0eXBlXCIpJiZuLmhhc093blByb3BlcnR5KFwidHlwZVwiKSlyZXR1cm4gWSh0LnByb3BzLG4ucHJvcHMpO3ZhciByPU9iamVjdC5rZXlzKHQpLG89T2JqZWN0LmtleXMobik7aWYoci5sZW5ndGghPT1vLmxlbmd0aClyZXR1cm4hMTtmb3IodmFyIGk9MCx1PXI7aTx1Lmxlbmd0aDtpKyspe3ZhciBzPXVbaV07aWYoIW4uaGFzT3duUHJvcGVydHkocyl8fCFZKHRbc10sbltzXSkpcmV0dXJuITF9cmV0dXJuITB9IWZ1bmN0aW9uKHQpe3RbdC5Jbml0aWF0b3I9MF09XCJJbml0aWF0b3JcIix0W3QuU2VydmVyRmlsdGVyPTFdPVwiU2VydmVyRmlsdGVyXCIsdFt0LlNlcnZlclNvcnQ9Ml09XCJTZXJ2ZXJTb3J0XCIsdFt0LlNlcnZlckxpbWl0PTNdPVwiU2VydmVyTGltaXRcIix0W3QuRXh0cmFjdG9yPTRdPVwiRXh0cmFjdG9yXCIsdFt0LlRyYW5zZm9ybWVyPTVdPVwiVHJhbnNmb3JtZXJcIix0W3QuRmlsdGVyPTZdPVwiRmlsdGVyXCIsdFt0LlNvcnQ9N109XCJTb3J0XCIsdFt0LkxpbWl0PThdPVwiTGltaXRcIn0oS3x8KEs9e30pKTt2YXIgdHQ9LyojX19QVVJFX18qL2Z1bmN0aW9uKHQpe2Z1bmN0aW9uIG8obil7dmFyIGU7cmV0dXJuKGU9dC5jYWxsKHRoaXMpfHx0aGlzKS5pZD12b2lkIDAsZS5fcHJvcHM9dm9pZCAwLGUuX3Byb3BzPXt9LGUuaWQ9eigpLG4mJmUuc2V0UHJvcHMobiksZX1yKG8sdCk7dmFyIGk9by5wcm90b3R5cGU7cmV0dXJuIGkucHJvY2Vzcz1mdW5jdGlvbigpe3ZhciB0PVtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTt0aGlzLnZhbGlkYXRlUHJvcHMgaW5zdGFuY2VvZiBGdW5jdGlvbiYmdGhpcy52YWxpZGF0ZVByb3BzLmFwcGx5KHRoaXMsdCksdGhpcy5lbWl0LmFwcGx5KHRoaXMsW1wiYmVmb3JlUHJvY2Vzc1wiXS5jb25jYXQodCkpO3ZhciBuPXRoaXMuX3Byb2Nlc3MuYXBwbHkodGhpcyx0KTtyZXR1cm4gdGhpcy5lbWl0LmFwcGx5KHRoaXMsW1wiYWZ0ZXJQcm9jZXNzXCJdLmNvbmNhdCh0KSksbn0saS5zZXRQcm9wcz1mdW5jdGlvbih0KXt2YXIgbj1lKHt9LHRoaXMuX3Byb3BzLHQpO3JldHVybiBZKG4sdGhpcy5fcHJvcHMpfHwodGhpcy5fcHJvcHM9bix0aGlzLmVtaXQoXCJwcm9wc1VwZGF0ZWRcIix0aGlzKSksdGhpc30sbihvLFt7a2V5OlwicHJvcHNcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5fcHJvcHN9fV0pLG99KFEpLG50PS8qI19fUFVSRV9fKi9mdW5jdGlvbih0KXtmdW5jdGlvbiBlKCl7cmV0dXJuIHQuYXBwbHkodGhpcyxhcmd1bWVudHMpfHx0aGlzfXJldHVybiByKGUsdCksZS5wcm90b3R5cGUuX3Byb2Nlc3M9ZnVuY3Rpb24odCl7cmV0dXJuIHRoaXMucHJvcHMua2V5d29yZD8obj1TdHJpbmcodGhpcy5wcm9wcy5rZXl3b3JkKS50cmltKCksZT10aGlzLnByb3BzLmNvbHVtbnMscj10aGlzLnByb3BzLmlnbm9yZUhpZGRlbkNvbHVtbnMsbz10LGk9dGhpcy5wcm9wcy5zZWxlY3RvcixuPW4ucmVwbGFjZSgvWy1bXFxde30oKSorPy4sXFxcXF4kfCNcXHNdL2csXCJcXFxcJCZcIiksbmV3IEooby5yb3dzLmZpbHRlcihmdW5jdGlvbih0LG8pe3JldHVybiB0LmNlbGxzLnNvbWUoZnVuY3Rpb24odCx1KXtpZighdClyZXR1cm4hMTtpZihyJiZlJiZlW3VdJiZcIm9iamVjdFwiPT10eXBlb2YgZVt1XSYmZVt1XS5oaWRkZW4pcmV0dXJuITE7dmFyIHM9XCJcIjtpZihcImZ1bmN0aW9uXCI9PXR5cGVvZiBpKXM9aSh0LmRhdGEsbyx1KTtlbHNlIGlmKFwib2JqZWN0XCI9PXR5cGVvZiB0LmRhdGEpe3ZhciBhPXQuZGF0YTthJiZhLnByb3BzJiZhLnByb3BzLmNvbnRlbnQmJihzPWEucHJvcHMuY29udGVudCl9ZWxzZSBzPVN0cmluZyh0LmRhdGEpO3JldHVybiBuZXcgUmVnRXhwKG4sXCJnaVwiKS50ZXN0KHMpfSl9KSkpOnQ7dmFyIG4sZSxyLG8saX0sbihlLFt7a2V5OlwidHlwZVwiLGdldDpmdW5jdGlvbigpe3JldHVybiBLLkZpbHRlcn19XSksZX0odHQpO2Z1bmN0aW9uIGV0KCl7dmFyIHQ9XCJncmlkanNcIjtyZXR1cm5cIlwiK3QrW10uc2xpY2UuY2FsbChhcmd1bWVudHMpLnJlZHVjZShmdW5jdGlvbih0LG4pe3JldHVybiB0K1wiLVwiK259LFwiXCIpfWZ1bmN0aW9uIHJ0KCl7cmV0dXJuW10uc2xpY2UuY2FsbChhcmd1bWVudHMpLm1hcChmdW5jdGlvbih0KXtyZXR1cm4gdD90LnRvU3RyaW5nKCk6XCJcIn0pLmZpbHRlcihmdW5jdGlvbih0KXtyZXR1cm4gdH0pLnJlZHVjZShmdW5jdGlvbih0LG4pe3JldHVybih0fHxcIlwiKStcIiBcIitufSxcIlwiKS50cmltKCl9dmFyIG90LGl0LHV0LHN0LGF0PS8qI19fUFVSRV9fKi9mdW5jdGlvbih0KXtmdW5jdGlvbiBvKCl7cmV0dXJuIHQuYXBwbHkodGhpcyxhcmd1bWVudHMpfHx0aGlzfXJldHVybiByKG8sdCksby5wcm90b3R5cGUuX3Byb2Nlc3M9ZnVuY3Rpb24odCl7aWYoIXRoaXMucHJvcHMua2V5d29yZClyZXR1cm4gdDt2YXIgbj17fTtyZXR1cm4gdGhpcy5wcm9wcy51cmwmJihuLnVybD10aGlzLnByb3BzLnVybCh0LnVybCx0aGlzLnByb3BzLmtleXdvcmQpKSx0aGlzLnByb3BzLmJvZHkmJihuLmJvZHk9dGhpcy5wcm9wcy5ib2R5KHQuYm9keSx0aGlzLnByb3BzLmtleXdvcmQpKSxlKHt9LHQsbil9LG4obyxbe2tleTpcInR5cGVcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gSy5TZXJ2ZXJGaWx0ZXJ9fV0pLG99KHR0KSxsdD0wLGN0PVtdLGZ0PVtdLHB0PWMuX19iLGR0PWMuX19yLGh0PWMuZGlmZmVkLF90PWMuX19jLG10PWMudW5tb3VudDtmdW5jdGlvbiB2dCh0LG4pe2MuX19oJiZjLl9faChpdCx0LGx0fHxuKSxsdD0wO3ZhciBlPWl0Ll9fSHx8KGl0Ll9fSD17X186W10sX19oOltdfSk7cmV0dXJuIHQ+PWUuX18ubGVuZ3RoJiZlLl9fLnB1c2goe19fVjpmdH0pLGUuX19bdF19ZnVuY3Rpb24geXQodCl7cmV0dXJuIGx0PTEsZnVuY3Rpb24odCxuLGUpe3ZhciByPXZ0KG90KyssMik7aWYoci50PXQsIXIuX19jJiYoci5fXz1bRXQodm9pZCAwLG4pLGZ1bmN0aW9uKHQpe3ZhciBuPXIuX19OP3IuX19OWzBdOnIuX19bMF0sZT1yLnQobix0KTtuIT09ZSYmKHIuX19OPVtlLHIuX19bMV1dLHIuX19jLnNldFN0YXRlKHt9KSl9XSxyLl9fYz1pdCwhaXQudSkpe2l0LnU9ITA7dmFyIG89aXQuc2hvdWxkQ29tcG9uZW50VXBkYXRlO2l0LnNob3VsZENvbXBvbmVudFVwZGF0ZT1mdW5jdGlvbih0LG4sZSl7aWYoIXIuX19jLl9fSClyZXR1cm4hMDt2YXIgaT1yLl9fYy5fX0guX18uZmlsdGVyKGZ1bmN0aW9uKHQpe3JldHVybiB0Ll9fY30pO2lmKGkuZXZlcnkoZnVuY3Rpb24odCl7cmV0dXJuIXQuX19OfSkpcmV0dXJuIW98fG8uY2FsbCh0aGlzLHQsbixlKTt2YXIgdT0hMTtyZXR1cm4gaS5mb3JFYWNoKGZ1bmN0aW9uKHQpe2lmKHQuX19OKXt2YXIgbj10Ll9fWzBdO3QuX189dC5fX04sdC5fX049dm9pZCAwLG4hPT10Ll9fWzBdJiYodT0hMCl9fSksISghdSYmci5fX2MucHJvcHM9PT10KSYmKCFvfHxvLmNhbGwodGhpcyx0LG4sZSkpfX1yZXR1cm4gci5fX058fHIuX199KEV0LHQpfWZ1bmN0aW9uIGd0KHQsbil7dmFyIGU9dnQob3QrKywzKTshYy5fX3MmJkN0KGUuX19ILG4pJiYoZS5fXz10LGUuaT1uLGl0Ll9fSC5fX2gucHVzaChlKSl9ZnVuY3Rpb24gYnQodCl7cmV0dXJuIGx0PTUsd3QoZnVuY3Rpb24oKXtyZXR1cm57Y3VycmVudDp0fX0sW10pfWZ1bmN0aW9uIHd0KHQsbil7dmFyIGU9dnQob3QrKyw3KTtyZXR1cm4gQ3QoZS5fX0gsbik/KGUuX19WPXQoKSxlLmk9bixlLl9faD10LGUuX19WKTplLl9ffWZ1bmN0aW9uIHh0KCl7Zm9yKHZhciB0O3Q9Y3Quc2hpZnQoKTspaWYodC5fX1AmJnQuX19IKXRyeXt0Ll9fSC5fX2guZm9yRWFjaChOdCksdC5fX0guX19oLmZvckVhY2goUHQpLHQuX19ILl9faD1bXX1jYXRjaChuKXt0Ll9fSC5fX2g9W10sYy5fX2Uobix0Ll9fdil9fWMuX19iPWZ1bmN0aW9uKHQpe2l0PW51bGwscHQmJnB0KHQpfSxjLl9fcj1mdW5jdGlvbih0KXtkdCYmZHQodCksb3Q9MDt2YXIgbj0oaXQ9dC5fX2MpLl9fSDtuJiYodXQ9PT1pdD8obi5fX2g9W10saXQuX19oPVtdLG4uX18uZm9yRWFjaChmdW5jdGlvbih0KXt0Ll9fTiYmKHQuX189dC5fX04pLHQuX19WPWZ0LHQuX19OPXQuaT12b2lkIDB9KSk6KG4uX19oLmZvckVhY2goTnQpLG4uX19oLmZvckVhY2goUHQpLG4uX19oPVtdKSksdXQ9aXR9LGMuZGlmZmVkPWZ1bmN0aW9uKHQpe2h0JiZodCh0KTt2YXIgbj10Ll9fYztuJiZuLl9fSCYmKG4uX19ILl9faC5sZW5ndGgmJigxIT09Y3QucHVzaChuKSYmc3Q9PT1jLnJlcXVlc3RBbmltYXRpb25GcmFtZXx8KChzdD1jLnJlcXVlc3RBbmltYXRpb25GcmFtZSl8fFN0KSh4dCkpLG4uX19ILl9fLmZvckVhY2goZnVuY3Rpb24odCl7dC5pJiYodC5fX0g9dC5pKSx0Ll9fViE9PWZ0JiYodC5fXz10Ll9fViksdC5pPXZvaWQgMCx0Ll9fVj1mdH0pKSx1dD1pdD1udWxsfSxjLl9fYz1mdW5jdGlvbih0LG4pe24uc29tZShmdW5jdGlvbih0KXt0cnl7dC5fX2guZm9yRWFjaChOdCksdC5fX2g9dC5fX2guZmlsdGVyKGZ1bmN0aW9uKHQpe3JldHVybiF0Ll9ffHxQdCh0KX0pfWNhdGNoKGUpe24uc29tZShmdW5jdGlvbih0KXt0Ll9faCYmKHQuX19oPVtdKX0pLG49W10sYy5fX2UoZSx0Ll9fdil9fSksX3QmJl90KHQsbil9LGMudW5tb3VudD1mdW5jdGlvbih0KXttdCYmbXQodCk7dmFyIG4sZT10Ll9fYztlJiZlLl9fSCYmKGUuX19ILl9fLmZvckVhY2goZnVuY3Rpb24odCl7dHJ5e050KHQpfWNhdGNoKHQpe249dH19KSxlLl9fSD12b2lkIDAsbiYmYy5fX2UobixlLl9fdikpfTt2YXIga3Q9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWVzdEFuaW1hdGlvbkZyYW1lO2Z1bmN0aW9uIFN0KHQpe3ZhciBuLGU9ZnVuY3Rpb24oKXtjbGVhclRpbWVvdXQociksa3QmJmNhbmNlbEFuaW1hdGlvbkZyYW1lKG4pLHNldFRpbWVvdXQodCl9LHI9c2V0VGltZW91dChlLDEwMCk7a3QmJihuPXJlcXVlc3RBbmltYXRpb25GcmFtZShlKSl9ZnVuY3Rpb24gTnQodCl7dmFyIG49aXQsZT10Ll9fYztcImZ1bmN0aW9uXCI9PXR5cGVvZiBlJiYodC5fX2M9dm9pZCAwLGUoKSksaXQ9bn1mdW5jdGlvbiBQdCh0KXt2YXIgbj1pdDt0Ll9fYz10Ll9fKCksaXQ9bn1mdW5jdGlvbiBDdCh0LG4pe3JldHVybiF0fHx0Lmxlbmd0aCE9PW4ubGVuZ3RofHxuLnNvbWUoZnVuY3Rpb24obixlKXtyZXR1cm4gbiE9PXRbZV19KX1mdW5jdGlvbiBFdCh0LG4pe3JldHVyblwiZnVuY3Rpb25cIj09dHlwZW9mIG4/bih0KTpufWZ1bmN0aW9uIEl0KCl7cmV0dXJuIGZ1bmN0aW9uKHQpe3ZhciBuPWl0LmNvbnRleHRbdC5fX2NdLGU9dnQob3QrKyw5KTtyZXR1cm4gZS5jPXQsbj8obnVsbD09ZS5fXyYmKGUuX189ITAsbi5zdWIoaXQpKSxuLnByb3BzLnZhbHVlKTp0Ll9ffShmbil9dmFyIFR0PXtzZWFyY2g6e3BsYWNlaG9sZGVyOlwiVHlwZSBhIGtleXdvcmQuLi5cIn0sc29ydDp7c29ydEFzYzpcIlNvcnQgY29sdW1uIGFzY2VuZGluZ1wiLHNvcnREZXNjOlwiU29ydCBjb2x1bW4gZGVzY2VuZGluZ1wifSxwYWdpbmF0aW9uOntwcmV2aW91czpcIlByZXZpb3VzXCIsbmV4dDpcIk5leHRcIixuYXZpZ2F0ZTpmdW5jdGlvbih0LG4pe3JldHVyblwiUGFnZSBcIit0K1wiIG9mIFwiK259LHBhZ2U6ZnVuY3Rpb24odCl7cmV0dXJuXCJQYWdlIFwiK3R9LHNob3dpbmc6XCJTaG93aW5nXCIsb2Y6XCJvZlwiLHRvOlwidG9cIixyZXN1bHRzOlwicmVzdWx0c1wifSxsb2FkaW5nOlwiTG9hZGluZy4uLlwiLG5vUmVjb3Jkc0ZvdW5kOlwiTm8gbWF0Y2hpbmcgcmVjb3JkcyBmb3VuZFwiLGVycm9yOlwiQW4gZXJyb3IgaGFwcGVuZWQgd2hpbGUgZmV0Y2hpbmcgdGhlIGRhdGFcIn0sTHQ9LyojX19QVVJFX18qL2Z1bmN0aW9uKCl7ZnVuY3Rpb24gdCh0KXt0aGlzLl9sYW5ndWFnZT12b2lkIDAsdGhpcy5fZGVmYXVsdExhbmd1YWdlPXZvaWQgMCx0aGlzLl9sYW5ndWFnZT10LHRoaXMuX2RlZmF1bHRMYW5ndWFnZT1UdH12YXIgbj10LnByb3RvdHlwZTtyZXR1cm4gbi5nZXRTdHJpbmc9ZnVuY3Rpb24odCxuKXtpZighbnx8IXQpcmV0dXJuIG51bGw7dmFyIGU9dC5zcGxpdChcIi5cIikscj1lWzBdO2lmKG5bcl0pe3ZhciBvPW5bcl07cmV0dXJuXCJzdHJpbmdcIj09dHlwZW9mIG8/ZnVuY3Rpb24oKXtyZXR1cm4gb306XCJmdW5jdGlvblwiPT10eXBlb2Ygbz9vOnRoaXMuZ2V0U3RyaW5nKGUuc2xpY2UoMSkuam9pbihcIi5cIiksbyl9cmV0dXJuIG51bGx9LG4udHJhbnNsYXRlPWZ1bmN0aW9uKHQpe3ZhciBuLGU9dGhpcy5nZXRTdHJpbmcodCx0aGlzLl9sYW5ndWFnZSk7cmV0dXJuKG49ZXx8dGhpcy5nZXRTdHJpbmcodCx0aGlzLl9kZWZhdWx0TGFuZ3VhZ2UpKT9uLmFwcGx5KHZvaWQgMCxbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywxKSk6dH0sdH0oKTtmdW5jdGlvbiBBdCgpe3ZhciB0PUl0KCk7cmV0dXJuIGZ1bmN0aW9uKG4pe3ZhciBlO3JldHVybihlPXQudHJhbnNsYXRvcikudHJhbnNsYXRlLmFwcGx5KGUsW25dLmNvbmNhdChbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywxKSkpfX12YXIgT3Q9ZnVuY3Rpb24odCl7cmV0dXJuIGZ1bmN0aW9uKG4pe3JldHVybiBlKHt9LG4se3NlYXJjaDp7a2V5d29yZDp0fX0pfX07ZnVuY3Rpb24gSHQoKXtyZXR1cm4gSXQoKS5zdG9yZX1mdW5jdGlvbiBqdCh0KXt2YXIgbj1IdCgpLGU9eXQodChuLmdldFN0YXRlKCkpKSxyPWVbMF0sbz1lWzFdO3JldHVybiBndChmdW5jdGlvbigpe3JldHVybiBuLnN1YnNjcmliZShmdW5jdGlvbigpe3ZhciBlPXQobi5nZXRTdGF0ZSgpKTtyIT09ZSYmbyhlKX0pfSxbXSkscn1mdW5jdGlvbiBEdCgpe3ZhciB0LG49eXQodm9pZCAwKSxlPW5bMF0scj1uWzFdLG89SXQoKSxpPW8uc2VhcmNoLHU9QXQoKSxzPUh0KCkuZGlzcGF0Y2gsYT1qdChmdW5jdGlvbih0KXtyZXR1cm4gdC5zZWFyY2h9KTtndChmdW5jdGlvbigpe2UmJmUuc2V0UHJvcHMoe2tleXdvcmQ6bnVsbD09YT92b2lkIDA6YS5rZXl3b3JkfSl9LFthLGVdKSxndChmdW5jdGlvbigpe3IoaS5zZXJ2ZXI/bmV3IGF0KHtrZXl3b3JkOmkua2V5d29yZCx1cmw6aS5zZXJ2ZXIudXJsLGJvZHk6aS5zZXJ2ZXIuYm9keX0pOm5ldyBudCh7a2V5d29yZDppLmtleXdvcmQsY29sdW1uczpvLmhlYWRlciYmby5oZWFkZXIuY29sdW1ucyxpZ25vcmVIaWRkZW5Db2x1bW5zOmkuaWdub3JlSGlkZGVuQ29sdW1uc3x8dm9pZCAwPT09aS5pZ25vcmVIaWRkZW5Db2x1bW5zLHNlbGVjdG9yOmkuc2VsZWN0b3J9KSksaS5rZXl3b3JkJiZzKE90KGkua2V5d29yZCkpfSxbaV0pLGd0KGZ1bmN0aW9uKCl7aWYoZSlyZXR1cm4gby5waXBlbGluZS5yZWdpc3RlcihlKSxmdW5jdGlvbigpe3JldHVybiBvLnBpcGVsaW5lLnVucmVnaXN0ZXIoZSl9fSxbbyxlXSk7dmFyIGwsYyxmLHA9ZnVuY3Rpb24odCxuKXtyZXR1cm4gbHQ9OCx3dChmdW5jdGlvbigpe3JldHVybiB0fSxuKX0oKGw9ZnVuY3Rpb24odCl7dC50YXJnZXQgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50JiZzKE90KHQudGFyZ2V0LnZhbHVlKSl9LGM9ZSBpbnN0YW5jZW9mIGF0P2kuZGVib3VuY2VUaW1lb3V0fHwyNTA6MCxmdW5jdGlvbigpe3ZhciB0PWFyZ3VtZW50cztyZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24obil7ZiYmY2xlYXJUaW1lb3V0KGYpLGY9c2V0VGltZW91dChmdW5jdGlvbigpe3JldHVybiBuKGwuYXBwbHkodm9pZCAwLFtdLnNsaWNlLmNhbGwodCkpKX0sYyl9KX0pLFtpLGVdKTtyZXR1cm4gdyhcImRpdlwiLHtjbGFzc05hbWU6ZXQocnQoXCJzZWFyY2hcIixudWxsPT0odD1vLmNsYXNzTmFtZSk/dm9pZCAwOnQuc2VhcmNoKSl9LHcoXCJpbnB1dFwiLHt0eXBlOlwic2VhcmNoXCIscGxhY2Vob2xkZXI6dShcInNlYXJjaC5wbGFjZWhvbGRlclwiKSxcImFyaWEtbGFiZWxcIjp1KFwic2VhcmNoLnBsYWNlaG9sZGVyXCIpLG9uSW5wdXQ6cCxjbGFzc05hbWU6cnQoZXQoXCJpbnB1dFwiKSxldChcInNlYXJjaFwiLFwiaW5wdXRcIikpLGRlZmF1bHRWYWx1ZToobnVsbD09YT92b2lkIDA6YS5rZXl3b3JkKXx8XCJcIn0pKX12YXIgTXQ9LyojX19QVVJFX18qL2Z1bmN0aW9uKHQpe2Z1bmN0aW9uIGUoKXtyZXR1cm4gdC5hcHBseSh0aGlzLGFyZ3VtZW50cyl8fHRoaXN9cihlLHQpO3ZhciBvPWUucHJvdG90eXBlO3JldHVybiBvLnZhbGlkYXRlUHJvcHM9ZnVuY3Rpb24oKXtpZihpc05hTihOdW1iZXIodGhpcy5wcm9wcy5saW1pdCkpfHxpc05hTihOdW1iZXIodGhpcy5wcm9wcy5wYWdlKSkpdGhyb3cgRXJyb3IoXCJJbnZhbGlkIHBhcmFtZXRlcnMgcGFzc2VkXCIpfSxvLl9wcm9jZXNzPWZ1bmN0aW9uKHQpe3ZhciBuPXRoaXMucHJvcHMucGFnZTtyZXR1cm4gbmV3IEoodC5yb3dzLnNsaWNlKG4qdGhpcy5wcm9wcy5saW1pdCwobisxKSp0aGlzLnByb3BzLmxpbWl0KSl9LG4oZSxbe2tleTpcInR5cGVcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gSy5MaW1pdH19XSksZX0odHQpLEZ0PS8qI19fUFVSRV9fKi9mdW5jdGlvbih0KXtmdW5jdGlvbiBvKCl7cmV0dXJuIHQuYXBwbHkodGhpcyxhcmd1bWVudHMpfHx0aGlzfXJldHVybiByKG8sdCksby5wcm90b3R5cGUuX3Byb2Nlc3M9ZnVuY3Rpb24odCl7dmFyIG49e307cmV0dXJuIHRoaXMucHJvcHMudXJsJiYobi51cmw9dGhpcy5wcm9wcy51cmwodC51cmwsdGhpcy5wcm9wcy5wYWdlLHRoaXMucHJvcHMubGltaXQpKSx0aGlzLnByb3BzLmJvZHkmJihuLmJvZHk9dGhpcy5wcm9wcy5ib2R5KHQuYm9keSx0aGlzLnByb3BzLnBhZ2UsdGhpcy5wcm9wcy5saW1pdCkpLGUoe30sdCxuKX0sbihvLFt7a2V5OlwidHlwZVwiLGdldDpmdW5jdGlvbigpe3JldHVybiBLLlNlcnZlckxpbWl0fX1dKSxvfSh0dCk7ZnVuY3Rpb24gUnQoKXt2YXIgdD1JdCgpLG49dC5wYWdpbmF0aW9uLGU9bi5zZXJ2ZXIscj1uLnN1bW1hcnksbz12b2lkIDA9PT1yfHxyLGk9bi5uZXh0QnV0dG9uLHU9dm9pZCAwPT09aXx8aSxzPW4ucHJldkJ1dHRvbixhPXZvaWQgMD09PXN8fHMsbD1uLmJ1dHRvbnNDb3VudCxjPXZvaWQgMD09PWw/MzpsLGY9bi5saW1pdCxwPXZvaWQgMD09PWY/MTA6ZixkPW4ucGFnZSxoPXZvaWQgMD09PWQ/MDpkLF89bi5yZXNldFBhZ2VPblVwZGF0ZSxtPXZvaWQgMD09PV98fF8sdj1idChudWxsKSx5PXl0KGgpLGc9eVswXSxiPXlbMV0seD15dCgwKSxrPXhbMF0sTj14WzFdLFA9QXQoKTtndChmdW5jdGlvbigpe3JldHVybiBlPyh2LmN1cnJlbnQ9bmV3IEZ0KHtsaW1pdDpwLHBhZ2U6Zyx1cmw6ZS51cmwsYm9keTplLmJvZHl9KSx0LnBpcGVsaW5lLnJlZ2lzdGVyKHYuY3VycmVudCkpOih2LmN1cnJlbnQ9bmV3IE10KHtsaW1pdDpwLHBhZ2U6Z30pLHQucGlwZWxpbmUucmVnaXN0ZXIodi5jdXJyZW50KSksdi5jdXJyZW50IGluc3RhbmNlb2YgRnQ/dC5waXBlbGluZS5vbihcImFmdGVyUHJvY2Vzc1wiLGZ1bmN0aW9uKHQpe3JldHVybiBOKHQubGVuZ3RoKX0pOnYuY3VycmVudCBpbnN0YW5jZW9mIE10JiZ2LmN1cnJlbnQub24oXCJiZWZvcmVQcm9jZXNzXCIsZnVuY3Rpb24odCl7cmV0dXJuIE4odC5sZW5ndGgpfSksdC5waXBlbGluZS5vbihcInVwZGF0ZWRcIixDKSx0LnBpcGVsaW5lLm9uKFwiZXJyb3JcIixmdW5jdGlvbigpe04oMCksYigwKX0pLGZ1bmN0aW9uKCl7dC5waXBlbGluZS51bnJlZ2lzdGVyKHYuY3VycmVudCksdC5waXBlbGluZS5vZmYoXCJ1cGRhdGVkXCIsQyl9fSxbXSk7dmFyIEM9ZnVuY3Rpb24odCl7bSYmdCE9PXYuY3VycmVudCYmKGIoMCksMCE9PXYuY3VycmVudC5wcm9wcy5wYWdlJiZ2LmN1cnJlbnQuc2V0UHJvcHMoe3BhZ2U6MH0pKX0sRT1mdW5jdGlvbigpe3JldHVybiBNYXRoLmNlaWwoay9wKX0sST1mdW5jdGlvbih0KXtpZih0Pj1FKCl8fHQ8MHx8dD09PWcpcmV0dXJuIG51bGw7Yih0KSx2LmN1cnJlbnQuc2V0UHJvcHMoe3BhZ2U6dH0pfTtyZXR1cm4gdyhcImRpdlwiLHtjbGFzc05hbWU6cnQoZXQoXCJwYWdpbmF0aW9uXCIpLHQuY2xhc3NOYW1lLnBhZ2luYXRpb24pfSx3KFMsbnVsbCxvJiZrPjAmJncoXCJkaXZcIix7cm9sZTpcInN0YXR1c1wiLFwiYXJpYS1saXZlXCI6XCJwb2xpdGVcIixjbGFzc05hbWU6cnQoZXQoXCJzdW1tYXJ5XCIpLHQuY2xhc3NOYW1lLnBhZ2luYXRpb25TdW1tYXJ5KSx0aXRsZTpQKFwicGFnaW5hdGlvbi5uYXZpZ2F0ZVwiLGcrMSxFKCkpfSxQKFwicGFnaW5hdGlvbi5zaG93aW5nXCIpLFwiIFwiLHcoXCJiXCIsbnVsbCxQKFwiXCIrKGcqcCsxKSkpLFwiIFwiLFAoXCJwYWdpbmF0aW9uLnRvXCIpLFwiIFwiLHcoXCJiXCIsbnVsbCxQKFwiXCIrTWF0aC5taW4oKGcrMSkqcCxrKSkpLFwiIFwiLFAoXCJwYWdpbmF0aW9uLm9mXCIpLFwiIFwiLHcoXCJiXCIsbnVsbCxQKFwiXCIraykpLFwiIFwiLFAoXCJwYWdpbmF0aW9uLnJlc3VsdHNcIikpKSx3KFwiZGl2XCIse2NsYXNzTmFtZTpldChcInBhZ2VzXCIpfSxhJiZ3KFwiYnV0dG9uXCIse3RhYkluZGV4OjAscm9sZTpcImJ1dHRvblwiLGRpc2FibGVkOjA9PT1nLG9uQ2xpY2s6ZnVuY3Rpb24oKXtyZXR1cm4gSShnLTEpfSx0aXRsZTpQKFwicGFnaW5hdGlvbi5wcmV2aW91c1wiKSxcImFyaWEtbGFiZWxcIjpQKFwicGFnaW5hdGlvbi5wcmV2aW91c1wiKSxjbGFzc05hbWU6cnQodC5jbGFzc05hbWUucGFnaW5hdGlvbkJ1dHRvbix0LmNsYXNzTmFtZS5wYWdpbmF0aW9uQnV0dG9uUHJldil9LFAoXCJwYWdpbmF0aW9uLnByZXZpb3VzXCIpKSxmdW5jdGlvbigpe2lmKGM8PTApcmV0dXJuIG51bGw7dmFyIG49TWF0aC5taW4oRSgpLGMpLGU9TWF0aC5taW4oZyxNYXRoLmZsb29yKG4vMikpO3JldHVybiBnK01hdGguZmxvb3Iobi8yKT49RSgpJiYoZT1uLShFKCktZykpLHcoUyxudWxsLEUoKT5uJiZnLWU+MCYmdyhTLG51bGwsdyhcImJ1dHRvblwiLHt0YWJJbmRleDowLHJvbGU6XCJidXR0b25cIixvbkNsaWNrOmZ1bmN0aW9uKCl7cmV0dXJuIEkoMCl9LHRpdGxlOlAoXCJwYWdpbmF0aW9uLmZpcnN0UGFnZVwiKSxcImFyaWEtbGFiZWxcIjpQKFwicGFnaW5hdGlvbi5maXJzdFBhZ2VcIiksY2xhc3NOYW1lOnQuY2xhc3NOYW1lLnBhZ2luYXRpb25CdXR0b259LFAoXCIxXCIpKSx3KFwiYnV0dG9uXCIse3RhYkluZGV4Oi0xLGNsYXNzTmFtZTpydChldChcInNwcmVhZFwiKSx0LmNsYXNzTmFtZS5wYWdpbmF0aW9uQnV0dG9uKX0sXCIuLi5cIikpLEFycmF5LmZyb20oQXJyYXkobikua2V5cygpKS5tYXAoZnVuY3Rpb24odCl7cmV0dXJuIGcrKHQtZSl9KS5tYXAoZnVuY3Rpb24obil7cmV0dXJuIHcoXCJidXR0b25cIix7dGFiSW5kZXg6MCxyb2xlOlwiYnV0dG9uXCIsb25DbGljazpmdW5jdGlvbigpe3JldHVybiBJKG4pfSxjbGFzc05hbWU6cnQoZz09PW4/cnQoZXQoXCJjdXJyZW50UGFnZVwiKSx0LmNsYXNzTmFtZS5wYWdpbmF0aW9uQnV0dG9uQ3VycmVudCk6bnVsbCx0LmNsYXNzTmFtZS5wYWdpbmF0aW9uQnV0dG9uKSx0aXRsZTpQKFwicGFnaW5hdGlvbi5wYWdlXCIsbisxKSxcImFyaWEtbGFiZWxcIjpQKFwicGFnaW5hdGlvbi5wYWdlXCIsbisxKX0sUChcIlwiKyhuKzEpKSl9KSxFKCk+biYmRSgpPmcrZSsxJiZ3KFMsbnVsbCx3KFwiYnV0dG9uXCIse3RhYkluZGV4Oi0xLGNsYXNzTmFtZTpydChldChcInNwcmVhZFwiKSx0LmNsYXNzTmFtZS5wYWdpbmF0aW9uQnV0dG9uKX0sXCIuLi5cIiksdyhcImJ1dHRvblwiLHt0YWJJbmRleDowLHJvbGU6XCJidXR0b25cIixvbkNsaWNrOmZ1bmN0aW9uKCl7cmV0dXJuIEkoRSgpLTEpfSx0aXRsZTpQKFwicGFnaW5hdGlvbi5wYWdlXCIsRSgpKSxcImFyaWEtbGFiZWxcIjpQKFwicGFnaW5hdGlvbi5wYWdlXCIsRSgpKSxjbGFzc05hbWU6dC5jbGFzc05hbWUucGFnaW5hdGlvbkJ1dHRvbn0sUChcIlwiK0UoKSkpKSl9KCksdSYmdyhcImJ1dHRvblwiLHt0YWJJbmRleDowLHJvbGU6XCJidXR0b25cIixkaXNhYmxlZDpFKCk9PT1nKzF8fDA9PT1FKCksb25DbGljazpmdW5jdGlvbigpe3JldHVybiBJKGcrMSl9LHRpdGxlOlAoXCJwYWdpbmF0aW9uLm5leHRcIiksXCJhcmlhLWxhYmVsXCI6UChcInBhZ2luYXRpb24ubmV4dFwiKSxjbGFzc05hbWU6cnQodC5jbGFzc05hbWUucGFnaW5hdGlvbkJ1dHRvbix0LmNsYXNzTmFtZS5wYWdpbmF0aW9uQnV0dG9uTmV4dCl9LFAoXCJwYWdpbmF0aW9uLm5leHRcIikpKSl9ZnVuY3Rpb24gVXQodCxuKXtyZXR1cm5cInN0cmluZ1wiPT10eXBlb2YgdD90LmluZGV4T2YoXCIlXCIpPi0xP24vMTAwKnBhcnNlSW50KHQsMTApOnBhcnNlSW50KHQsMTApOnR9ZnVuY3Rpb24gV3QodCl7cmV0dXJuIHQ/TWF0aC5mbG9vcih0KStcInB4XCI6XCJcIn1mdW5jdGlvbiBCdCh0KXt2YXIgbj10LnRhYmxlUmVmLmNsb25lTm9kZSghMCk7cmV0dXJuIG4uc3R5bGUucG9zaXRpb249XCJhYnNvbHV0ZVwiLG4uc3R5bGUud2lkdGg9XCIxMDAlXCIsbi5zdHlsZS56SW5kZXg9XCItMjE0NzQ4MzY0MFwiLG4uc3R5bGUudmlzaWJpbGl0eT1cImhpZGRlblwiLHcoXCJkaXZcIix7cmVmOmZ1bmN0aW9uKHQpe3QmJnQuYXBwZW5kQ2hpbGQobil9fSl9ZnVuY3Rpb24gcXQodCl7aWYoIXQpcmV0dXJuXCJcIjt2YXIgbj10LnNwbGl0KFwiIFwiKTtyZXR1cm4gMT09PW4ubGVuZ3RoJiYvKFthLXpdW0EtWl0pKy9nLnRlc3QodCk/dDpuLm1hcChmdW5jdGlvbih0LG4pe3JldHVybiAwPT1uP3QudG9Mb3dlckNhc2UoKTp0LmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpK3Quc2xpY2UoMSkudG9Mb3dlckNhc2UoKX0pLmpvaW4oXCJcIil9dmFyIHp0LFZ0PW5ldygvKiNfX1BVUkVfXyovZnVuY3Rpb24oKXtmdW5jdGlvbiB0KCl7fXZhciBuPXQucHJvdG90eXBlO3JldHVybiBuLmZvcm1hdD1mdW5jdGlvbih0LG4pe3JldHVyblwiW0dyaWQuanNdIFtcIituLnRvVXBwZXJDYXNlKCkrXCJdOiBcIit0fSxuLmVycm9yPWZ1bmN0aW9uKHQsbil7dm9pZCAwPT09biYmKG49ITEpO3ZhciBlPXRoaXMuZm9ybWF0KHQsXCJlcnJvclwiKTtpZihuKXRocm93IEVycm9yKGUpO2NvbnNvbGUuZXJyb3IoZSl9LG4ud2Fybj1mdW5jdGlvbih0KXtjb25zb2xlLndhcm4odGhpcy5mb3JtYXQodCxcIndhcm5cIikpfSxuLmluZm89ZnVuY3Rpb24odCl7Y29uc29sZS5pbmZvKHRoaXMuZm9ybWF0KHQsXCJpbmZvXCIpKX0sdH0oKSk7IWZ1bmN0aW9uKHQpe3RbdC5IZWFkZXI9MF09XCJIZWFkZXJcIix0W3QuRm9vdGVyPTFdPVwiRm9vdGVyXCIsdFt0LkNlbGw9Ml09XCJDZWxsXCJ9KHp0fHwoenQ9e30pKTt2YXIgJHQ9LyojX19QVVJFX18qL2Z1bmN0aW9uKCl7ZnVuY3Rpb24gdCgpe3RoaXMucGx1Z2lucz12b2lkIDAsdGhpcy5wbHVnaW5zPVtdfXZhciBuPXQucHJvdG90eXBlO3JldHVybiBuLmdldD1mdW5jdGlvbih0KXtyZXR1cm4gdGhpcy5wbHVnaW5zLmZpbmQoZnVuY3Rpb24obil7cmV0dXJuIG4uaWQ9PT10fSl9LG4uYWRkPWZ1bmN0aW9uKHQpe3JldHVybiB0LmlkP3RoaXMuZ2V0KHQuaWQpPyhWdC5lcnJvcihcIkR1cGxpY2F0ZSBwbHVnaW4gSUQ6IFwiK3QuaWQpLHRoaXMpOih0aGlzLnBsdWdpbnMucHVzaCh0KSx0aGlzKTooVnQuZXJyb3IoXCJQbHVnaW4gSUQgY2Fubm90IGJlIGVtcHR5XCIpLHRoaXMpfSxuLnJlbW92ZT1mdW5jdGlvbih0KXt2YXIgbj10aGlzLmdldCh0KTtyZXR1cm4gbiYmdGhpcy5wbHVnaW5zLnNwbGljZSh0aGlzLnBsdWdpbnMuaW5kZXhPZihuKSwxKSx0aGlzfSxuLmxpc3Q9ZnVuY3Rpb24odCl7dmFyIG47cmV0dXJuIG49bnVsbCE9dHx8bnVsbCE9dD90aGlzLnBsdWdpbnMuZmlsdGVyKGZ1bmN0aW9uKG4pe3JldHVybiBuLnBvc2l0aW9uPT09dH0pOnRoaXMucGx1Z2lucyxuLnNvcnQoZnVuY3Rpb24odCxuKXtyZXR1cm4gdC5vcmRlciYmbi5vcmRlcj90Lm9yZGVyLW4ub3JkZXI6MX0pfSx0fSgpO2Z1bmN0aW9uIEd0KHQpe3ZhciBuPXRoaXMscj1JdCgpO2lmKHQucGx1Z2luSWQpe3ZhciBvPXIucGx1Z2luLmdldCh0LnBsdWdpbklkKTtyZXR1cm4gbz93KFMse30sdyhvLmNvbXBvbmVudCxlKHtwbHVnaW46b30sdC5wcm9wcykpKTpudWxsfXJldHVybiB2b2lkIDAhPT10LnBvc2l0aW9uP3coUyx7fSxyLnBsdWdpbi5saXN0KHQucG9zaXRpb24pLm1hcChmdW5jdGlvbih0KXtyZXR1cm4gdyh0LmNvbXBvbmVudCxlKHtwbHVnaW46dH0sbi5wcm9wcy5wcm9wcykpfSkpOm51bGx9dmFyIEt0PS8qI19fUFVSRV9fKi9mdW5jdGlvbih0KXtmdW5jdGlvbiBvKCl7dmFyIG47cmV0dXJuKG49dC5jYWxsKHRoaXMpfHx0aGlzKS5fY29sdW1ucz12b2lkIDAsbi5fY29sdW1ucz1bXSxufXIobyx0KTt2YXIgaT1vLnByb3RvdHlwZTtyZXR1cm4gaS5hZGp1c3RXaWR0aD1mdW5jdGlvbih0LG4scil7dmFyIGk9dC5jb250YWluZXIsdT10LmF1dG9XaWR0aDtpZighaSlyZXR1cm4gdGhpczt2YXIgYT1pLmNsaWVudFdpZHRoLGw9e307bi5jdXJyZW50JiZ1JiYocSh3KEJ0LHt0YWJsZVJlZjpuLmN1cnJlbnR9KSxyLmN1cnJlbnQpLGw9ZnVuY3Rpb24odCl7dmFyIG49dC5xdWVyeVNlbGVjdG9yKFwidGFibGVcIik7aWYoIW4pcmV0dXJue307dmFyIHI9bi5jbGFzc05hbWUsbz1uLnN0eWxlLmNzc1RleHQ7bi5jbGFzc05hbWU9citcIiBcIitldChcInNoYWRvd1RhYmxlXCIpLG4uc3R5bGUudGFibGVMYXlvdXQ9XCJhdXRvXCIsbi5zdHlsZS53aWR0aD1cImF1dG9cIixuLnN0eWxlLnBhZGRpbmc9XCIwXCIsbi5zdHlsZS5tYXJnaW49XCIwXCIsbi5zdHlsZS5ib3JkZXI9XCJub25lXCIsbi5zdHlsZS5vdXRsaW5lPVwibm9uZVwiO3ZhciBpPUFycmF5LmZyb20obi5wYXJlbnROb2RlLnF1ZXJ5U2VsZWN0b3JBbGwoXCJ0aGVhZCB0aFwiKSkucmVkdWNlKGZ1bmN0aW9uKHQsbil7dmFyIHI7cmV0dXJuIG4uc3R5bGUud2lkdGg9bi5jbGllbnRXaWR0aCtcInB4XCIsZSgoKHI9e30pW24uZ2V0QXR0cmlidXRlKFwiZGF0YS1jb2x1bW4taWRcIildPXttaW5XaWR0aDpuLmNsaWVudFdpZHRofSxyKSx0KX0se30pO3JldHVybiBuLmNsYXNzTmFtZT1yLG4uc3R5bGUuY3NzVGV4dD1vLG4uc3R5bGUudGFibGVMYXlvdXQ9XCJhdXRvXCIsQXJyYXkuZnJvbShuLnBhcmVudE5vZGUucXVlcnlTZWxlY3RvckFsbChcInRoZWFkIHRoXCIpKS5yZWR1Y2UoZnVuY3Rpb24odCxuKXtyZXR1cm4gdFtuLmdldEF0dHJpYnV0ZShcImRhdGEtY29sdW1uLWlkXCIpXS53aWR0aD1uLmNsaWVudFdpZHRoLHR9LGkpfShyLmN1cnJlbnQpKTtmb3IodmFyIGMsZj1zKG8udGFidWxhckZvcm1hdCh0aGlzLmNvbHVtbnMpLnJlZHVjZShmdW5jdGlvbih0LG4pe3JldHVybiB0LmNvbmNhdChuKX0sW10pKTshKGM9ZigpKS5kb25lOyl7dmFyIHA9Yy52YWx1ZTtwLmNvbHVtbnMmJnAuY29sdW1ucy5sZW5ndGg+MHx8KCFwLndpZHRoJiZ1P3AuaWQgaW4gbCYmKHAud2lkdGg9V3QobFtwLmlkXS53aWR0aCkscC5taW5XaWR0aD1XdChsW3AuaWRdLm1pbldpZHRoKSk6cC53aWR0aD1XdChVdChwLndpZHRoLGEpKSl9cmV0dXJuIG4uY3VycmVudCYmdSYmcShudWxsLHIuY3VycmVudCksdGhpc30saS5zZXRTb3J0PWZ1bmN0aW9uKHQsbil7Zm9yKHZhciByLG89cyhufHx0aGlzLmNvbHVtbnN8fFtdKTshKHI9bygpKS5kb25lOyl7dmFyIGk9ci52YWx1ZTtpLmNvbHVtbnMmJmkuY29sdW1ucy5sZW5ndGg+MD9pLnNvcnQ9dm9pZCAwOnZvaWQgMD09PWkuc29ydCYmdD9pLnNvcnQ9e306aS5zb3J0P1wib2JqZWN0XCI9PXR5cGVvZiBpLnNvcnQmJihpLnNvcnQ9ZSh7fSxpLnNvcnQpKTppLnNvcnQ9dm9pZCAwLGkuY29sdW1ucyYmdGhpcy5zZXRTb3J0KHQsaS5jb2x1bW5zKX19LGkuc2V0UmVzaXphYmxlPWZ1bmN0aW9uKHQsbil7Zm9yKHZhciBlLHI9cyhufHx0aGlzLmNvbHVtbnN8fFtdKTshKGU9cigpKS5kb25lOyl7dmFyIG89ZS52YWx1ZTt2b2lkIDA9PT1vLnJlc2l6YWJsZSYmKG8ucmVzaXphYmxlPXQpLG8uY29sdW1ucyYmdGhpcy5zZXRSZXNpemFibGUodCxvLmNvbHVtbnMpfX0saS5zZXRJRD1mdW5jdGlvbih0KXtmb3IodmFyIG4sZT1zKHR8fHRoaXMuY29sdW1uc3x8W10pOyEobj1lKCkpLmRvbmU7KXt2YXIgcj1uLnZhbHVlO3IuaWR8fFwic3RyaW5nXCIhPXR5cGVvZiByLm5hbWV8fChyLmlkPXF0KHIubmFtZSkpLHIuaWR8fFZ0LmVycm9yKCdDb3VsZCBub3QgZmluZCBhIHZhbGlkIElEIGZvciBvbmUgb2YgdGhlIGNvbHVtbnMuIE1ha2Ugc3VyZSBhIHZhbGlkIFwiaWRcIiBpcyBzZXQgZm9yIGFsbCBjb2x1bW5zLicpLHIuY29sdW1ucyYmdGhpcy5zZXRJRChyLmNvbHVtbnMpfX0saS5wb3B1bGF0ZVBsdWdpbnM9ZnVuY3Rpb24odCxuKXtmb3IodmFyIHIsbz1zKG4pOyEocj1vKCkpLmRvbmU7KXt2YXIgaT1yLnZhbHVlO3ZvaWQgMCE9PWkucGx1Z2luJiZ0LmFkZChlKHtpZDppLmlkfSxpLnBsdWdpbix7cG9zaXRpb246enQuQ2VsbH0pKX19LG8uZnJvbUNvbHVtbnM9ZnVuY3Rpb24odCl7Zm9yKHZhciBuLGU9bmV3IG8scj1zKHQpOyEobj1yKCkpLmRvbmU7KXt2YXIgaT1uLnZhbHVlO2lmKFwic3RyaW5nXCI9PXR5cGVvZiBpfHxwKGkpKWUuY29sdW1ucy5wdXNoKHtuYW1lOml9KTtlbHNlIGlmKFwib2JqZWN0XCI9PXR5cGVvZiBpKXt2YXIgdT1pO3UuY29sdW1ucyYmKHUuY29sdW1ucz1vLmZyb21Db2x1bW5zKHUuY29sdW1ucykuY29sdW1ucyksXCJvYmplY3RcIj09dHlwZW9mIHUucGx1Z2luJiZ2b2lkIDA9PT11LmRhdGEmJih1LmRhdGE9bnVsbCksZS5jb2x1bW5zLnB1c2goaSl9fXJldHVybiBlfSxvLmNyZWF0ZUZyb21Db25maWc9ZnVuY3Rpb24odCl7dmFyIG49bmV3IG87cmV0dXJuIHQuZnJvbT9uLmNvbHVtbnM9by5mcm9tSFRNTFRhYmxlKHQuZnJvbSkuY29sdW1uczp0LmNvbHVtbnM/bi5jb2x1bW5zPW8uZnJvbUNvbHVtbnModC5jb2x1bW5zKS5jb2x1bW5zOiF0LmRhdGF8fFwib2JqZWN0XCIhPXR5cGVvZiB0LmRhdGFbMF18fHQuZGF0YVswXWluc3RhbmNlb2YgQXJyYXl8fChuLmNvbHVtbnM9T2JqZWN0LmtleXModC5kYXRhWzBdKS5tYXAoZnVuY3Rpb24odCl7cmV0dXJue25hbWU6dH19KSksbi5jb2x1bW5zLmxlbmd0aD8obi5zZXRJRCgpLG4uc2V0U29ydCh0LnNvcnQpLG4uc2V0UmVzaXphYmxlKHQucmVzaXphYmxlKSxuLnBvcHVsYXRlUGx1Z2lucyh0LnBsdWdpbixuLmNvbHVtbnMpLG4pOm51bGx9LG8uZnJvbUhUTUxUYWJsZT1mdW5jdGlvbih0KXtmb3IodmFyIG4sZT1uZXcgbyxyPXModC5xdWVyeVNlbGVjdG9yKFwidGhlYWRcIikucXVlcnlTZWxlY3RvckFsbChcInRoXCIpKTshKG49cigpKS5kb25lOyl7dmFyIGk9bi52YWx1ZTtlLmNvbHVtbnMucHVzaCh7bmFtZTppLmlubmVySFRNTCx3aWR0aDppLndpZHRofSl9cmV0dXJuIGV9LG8udGFidWxhckZvcm1hdD1mdW5jdGlvbih0KXt2YXIgbj1bXSxlPXR8fFtdLHI9W107aWYoZSYmZS5sZW5ndGgpe24ucHVzaChlKTtmb3IodmFyIG8saT1zKGUpOyEobz1pKCkpLmRvbmU7KXt2YXIgdT1vLnZhbHVlO3UuY29sdW1ucyYmdS5jb2x1bW5zLmxlbmd0aCYmKHI9ci5jb25jYXQodS5jb2x1bW5zKSl9ci5sZW5ndGgmJihuPW4uY29uY2F0KHRoaXMudGFidWxhckZvcm1hdChyKSkpfXJldHVybiBufSxvLmxlYWZDb2x1bW5zPWZ1bmN0aW9uKHQpe3ZhciBuPVtdLGU9dHx8W107aWYoZSYmZS5sZW5ndGgpZm9yKHZhciByLG89cyhlKTshKHI9bygpKS5kb25lOyl7dmFyIGk9ci52YWx1ZTtpLmNvbHVtbnMmJjAhPT1pLmNvbHVtbnMubGVuZ3RofHxuLnB1c2goaSksaS5jb2x1bW5zJiYobj1uLmNvbmNhdCh0aGlzLmxlYWZDb2x1bW5zKGkuY29sdW1ucykpKX1yZXR1cm4gbn0sby5tYXhpbXVtRGVwdGg9ZnVuY3Rpb24odCl7cmV0dXJuIHRoaXMudGFidWxhckZvcm1hdChbdF0pLmxlbmd0aC0xfSxuKG8sW3trZXk6XCJjb2x1bW5zXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuX2NvbHVtbnN9LHNldDpmdW5jdGlvbih0KXt0aGlzLl9jb2x1bW5zPXR9fSx7a2V5OlwidmlzaWJsZUNvbHVtbnNcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5fY29sdW1ucy5maWx0ZXIoZnVuY3Rpb24odCl7cmV0dXJuIXQuaGlkZGVufSl9fV0pLG99KFYpLFh0PWZ1bmN0aW9uKCl7fSxadD0vKiNfX1BVUkVfXyovZnVuY3Rpb24odCl7ZnVuY3Rpb24gbihuKXt2YXIgZTtyZXR1cm4oZT10LmNhbGwodGhpcyl8fHRoaXMpLmRhdGE9dm9pZCAwLGUuc2V0KG4pLGV9cihuLHQpO3ZhciBlPW4ucHJvdG90eXBlO3JldHVybiBlLmdldD1mdW5jdGlvbigpe3RyeXtyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuZGF0YSgpKS50aGVuKGZ1bmN0aW9uKHQpe3JldHVybntkYXRhOnQsdG90YWw6dC5sZW5ndGh9fSl9Y2F0Y2godCl7cmV0dXJuIFByb21pc2UucmVqZWN0KHQpfX0sZS5zZXQ9ZnVuY3Rpb24odCl7cmV0dXJuIHQgaW5zdGFuY2VvZiBBcnJheT90aGlzLmRhdGE9ZnVuY3Rpb24oKXtyZXR1cm4gdH06dCBpbnN0YW5jZW9mIEZ1bmN0aW9uJiYodGhpcy5kYXRhPXQpLHRoaXN9LG59KFh0KSxKdD0vKiNfX1BVUkVfXyovZnVuY3Rpb24odCl7ZnVuY3Rpb24gbihuKXt2YXIgZTtyZXR1cm4oZT10LmNhbGwodGhpcyl8fHRoaXMpLm9wdGlvbnM9dm9pZCAwLGUub3B0aW9ucz1uLGV9cihuLHQpO3ZhciBvPW4ucHJvdG90eXBlO3JldHVybiBvLmhhbmRsZXI9ZnVuY3Rpb24odCl7cmV0dXJuXCJmdW5jdGlvblwiPT10eXBlb2YgdGhpcy5vcHRpb25zLmhhbmRsZT90aGlzLm9wdGlvbnMuaGFuZGxlKHQpOnQub2s/dC5qc29uKCk6KFZ0LmVycm9yKFwiQ291bGQgbm90IGZldGNoIGRhdGE6IFwiK3Quc3RhdHVzK1wiIC0gXCIrdC5zdGF0dXNUZXh0LCEwKSxudWxsKX0sby5nZXQ9ZnVuY3Rpb24odCl7dmFyIG49ZSh7fSx0aGlzLm9wdGlvbnMsdCk7cmV0dXJuXCJmdW5jdGlvblwiPT10eXBlb2Ygbi5kYXRhP24uZGF0YShuKTpmZXRjaChuLnVybCxuKS50aGVuKHRoaXMuaGFuZGxlci5iaW5kKHRoaXMpKS50aGVuKGZ1bmN0aW9uKHQpe3JldHVybntkYXRhOm4udGhlbih0KSx0b3RhbDpcImZ1bmN0aW9uXCI9PXR5cGVvZiBuLnRvdGFsP24udG90YWwodCk6dm9pZCAwfX0pfSxufShYdCksUXQ9LyojX19QVVJFX18qL2Z1bmN0aW9uKCl7ZnVuY3Rpb24gdCgpe31yZXR1cm4gdC5jcmVhdGVGcm9tQ29uZmlnPWZ1bmN0aW9uKHQpe3ZhciBuPW51bGw7cmV0dXJuIHQuZGF0YSYmKG49bmV3IFp0KHQuZGF0YSkpLHQuZnJvbSYmKG49bmV3IFp0KHRoaXMudGFibGVFbGVtZW50VG9BcnJheSh0LmZyb20pKSx0LmZyb20uc3R5bGUuZGlzcGxheT1cIm5vbmVcIiksdC5zZXJ2ZXImJihuPW5ldyBKdCh0LnNlcnZlcikpLG58fFZ0LmVycm9yKFwiQ291bGQgbm90IGRldGVybWluZSB0aGUgc3RvcmFnZSB0eXBlXCIsITApLG59LHQudGFibGVFbGVtZW50VG9BcnJheT1mdW5jdGlvbih0KXtmb3IodmFyIG4sZSxyPVtdLG89cyh0LnF1ZXJ5U2VsZWN0b3IoXCJ0Ym9keVwiKS5xdWVyeVNlbGVjdG9yQWxsKFwidHJcIikpOyEobj1vKCkpLmRvbmU7KXtmb3IodmFyIGksdT1bXSxhPXMobi52YWx1ZS5xdWVyeVNlbGVjdG9yQWxsKFwidGRcIikpOyEoaT1hKCkpLmRvbmU7KXt2YXIgbD1pLnZhbHVlOzE9PT1sLmNoaWxkTm9kZXMubGVuZ3RoJiZsLmNoaWxkTm9kZXNbMF0ubm9kZVR5cGU9PT1Ob2RlLlRFWFRfTk9ERT91LnB1c2goKGU9bC5pbm5lckhUTUwsKG5ldyBET01QYXJzZXIpLnBhcnNlRnJvbVN0cmluZyhlLFwidGV4dC9odG1sXCIpLmRvY3VtZW50RWxlbWVudC50ZXh0Q29udGVudCkpOnUucHVzaChHKGwuaW5uZXJIVE1MKSl9ci5wdXNoKHUpfXJldHVybiByfSx0fSgpLFl0PVwidW5kZWZpbmVkXCIhPXR5cGVvZiBTeW1ib2w/U3ltYm9sLml0ZXJhdG9yfHwoU3ltYm9sLml0ZXJhdG9yPVN5bWJvbChcIlN5bWJvbC5pdGVyYXRvclwiKSk6XCJAQGl0ZXJhdG9yXCI7ZnVuY3Rpb24gdG4odCxuLGUpe2lmKCF0LnMpe2lmKGUgaW5zdGFuY2VvZiBubil7aWYoIWUucylyZXR1cm4gdm9pZChlLm89dG4uYmluZChudWxsLHQsbikpOzEmbiYmKG49ZS5zKSxlPWUudn1pZihlJiZlLnRoZW4pcmV0dXJuIHZvaWQgZS50aGVuKHRuLmJpbmQobnVsbCx0LG4pLHRuLmJpbmQobnVsbCx0LDIpKTt0LnM9bix0LnY9ZTt2YXIgcj10Lm87ciYmcih0KX19dmFyIG5uPS8qI19fUFVSRV9fKi9mdW5jdGlvbigpe2Z1bmN0aW9uIHQoKXt9cmV0dXJuIHQucHJvdG90eXBlLnRoZW49ZnVuY3Rpb24obixlKXt2YXIgcj1uZXcgdCxvPXRoaXMucztpZihvKXt2YXIgaT0xJm8/bjplO2lmKGkpe3RyeXt0bihyLDEsaSh0aGlzLnYpKX1jYXRjaCh0KXt0bihyLDIsdCl9cmV0dXJuIHJ9cmV0dXJuIHRoaXN9cmV0dXJuIHRoaXMubz1mdW5jdGlvbih0KXt0cnl7dmFyIG89dC52OzEmdC5zP3RuKHIsMSxuP24obyk6byk6ZT90bihyLDEsZShvKSk6dG4ociwyLG8pfWNhdGNoKHQpe3RuKHIsMix0KX19LHJ9LHR9KCk7ZnVuY3Rpb24gZW4odCl7cmV0dXJuIHQgaW5zdGFuY2VvZiBubiYmMSZ0LnN9dmFyIHJuPS8qI19fUFVSRV9fKi9mdW5jdGlvbih0KXtmdW5jdGlvbiBlKG4pe3ZhciBlO3JldHVybihlPXQuY2FsbCh0aGlzKXx8dGhpcykuX3N0ZXBzPW5ldyBNYXAsZS5jYWNoZT1uZXcgTWFwLGUubGFzdFByb2Nlc3NvckluZGV4VXBkYXRlZD0tMSxuJiZuLmZvckVhY2goZnVuY3Rpb24odCl7cmV0dXJuIGUucmVnaXN0ZXIodCl9KSxlfXIoZSx0KTt2YXIgbz1lLnByb3RvdHlwZTtyZXR1cm4gby5jbGVhckNhY2hlPWZ1bmN0aW9uKCl7dGhpcy5jYWNoZT1uZXcgTWFwLHRoaXMubGFzdFByb2Nlc3NvckluZGV4VXBkYXRlZD0tMX0sby5yZWdpc3Rlcj1mdW5jdGlvbih0LG4pe2lmKHZvaWQgMD09PW4mJihuPW51bGwpLCF0KXRocm93IEVycm9yKFwiUHJvY2Vzc29yIGlzIG5vdCBkZWZpbmVkXCIpO2lmKG51bGw9PT10LnR5cGUpdGhyb3cgRXJyb3IoXCJQcm9jZXNzb3IgdHlwZSBpcyBub3QgZGVmaW5lZFwiKTtpZih0aGlzLmZpbmRQcm9jZXNzb3JJbmRleEJ5SUQodC5pZCk+LTEpdGhyb3cgRXJyb3IoXCJQcm9jZXNzb3IgSUQgXCIrdC5pZCtcIiBpcyBhbHJlYWR5IGRlZmluZWRcIik7cmV0dXJuIHQub24oXCJwcm9wc1VwZGF0ZWRcIix0aGlzLnByb2Nlc3NvclByb3BzVXBkYXRlZC5iaW5kKHRoaXMpKSx0aGlzLmFkZFByb2Nlc3NvckJ5UHJpb3JpdHkodCxuKSx0aGlzLmFmdGVyUmVnaXN0ZXJlZCh0KSx0fSxvLnRyeVJlZ2lzdGVyPWZ1bmN0aW9uKHQsbil7dm9pZCAwPT09biYmKG49bnVsbCk7dHJ5e3JldHVybiB0aGlzLnJlZ2lzdGVyKHQsbil9Y2F0Y2godCl7fX0sby51bnJlZ2lzdGVyPWZ1bmN0aW9uKHQpe2lmKHQmJi0xIT09dGhpcy5maW5kUHJvY2Vzc29ySW5kZXhCeUlEKHQuaWQpKXt2YXIgbj10aGlzLl9zdGVwcy5nZXQodC50eXBlKTtuJiZuLmxlbmd0aCYmKHRoaXMuX3N0ZXBzLnNldCh0LnR5cGUsbi5maWx0ZXIoZnVuY3Rpb24obil7cmV0dXJuIG4hPXR9KSksdGhpcy5lbWl0KFwidXBkYXRlZFwiLHQpKX19LG8uYWRkUHJvY2Vzc29yQnlQcmlvcml0eT1mdW5jdGlvbih0LG4pe3ZhciBlPXRoaXMuX3N0ZXBzLmdldCh0LnR5cGUpO2lmKCFlKXt2YXIgcj1bXTt0aGlzLl9zdGVwcy5zZXQodC50eXBlLHIpLGU9cn1pZihudWxsPT09bnx8bjwwKWUucHVzaCh0KTtlbHNlIGlmKGVbbl0pe3ZhciBvPWUuc2xpY2UoMCxuLTEpLGk9ZS5zbGljZShuKzEpO3RoaXMuX3N0ZXBzLnNldCh0LnR5cGUsby5jb25jYXQodCkuY29uY2F0KGkpKX1lbHNlIGVbbl09dH0sby5nZXRTdGVwc0J5VHlwZT1mdW5jdGlvbih0KXtyZXR1cm4gdGhpcy5zdGVwcy5maWx0ZXIoZnVuY3Rpb24obil7cmV0dXJuIG4udHlwZT09PXR9KX0sby5nZXRTb3J0ZWRQcm9jZXNzb3JUeXBlcz1mdW5jdGlvbigpe3JldHVybiBPYmplY3Qua2V5cyhLKS5maWx0ZXIoZnVuY3Rpb24odCl7cmV0dXJuIWlzTmFOKE51bWJlcih0KSl9KS5tYXAoZnVuY3Rpb24odCl7cmV0dXJuIE51bWJlcih0KX0pfSxvLnByb2Nlc3M9ZnVuY3Rpb24odCl7dHJ5e3ZhciBuPWZ1bmN0aW9uKHQpe3JldHVybiBlLmxhc3RQcm9jZXNzb3JJbmRleFVwZGF0ZWQ9by5sZW5ndGgsZS5lbWl0KFwiYWZ0ZXJQcm9jZXNzXCIsaSksaX0sZT10aGlzLHI9ZS5sYXN0UHJvY2Vzc29ySW5kZXhVcGRhdGVkLG89ZS5zdGVwcyxpPXQsdT1mdW5jdGlvbih0LG4pe3RyeXt2YXIgdT1mdW5jdGlvbih0LG4sZSl7aWYoXCJmdW5jdGlvblwiPT10eXBlb2YgdFtZdF0pe3ZhciByLG8saSx1PXRbWXRdKCk7aWYoZnVuY3Rpb24gdChlKXt0cnl7Zm9yKDshKHI9dS5uZXh0KCkpLmRvbmU7KWlmKChlPW4oci52YWx1ZSkpJiZlLnRoZW4pe2lmKCFlbihlKSlyZXR1cm4gdm9pZCBlLnRoZW4odCxpfHwoaT10bi5iaW5kKG51bGwsbz1uZXcgbm4sMikpKTtlPWUudn1vP3RuKG8sMSxlKTpvPWV9Y2F0Y2godCl7dG4ob3x8KG89bmV3IG5uKSwyLHQpfX0oKSx1LnJldHVybil7dmFyIHM9ZnVuY3Rpb24odCl7dHJ5e3IuZG9uZXx8dS5yZXR1cm4oKX1jYXRjaCh0KXt9cmV0dXJuIHR9O2lmKG8mJm8udGhlbilyZXR1cm4gby50aGVuKHMsZnVuY3Rpb24odCl7dGhyb3cgcyh0KX0pO3MoKX1yZXR1cm4gb31pZighKFwibGVuZ3RoXCJpbiB0KSl0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IGlzIG5vdCBpdGVyYWJsZVwiKTtmb3IodmFyIGE9W10sbD0wO2w8dC5sZW5ndGg7bCsrKWEucHVzaCh0W2xdKTtyZXR1cm4gZnVuY3Rpb24odCxuLGUpe3ZhciByLG8saT0tMTtyZXR1cm4gZnVuY3Rpb24gZSh1KXt0cnl7Zm9yKDsrK2k8dC5sZW5ndGg7KWlmKCh1PW4oaSkpJiZ1LnRoZW4pe2lmKCFlbih1KSlyZXR1cm4gdm9pZCB1LnRoZW4oZSxvfHwobz10bi5iaW5kKG51bGwscj1uZXcgbm4sMikpKTt1PXUudn1yP3RuKHIsMSx1KTpyPXV9Y2F0Y2godCl7dG4ocnx8KHI9bmV3IG5uKSwyLHQpfX0oKSxyfShhLGZ1bmN0aW9uKHQpe3JldHVybiBuKGFbdF0pfSl9KG8sZnVuY3Rpb24odCl7dmFyIG49ZS5maW5kUHJvY2Vzc29ySW5kZXhCeUlEKHQuaWQpLG89ZnVuY3Rpb24oKXtpZihuPj1yKXJldHVybiBQcm9taXNlLnJlc29sdmUodC5wcm9jZXNzKGkpKS50aGVuKGZ1bmN0aW9uKG4pe2UuY2FjaGUuc2V0KHQuaWQsaT1uKX0pO2k9ZS5jYWNoZS5nZXQodC5pZCl9KCk7aWYobyYmby50aGVuKXJldHVybiBvLnRoZW4oZnVuY3Rpb24oKXt9KX0pfWNhdGNoKHQpe3JldHVybiBuKHQpfXJldHVybiB1JiZ1LnRoZW4/dS50aGVuKHZvaWQgMCxuKTp1fSgwLGZ1bmN0aW9uKHQpe3Rocm93IFZ0LmVycm9yKHQpLGUuZW1pdChcImVycm9yXCIsaSksdH0pO3JldHVybiBQcm9taXNlLnJlc29sdmUodSYmdS50aGVuP3UudGhlbihuKTpuKCkpfWNhdGNoKHQpe3JldHVybiBQcm9taXNlLnJlamVjdCh0KX19LG8uZmluZFByb2Nlc3NvckluZGV4QnlJRD1mdW5jdGlvbih0KXtyZXR1cm4gdGhpcy5zdGVwcy5maW5kSW5kZXgoZnVuY3Rpb24obil7cmV0dXJuIG4uaWQ9PXR9KX0sby5zZXRMYXN0UHJvY2Vzc29ySW5kZXg9ZnVuY3Rpb24odCl7dmFyIG49dGhpcy5maW5kUHJvY2Vzc29ySW5kZXhCeUlEKHQuaWQpO3RoaXMubGFzdFByb2Nlc3NvckluZGV4VXBkYXRlZD5uJiYodGhpcy5sYXN0UHJvY2Vzc29ySW5kZXhVcGRhdGVkPW4pfSxvLnByb2Nlc3NvclByb3BzVXBkYXRlZD1mdW5jdGlvbih0KXt0aGlzLnNldExhc3RQcm9jZXNzb3JJbmRleCh0KSx0aGlzLmVtaXQoXCJwcm9wc1VwZGF0ZWRcIiksdGhpcy5lbWl0KFwidXBkYXRlZFwiLHQpfSxvLmFmdGVyUmVnaXN0ZXJlZD1mdW5jdGlvbih0KXt0aGlzLnNldExhc3RQcm9jZXNzb3JJbmRleCh0KSx0aGlzLmVtaXQoXCJhZnRlclJlZ2lzdGVyXCIpLHRoaXMuZW1pdChcInVwZGF0ZWRcIix0KX0sbihlLFt7a2V5Olwic3RlcHNcIixnZXQ6ZnVuY3Rpb24oKXtmb3IodmFyIHQsbj1bXSxlPXModGhpcy5nZXRTb3J0ZWRQcm9jZXNzb3JUeXBlcygpKTshKHQ9ZSgpKS5kb25lOyl7dmFyIHI9dGhpcy5fc3RlcHMuZ2V0KHQudmFsdWUpO3ImJnIubGVuZ3RoJiYobj1uLmNvbmNhdChyKSl9cmV0dXJuIG4uZmlsdGVyKGZ1bmN0aW9uKHQpe3JldHVybiB0fSl9fV0pLGV9KFEpLG9uPS8qI19fUFVSRV9fKi9mdW5jdGlvbih0KXtmdW5jdGlvbiBlKCl7cmV0dXJuIHQuYXBwbHkodGhpcyxhcmd1bWVudHMpfHx0aGlzfXJldHVybiByKGUsdCksZS5wcm90b3R5cGUuX3Byb2Nlc3M9ZnVuY3Rpb24odCl7dHJ5e3JldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5wcm9wcy5zdG9yYWdlLmdldCh0KSl9Y2F0Y2godCl7cmV0dXJuIFByb21pc2UucmVqZWN0KHQpfX0sbihlLFt7a2V5OlwidHlwZVwiLGdldDpmdW5jdGlvbigpe3JldHVybiBLLkV4dHJhY3Rvcn19XSksZX0odHQpLHVuPS8qI19fUFVSRV9fKi9mdW5jdGlvbih0KXtmdW5jdGlvbiBlKCl7cmV0dXJuIHQuYXBwbHkodGhpcyxhcmd1bWVudHMpfHx0aGlzfXJldHVybiByKGUsdCksZS5wcm90b3R5cGUuX3Byb2Nlc3M9ZnVuY3Rpb24odCl7dmFyIG49Si5mcm9tQXJyYXkodC5kYXRhKTtyZXR1cm4gbi5sZW5ndGg9dC50b3RhbCxufSxuKGUsW3trZXk6XCJ0eXBlXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIEsuVHJhbnNmb3JtZXJ9fV0pLGV9KHR0KSxzbj0vKiNfX1BVUkVfXyovZnVuY3Rpb24odCl7ZnVuY3Rpb24gbygpe3JldHVybiB0LmFwcGx5KHRoaXMsYXJndW1lbnRzKXx8dGhpc31yZXR1cm4gcihvLHQpLG8ucHJvdG90eXBlLl9wcm9jZXNzPWZ1bmN0aW9uKCl7cmV0dXJuIE9iamVjdC5lbnRyaWVzKHRoaXMucHJvcHMuc2VydmVyU3RvcmFnZU9wdGlvbnMpLmZpbHRlcihmdW5jdGlvbih0KXtyZXR1cm5cImZ1bmN0aW9uXCIhPXR5cGVvZiB0WzFdfSkucmVkdWNlKGZ1bmN0aW9uKHQsbil7dmFyIHI7cmV0dXJuIGUoe30sdCwoKHI9e30pW25bMF1dPW5bMV0scikpfSx7fSl9LG4obyxbe2tleTpcInR5cGVcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gSy5Jbml0aWF0b3J9fV0pLG99KHR0KSxhbj0vKiNfX1BVUkVfXyovZnVuY3Rpb24odCl7ZnVuY3Rpb24gZSgpe3JldHVybiB0LmFwcGx5KHRoaXMsYXJndW1lbnRzKXx8dGhpc31yKGUsdCk7dmFyIG89ZS5wcm90b3R5cGU7cmV0dXJuIG8uY2FzdERhdGE9ZnVuY3Rpb24odCl7aWYoIXR8fCF0Lmxlbmd0aClyZXR1cm5bXTtpZighdGhpcy5wcm9wcy5oZWFkZXJ8fCF0aGlzLnByb3BzLmhlYWRlci5jb2x1bW5zKXJldHVybiB0O3ZhciBuPUt0LmxlYWZDb2x1bW5zKHRoaXMucHJvcHMuaGVhZGVyLmNvbHVtbnMpO3JldHVybiB0WzBdaW5zdGFuY2VvZiBBcnJheT90Lm1hcChmdW5jdGlvbih0KXt2YXIgZT0wO3JldHVybiBuLm1hcChmdW5jdGlvbihuLHIpe3JldHVybiB2b2lkIDAhPT1uLmRhdGE/KGUrKyxcImZ1bmN0aW9uXCI9PXR5cGVvZiBuLmRhdGE/bi5kYXRhKHQpOm4uZGF0YSk6dFtyLWVdfSl9KTpcIm9iamVjdFwiIT10eXBlb2YgdFswXXx8dFswXWluc3RhbmNlb2YgQXJyYXk/W106dC5tYXAoZnVuY3Rpb24odCl7cmV0dXJuIG4ubWFwKGZ1bmN0aW9uKG4sZSl7cmV0dXJuIHZvaWQgMCE9PW4uZGF0YT9cImZ1bmN0aW9uXCI9PXR5cGVvZiBuLmRhdGE/bi5kYXRhKHQpOm4uZGF0YTpuLmlkP3Rbbi5pZF06KFZ0LmVycm9yKFwiQ291bGQgbm90IGZpbmQgdGhlIGNvcnJlY3QgY2VsbCBmb3IgY29sdW1uIGF0IHBvc2l0aW9uIFwiK2UrXCIuXFxuICAgICAgICAgICAgICAgICAgICAgICAgICBNYWtlIHN1cmUgZWl0aGVyICdpZCcgb3IgJ3NlbGVjdG9yJyBpcyBkZWZpbmVkIGZvciBhbGwgY29sdW1ucy5cIiksbnVsbCl9KX0pfSxvLl9wcm9jZXNzPWZ1bmN0aW9uKHQpe3JldHVybntkYXRhOnRoaXMuY2FzdERhdGEodC5kYXRhKSx0b3RhbDp0LnRvdGFsfX0sbihlLFt7a2V5OlwidHlwZVwiLGdldDpmdW5jdGlvbigpe3JldHVybiBLLlRyYW5zZm9ybWVyfX1dKSxlfSh0dCksbG49LyojX19QVVJFX18qL2Z1bmN0aW9uKCl7ZnVuY3Rpb24gdCgpe31yZXR1cm4gdC5jcmVhdGVGcm9tQ29uZmlnPWZ1bmN0aW9uKHQpe3ZhciBuPW5ldyBybjtyZXR1cm4gdC5zdG9yYWdlIGluc3RhbmNlb2YgSnQmJm4ucmVnaXN0ZXIobmV3IHNuKHtzZXJ2ZXJTdG9yYWdlT3B0aW9uczp0LnNlcnZlcn0pKSxuLnJlZ2lzdGVyKG5ldyBvbih7c3RvcmFnZTp0LnN0b3JhZ2V9KSksbi5yZWdpc3RlcihuZXcgYW4oe2hlYWRlcjp0LmhlYWRlcn0pKSxuLnJlZ2lzdGVyKG5ldyB1biksbn0sdH0oKSxjbj1mdW5jdGlvbih0KXt2YXIgbj10aGlzO3RoaXMuc3RhdGU9dm9pZCAwLHRoaXMubGlzdGVuZXJzPVtdLHRoaXMuaXNEaXNwYXRjaGluZz0hMSx0aGlzLmdldFN0YXRlPWZ1bmN0aW9uKCl7cmV0dXJuIG4uc3RhdGV9LHRoaXMuZ2V0TGlzdGVuZXJzPWZ1bmN0aW9uKCl7cmV0dXJuIG4ubGlzdGVuZXJzfSx0aGlzLmRpc3BhdGNoPWZ1bmN0aW9uKHQpe2lmKFwiZnVuY3Rpb25cIiE9dHlwZW9mIHQpdGhyb3cgbmV3IEVycm9yKFwiUmVkdWNlciBpcyBub3QgYSBmdW5jdGlvblwiKTtpZihuLmlzRGlzcGF0Y2hpbmcpdGhyb3cgbmV3IEVycm9yKFwiUmVkdWNlcnMgbWF5IG5vdCBkaXNwYXRjaCBhY3Rpb25zXCIpO24uaXNEaXNwYXRjaGluZz0hMDt2YXIgZT1uLnN0YXRlO3RyeXtuLnN0YXRlPXQobi5zdGF0ZSl9ZmluYWxseXtuLmlzRGlzcGF0Y2hpbmc9ITF9Zm9yKHZhciByLG89cyhuLmxpc3RlbmVycyk7IShyPW8oKSkuZG9uZTspKDAsci52YWx1ZSkobi5zdGF0ZSxlKTtyZXR1cm4gbi5zdGF0ZX0sdGhpcy5zdWJzY3JpYmU9ZnVuY3Rpb24odCl7aWYoXCJmdW5jdGlvblwiIT10eXBlb2YgdCl0aHJvdyBuZXcgRXJyb3IoXCJMaXN0ZW5lciBpcyBub3QgYSBmdW5jdGlvblwiKTtyZXR1cm4gbi5saXN0ZW5lcnM9W10uY29uY2F0KG4ubGlzdGVuZXJzLFt0XSksZnVuY3Rpb24oKXtyZXR1cm4gbi5saXN0ZW5lcnM9bi5saXN0ZW5lcnMuZmlsdGVyKGZ1bmN0aW9uKG4pe3JldHVybiBuIT09dH0pfX0sdGhpcy5zdGF0ZT10fSxmbj1mdW5jdGlvbih0LG4pe3ZhciBlPXtfX2M6bj1cIl9fY0NcIitfKyssX186bnVsbCxDb25zdW1lcjpmdW5jdGlvbih0LG4pe3JldHVybiB0LmNoaWxkcmVuKG4pfSxQcm92aWRlcjpmdW5jdGlvbih0KXt2YXIgZSxyO3JldHVybiB0aGlzLmdldENoaWxkQ29udGV4dHx8KGU9W10sKHI9e30pW25dPXRoaXMsdGhpcy5nZXRDaGlsZENvbnRleHQ9ZnVuY3Rpb24oKXtyZXR1cm4gcn0sdGhpcy5zaG91bGRDb21wb25lbnRVcGRhdGU9ZnVuY3Rpb24odCl7dGhpcy5wcm9wcy52YWx1ZSE9PXQudmFsdWUmJmUuc29tZShFKX0sdGhpcy5zdWI9ZnVuY3Rpb24odCl7ZS5wdXNoKHQpO3ZhciBuPXQuY29tcG9uZW50V2lsbFVubW91bnQ7dC5jb21wb25lbnRXaWxsVW5tb3VudD1mdW5jdGlvbigpe2Uuc3BsaWNlKGUuaW5kZXhPZih0KSwxKSxuJiZuLmNhbGwodCl9fSksdC5jaGlsZHJlbn19O3JldHVybiBlLlByb3ZpZGVyLl9fPWUuQ29uc3VtZXIuY29udGV4dFR5cGU9ZX0oKSxwbj0vKiNfX1BVUkVfXyovZnVuY3Rpb24oKXtmdW5jdGlvbiB0KCl7T2JqZWN0LmFzc2lnbih0aGlzLHQuZGVmYXVsdENvbmZpZygpKX12YXIgbj10LnByb3RvdHlwZTtyZXR1cm4gbi5hc3NpZ249ZnVuY3Rpb24odCl7cmV0dXJuIE9iamVjdC5hc3NpZ24odGhpcyx0KX0sbi51cGRhdGU9ZnVuY3Rpb24obil7cmV0dXJuIG4/KHRoaXMuYXNzaWduKHQuZnJvbVBhcnRpYWxDb25maWcoZSh7fSx0aGlzLG4pKSksdGhpcyk6dGhpc30sdC5kZWZhdWx0Q29uZmlnPWZ1bmN0aW9uKCl7cmV0dXJue3N0b3JlOm5ldyBjbih7c3RhdHVzOmEuSW5pdCxoZWFkZXI6dm9pZCAwLGRhdGE6bnVsbH0pLHBsdWdpbjpuZXcgJHQsdGFibGVSZWY6e2N1cnJlbnQ6bnVsbH0sd2lkdGg6XCIxMDAlXCIsaGVpZ2h0OlwiYXV0b1wiLHByb2Nlc3NpbmdUaHJvdHRsZU1zOjEwMCxhdXRvV2lkdGg6ITAsc3R5bGU6e30sY2xhc3NOYW1lOnt9fX0sdC5mcm9tUGFydGlhbENvbmZpZz1mdW5jdGlvbihuKXt2YXIgZT0obmV3IHQpLmFzc2lnbihuKTtyZXR1cm5cImJvb2xlYW5cIj09dHlwZW9mIG4uc29ydCYmbi5zb3J0JiZlLmFzc2lnbih7c29ydDp7bXVsdGlDb2x1bW46ITB9fSksZS5hc3NpZ24oe2hlYWRlcjpLdC5jcmVhdGVGcm9tQ29uZmlnKGUpfSksZS5hc3NpZ24oe3N0b3JhZ2U6UXQuY3JlYXRlRnJvbUNvbmZpZyhlKX0pLGUuYXNzaWduKHtwaXBlbGluZTpsbi5jcmVhdGVGcm9tQ29uZmlnKGUpfSksZS5hc3NpZ24oe3RyYW5zbGF0b3I6bmV3IEx0KGUubGFuZ3VhZ2UpfSksZS5wbHVnaW49bmV3ICR0LGUuc2VhcmNoJiZlLnBsdWdpbi5hZGQoe2lkOlwic2VhcmNoXCIscG9zaXRpb246enQuSGVhZGVyLGNvbXBvbmVudDpEdH0pLGUucGFnaW5hdGlvbiYmZS5wbHVnaW4uYWRkKHtpZDpcInBhZ2luYXRpb25cIixwb3NpdGlvbjp6dC5Gb290ZXIsY29tcG9uZW50OlJ0fSksZS5wbHVnaW5zJiZlLnBsdWdpbnMuZm9yRWFjaChmdW5jdGlvbih0KXtyZXR1cm4gZS5wbHVnaW4uYWRkKHQpfSksZX0sdH0oKTtmdW5jdGlvbiBkbih0KXt2YXIgbixyPUl0KCk7cmV0dXJuIHcoXCJ0ZFwiLGUoe3JvbGU6dC5yb2xlLGNvbFNwYW46dC5jb2xTcGFuLFwiZGF0YS1jb2x1bW4taWRcIjp0LmNvbHVtbiYmdC5jb2x1bW4uaWQsY2xhc3NOYW1lOnJ0KGV0KFwidGRcIiksdC5jbGFzc05hbWUsci5jbGFzc05hbWUudGQpLHN0eWxlOmUoe30sdC5zdHlsZSxyLnN0eWxlLnRkKSxvbkNsaWNrOmZ1bmN0aW9uKG4pe3QubWVzc2FnZUNlbGx8fHIuZXZlbnRFbWl0dGVyLmVtaXQoXCJjZWxsQ2xpY2tcIixuLHQuY2VsbCx0LmNvbHVtbix0LnJvdyl9fSwobj10LmNvbHVtbik/XCJmdW5jdGlvblwiPT10eXBlb2Ygbi5hdHRyaWJ1dGVzP24uYXR0cmlidXRlcyh0LmNlbGwuZGF0YSx0LnJvdyx0LmNvbHVtbik6bi5hdHRyaWJ1dGVzOnt9KSx0LmNvbHVtbiYmXCJmdW5jdGlvblwiPT10eXBlb2YgdC5jb2x1bW4uZm9ybWF0dGVyP3QuY29sdW1uLmZvcm1hdHRlcih0LmNlbGwuZGF0YSx0LnJvdyx0LmNvbHVtbik6dC5jb2x1bW4mJnQuY29sdW1uLnBsdWdpbj93KEd0LHtwbHVnaW5JZDp0LmNvbHVtbi5pZCxwcm9wczp7Y29sdW1uOnQuY29sdW1uLGNlbGw6dC5jZWxsLHJvdzp0LnJvd319KTp0LmNlbGwuZGF0YSl9ZnVuY3Rpb24gaG4odCl7dmFyIG49SXQoKSxlPWp0KGZ1bmN0aW9uKHQpe3JldHVybiB0LmhlYWRlcn0pO3JldHVybiB3KFwidHJcIix7Y2xhc3NOYW1lOnJ0KGV0KFwidHJcIiksbi5jbGFzc05hbWUudHIpLG9uQ2xpY2s6ZnVuY3Rpb24oZSl7dC5tZXNzYWdlUm93fHxuLmV2ZW50RW1pdHRlci5lbWl0KFwicm93Q2xpY2tcIixlLHQucm93KX19LHQuY2hpbGRyZW4/dC5jaGlsZHJlbjp0LnJvdy5jZWxscy5tYXAoZnVuY3Rpb24obixyKXt2YXIgbz1mdW5jdGlvbih0KXtpZihlKXt2YXIgbj1LdC5sZWFmQ29sdW1ucyhlLmNvbHVtbnMpO2lmKG4pcmV0dXJuIG5bdF19cmV0dXJuIG51bGx9KHIpO3JldHVybiBvJiZvLmhpZGRlbj9udWxsOncoZG4se2tleTpuLmlkLGNlbGw6bixyb3c6dC5yb3csY29sdW1uOm99KX0pKX1mdW5jdGlvbiBfbih0KXtyZXR1cm4gdyhobix7bWVzc2FnZVJvdzohMH0sdyhkbix7cm9sZTpcImFsZXJ0XCIsY29sU3Bhbjp0LmNvbFNwYW4sbWVzc2FnZUNlbGw6ITAsY2VsbDpuZXcgWCh0Lm1lc3NhZ2UpLGNsYXNzTmFtZTpydChldChcIm1lc3NhZ2VcIiksdC5jbGFzc05hbWU/dC5jbGFzc05hbWU6bnVsbCl9KSl9ZnVuY3Rpb24gbW4oKXt2YXIgdD1JdCgpLG49anQoZnVuY3Rpb24odCl7cmV0dXJuIHQuZGF0YX0pLGU9anQoZnVuY3Rpb24odCl7cmV0dXJuIHQuc3RhdHVzfSkscj1qdChmdW5jdGlvbih0KXtyZXR1cm4gdC5oZWFkZXJ9KSxvPUF0KCksaT1mdW5jdGlvbigpe3JldHVybiByP3IudmlzaWJsZUNvbHVtbnMubGVuZ3RoOjB9O3JldHVybiB3KFwidGJvZHlcIix7Y2xhc3NOYW1lOnJ0KGV0KFwidGJvZHlcIiksdC5jbGFzc05hbWUudGJvZHkpfSxuJiZuLnJvd3MubWFwKGZ1bmN0aW9uKHQpe3JldHVybiB3KGhuLHtrZXk6dC5pZCxyb3c6dH0pfSksZT09PWEuTG9hZGluZyYmKCFufHwwPT09bi5sZW5ndGgpJiZ3KF9uLHttZXNzYWdlOm8oXCJsb2FkaW5nXCIpLGNvbFNwYW46aSgpLGNsYXNzTmFtZTpydChldChcImxvYWRpbmdcIiksdC5jbGFzc05hbWUubG9hZGluZyl9KSxlPT09YS5SZW5kZXJlZCYmbiYmMD09PW4ubGVuZ3RoJiZ3KF9uLHttZXNzYWdlOm8oXCJub1JlY29yZHNGb3VuZFwiKSxjb2xTcGFuOmkoKSxjbGFzc05hbWU6cnQoZXQoXCJub3Rmb3VuZFwiKSx0LmNsYXNzTmFtZS5ub3Rmb3VuZCl9KSxlPT09YS5FcnJvciYmdyhfbix7bWVzc2FnZTpvKFwiZXJyb3JcIiksY29sU3BhbjppKCksY2xhc3NOYW1lOnJ0KGV0KFwiZXJyb3JcIiksdC5jbGFzc05hbWUuZXJyb3IpfSkpfXZhciB2bj0vKiNfX1BVUkVfXyovZnVuY3Rpb24odCl7ZnVuY3Rpb24gZSgpe3JldHVybiB0LmFwcGx5KHRoaXMsYXJndW1lbnRzKXx8dGhpc31yKGUsdCk7dmFyIG89ZS5wcm90b3R5cGU7cmV0dXJuIG8udmFsaWRhdGVQcm9wcz1mdW5jdGlvbigpe2Zvcih2YXIgdCxuPXModGhpcy5wcm9wcy5jb2x1bW5zKTshKHQ9bigpKS5kb25lOyl7dmFyIGU9dC52YWx1ZTt2b2lkIDA9PT1lLmRpcmVjdGlvbiYmKGUuZGlyZWN0aW9uPTEpLDEhPT1lLmRpcmVjdGlvbiYmLTEhPT1lLmRpcmVjdGlvbiYmVnQuZXJyb3IoXCJJbnZhbGlkIHNvcnQgZGlyZWN0aW9uIFwiK2UuZGlyZWN0aW9uKX19LG8uY29tcGFyZT1mdW5jdGlvbih0LG4pe3JldHVybiB0Pm4/MTp0PG4/LTE6MH0sby5jb21wYXJlV3JhcHBlcj1mdW5jdGlvbih0LG4pe2Zvcih2YXIgZSxyPTAsbz1zKHRoaXMucHJvcHMuY29sdW1ucyk7IShlPW8oKSkuZG9uZTspe3ZhciBpPWUudmFsdWU7aWYoMCE9PXIpYnJlYWs7dmFyIHU9dC5jZWxsc1tpLmluZGV4XS5kYXRhLGE9bi5jZWxsc1tpLmluZGV4XS5kYXRhO3J8PVwiZnVuY3Rpb25cIj09dHlwZW9mIGkuY29tcGFyZT9pLmNvbXBhcmUodSxhKSppLmRpcmVjdGlvbjp0aGlzLmNvbXBhcmUodSxhKSppLmRpcmVjdGlvbn1yZXR1cm4gcn0sby5fcHJvY2Vzcz1mdW5jdGlvbih0KXt2YXIgbj1bXS5jb25jYXQodC5yb3dzKTtuLnNvcnQodGhpcy5jb21wYXJlV3JhcHBlci5iaW5kKHRoaXMpKTt2YXIgZT1uZXcgSihuKTtyZXR1cm4gZS5sZW5ndGg9dC5sZW5ndGgsZX0sbihlLFt7a2V5OlwidHlwZVwiLGdldDpmdW5jdGlvbigpe3JldHVybiBLLlNvcnR9fV0pLGV9KHR0KSx5bj1mdW5jdGlvbih0LG4scixvKXtyZXR1cm4gZnVuY3Rpb24oaSl7dmFyIHUscz1udWxsIT0odT1pLnNvcnQpJiZ1LmNvbHVtbnM/aS5zb3J0LmNvbHVtbnMubWFwKGZ1bmN0aW9uKHQpe3JldHVybiBlKHt9LHQpfSk6W10sYT1zLmxlbmd0aCxsPXMuZmluZChmdW5jdGlvbihuKXtyZXR1cm4gbi5pbmRleD09PXR9KSxjPSExLGY9ITEscD0hMSxkPSExO2lmKHZvaWQgMCE9PWw/cj8tMT09PWwuZGlyZWN0aW9uP3A9ITA6ZD0hMDoxPT09YT9kPSEwOmE+MSYmKGY9ITAsYz0hMCk6MD09PWE/Yz0hMDphPjAmJiFyPyhjPSEwLGY9ITApOmE+MCYmciYmKGM9ITApLGYmJihzPVtdKSxjKXMucHVzaCh7aW5kZXg6dCxkaXJlY3Rpb246bixjb21wYXJlOm99KTtlbHNlIGlmKGQpe3ZhciBoPXMuaW5kZXhPZihsKTtzW2hdLmRpcmVjdGlvbj1ufWVsc2UgaWYocCl7dmFyIF89cy5pbmRleE9mKGwpO3Muc3BsaWNlKF8sMSl9cmV0dXJuIGUoe30saSx7c29ydDp7Y29sdW1uczpzfX0pfX0sZ249ZnVuY3Rpb24odCxuLHIpe3JldHVybiBmdW5jdGlvbihvKXt2YXIgaT0oby5zb3J0P1tdLmNvbmNhdChvLnNvcnQuY29sdW1ucyk6W10pLmZpbmQoZnVuY3Rpb24obil7cmV0dXJuIG4uaW5kZXg9PT10fSk7cmV0dXJuIGUoe30sbyxpP3luKHQsMT09PWkuZGlyZWN0aW9uPy0xOjEsbixyKShvKTp5bih0LDEsbixyKShvKSl9fSxibj0vKiNfX1BVUkVfXyovZnVuY3Rpb24odCl7ZnVuY3Rpb24gbygpe3JldHVybiB0LmFwcGx5KHRoaXMsYXJndW1lbnRzKXx8dGhpc31yZXR1cm4gcihvLHQpLG8ucHJvdG90eXBlLl9wcm9jZXNzPWZ1bmN0aW9uKHQpe3ZhciBuPXt9O3JldHVybiB0aGlzLnByb3BzLnVybCYmKG4udXJsPXRoaXMucHJvcHMudXJsKHQudXJsLHRoaXMucHJvcHMuY29sdW1ucykpLHRoaXMucHJvcHMuYm9keSYmKG4uYm9keT10aGlzLnByb3BzLmJvZHkodC5ib2R5LHRoaXMucHJvcHMuY29sdW1ucykpLGUoe30sdCxuKX0sbihvLFt7a2V5OlwidHlwZVwiLGdldDpmdW5jdGlvbigpe3JldHVybiBLLlNlcnZlclNvcnR9fV0pLG99KHR0KTtmdW5jdGlvbiB3bih0KXt2YXIgbj1JdCgpLHI9SHQoKS5kaXNwYXRjaCxvPUF0KCksaT15dCgwKSx1PWlbMF0scz1pWzFdLGE9bi5zb3J0LGw9anQoZnVuY3Rpb24odCl7cmV0dXJuIHQuc29ydH0pLGM9XCJvYmplY3RcIj09dHlwZW9mKG51bGw9PWE/dm9pZCAwOmEuc2VydmVyKT9LLlNlcnZlclNvcnQ6Sy5Tb3J0LGY9ZnVuY3Rpb24oKXt2YXIgdD1uLnBpcGVsaW5lLmdldFN0ZXBzQnlUeXBlKGMpO2lmKHQubGVuZ3RoKXJldHVybiB0WzBdfTtyZXR1cm4gZ3QoZnVuY3Rpb24oKXt2YXIgdD1mKCl8fChjPT09Sy5TZXJ2ZXJTb3J0P25ldyBibihlKHtjb2x1bW5zOmw/bC5jb2x1bW5zOltdfSxhLnNlcnZlcikpOm5ldyB2bih7Y29sdW1uczpsP2wuY29sdW1uczpbXX0pKTtyZXR1cm4gbi5waXBlbGluZS50cnlSZWdpc3Rlcih0KSxmdW5jdGlvbigpe3JldHVybiBuLnBpcGVsaW5lLnVucmVnaXN0ZXIodCl9fSxbbl0pLGd0KGZ1bmN0aW9uKCl7aWYobCl7dmFyIG4sZT1sLmNvbHVtbnMuZmluZChmdW5jdGlvbihuKXtyZXR1cm4gbi5pbmRleD09PXQuaW5kZXh9KTtlPygwPT09dSYmKGUuZGlyZWN0aW9uPW51bGwhPShuPXQuZGlyZWN0aW9uKT9uOjEpLHMoZS5kaXJlY3Rpb24pKTpzKDApfX0sW2xdKSxndChmdW5jdGlvbigpe3ZhciB0PWYoKTt0JiZsJiZ0LnNldFByb3BzKHtjb2x1bW5zOmwuY29sdW1uc30pfSxbbF0pLHcoXCJidXR0b25cIix7dGFiSW5kZXg6LTEsXCJhcmlhLWxhYmVsXCI6byhcInNvcnQuc29ydFwiKygxPT09dT9cIkRlc2NcIjpcIkFzY1wiKSksdGl0bGU6byhcInNvcnQuc29ydFwiKygxPT09dT9cIkRlc2NcIjpcIkFzY1wiKSksY2xhc3NOYW1lOnJ0KGV0KFwic29ydFwiKSxldChcInNvcnRcIixmdW5jdGlvbih0KXtyZXR1cm4gMT09PXQ/XCJhc2NcIjotMT09PXQ/XCJkZXNjXCI6XCJuZXV0cmFsXCJ9KHUpKSxuLmNsYXNzTmFtZS5zb3J0KSxvbkNsaWNrOmZ1bmN0aW9uKG4pe24ucHJldmVudERlZmF1bHQoKSxuLnN0b3BQcm9wYWdhdGlvbigpLHIoZ24odC5pbmRleCwhMD09PW4uc2hpZnRLZXkmJmEubXVsdGlDb2x1bW4sdC5jb21wYXJlKSl9fSl9dmFyIHhuPWZ1bmN0aW9uKHQsbil7dmFyIGU7dm9pZCAwPT09biYmKG49MTAwKTt2YXIgcj1EYXRlLm5vdygpLG89ZnVuY3Rpb24oKXtyPURhdGUubm93KCksdC5hcHBseSh2b2lkIDAsW10uc2xpY2UuY2FsbChhcmd1bWVudHMpKX07cmV0dXJuIGZ1bmN0aW9uKCl7dmFyIHQ9W10uc2xpY2UuY2FsbChhcmd1bWVudHMpLGk9RGF0ZS5ub3coKSx1PWktcjt1Pj1uP28uYXBwbHkodm9pZCAwLHQpOihlJiZjbGVhclRpbWVvdXQoZSksZT1zZXRUaW1lb3V0KGZ1bmN0aW9uKCl7by5hcHBseSh2b2lkIDAsdCksZT1udWxsfSxuLXUpKX19O2Z1bmN0aW9uIGtuKHQpe3ZhciBuLGU9ZnVuY3Rpb24odCl7cmV0dXJuIHQgaW5zdGFuY2VvZiBNb3VzZUV2ZW50P01hdGguZmxvb3IodC5wYWdlWCk6TWF0aC5mbG9vcih0LmNoYW5nZWRUb3VjaGVzWzBdLnBhZ2VYKX0scj1mdW5jdGlvbihyKXtyLnN0b3BQcm9wYWdhdGlvbigpO3ZhciB1PXBhcnNlSW50KHQudGhSZWYuY3VycmVudC5zdHlsZS53aWR0aCwxMCktZShyKTtuPXhuKGZ1bmN0aW9uKHQpe3JldHVybiBvKHQsdSl9LDEwKSxkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLGkpLGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJ0b3VjaGVuZFwiLGkpLGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIixuKSxkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwidG91Y2htb3ZlXCIsbil9LG89ZnVuY3Rpb24obixyKXtuLnN0b3BQcm9wYWdhdGlvbigpO3ZhciBvPXQudGhSZWYuY3VycmVudDtyK2Uobik+PXBhcnNlSW50KG8uc3R5bGUubWluV2lkdGgsMTApJiYoby5zdHlsZS53aWR0aD1yK2UobikrXCJweFwiKX0saT1mdW5jdGlvbiB0KGUpe2Uuc3RvcFByb3BhZ2F0aW9uKCksZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNldXBcIix0KSxkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsbiksZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInRvdWNobW92ZVwiLG4pLGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJ0b3VjaGVuZFwiLHQpfTtyZXR1cm4gdyhcImRpdlwiLHtjbGFzc05hbWU6cnQoZXQoXCJ0aFwiKSxldChcInJlc2l6YWJsZVwiKSksb25Nb3VzZURvd246cixvblRvdWNoU3RhcnQ6cixvbkNsaWNrOmZ1bmN0aW9uKHQpe3JldHVybiB0LnN0b3BQcm9wYWdhdGlvbigpfX0pfWZ1bmN0aW9uIFNuKHQpe3ZhciBuPUl0KCkscj1idChudWxsKSxvPXl0KHt9KSxpPW9bMF0sdT1vWzFdLHM9SHQoKS5kaXNwYXRjaDtndChmdW5jdGlvbigpe2lmKG4uZml4ZWRIZWFkZXImJnIuY3VycmVudCl7dmFyIHQ9ci5jdXJyZW50Lm9mZnNldFRvcDtcIm51bWJlclwiPT10eXBlb2YgdCYmdSh7dG9wOnR9KX19LFtyXSk7dmFyIGEsbD1mdW5jdGlvbigpe3JldHVybiBudWxsIT10LmNvbHVtbi5zb3J0fSxjPWZ1bmN0aW9uKGUpe2Uuc3RvcFByb3BhZ2F0aW9uKCksbCgpJiZzKGduKHQuaW5kZXgsITA9PT1lLnNoaWZ0S2V5JiZuLnNvcnQubXVsdGlDb2x1bW4sdC5jb2x1bW4uc29ydC5jb21wYXJlKSl9O3JldHVybiB3KFwidGhcIixlKHtyZWY6cixcImRhdGEtY29sdW1uLWlkXCI6dC5jb2x1bW4mJnQuY29sdW1uLmlkLGNsYXNzTmFtZTpydChldChcInRoXCIpLGwoKT9ldChcInRoXCIsXCJzb3J0XCIpOm51bGwsbi5maXhlZEhlYWRlcj9ldChcInRoXCIsXCJmaXhlZFwiKTpudWxsLG4uY2xhc3NOYW1lLnRoKSxvbkNsaWNrOmMsc3R5bGU6ZSh7fSxuLnN0eWxlLnRoLHttaW5XaWR0aDp0LmNvbHVtbi5taW5XaWR0aCx3aWR0aDp0LmNvbHVtbi53aWR0aH0saSx0LnN0eWxlKSxvbktleURvd246ZnVuY3Rpb24odCl7bCgpJiYxMz09PXQud2hpY2gmJmModCl9LHJvd1NwYW46dC5yb3dTcGFuPjE/dC5yb3dTcGFuOnZvaWQgMCxjb2xTcGFuOnQuY29sU3Bhbj4xP3QuY29sU3Bhbjp2b2lkIDB9LChhPXQuY29sdW1uKT9cImZ1bmN0aW9uXCI9PXR5cGVvZiBhLmF0dHJpYnV0ZXM/YS5hdHRyaWJ1dGVzKG51bGwsbnVsbCx0LmNvbHVtbik6YS5hdHRyaWJ1dGVzOnt9LGwoKT97dGFiSW5kZXg6MH06e30pLHcoXCJkaXZcIix7Y2xhc3NOYW1lOmV0KFwidGhcIixcImNvbnRlbnRcIil9LHZvaWQgMCE9PXQuY29sdW1uLm5hbWU/dC5jb2x1bW4ubmFtZTp2b2lkIDAhPT10LmNvbHVtbi5wbHVnaW4/dyhHdCx7cGx1Z2luSWQ6dC5jb2x1bW4ucGx1Z2luLmlkLHByb3BzOntjb2x1bW46dC5jb2x1bW59fSk6bnVsbCksbCgpJiZ3KHduLGUoe2luZGV4OnQuaW5kZXh9LHQuY29sdW1uLnNvcnQpKSx0LmNvbHVtbi5yZXNpemFibGUmJnQuaW5kZXg8bi5oZWFkZXIudmlzaWJsZUNvbHVtbnMubGVuZ3RoLTEmJncoa24se2NvbHVtbjp0LmNvbHVtbix0aFJlZjpyfSkpfWZ1bmN0aW9uIE5uKCl7dmFyIHQsbj1JdCgpLGU9anQoZnVuY3Rpb24odCl7cmV0dXJuIHQuaGVhZGVyfSk7cmV0dXJuIGU/dyhcInRoZWFkXCIse2tleTplLmlkLGNsYXNzTmFtZTpydChldChcInRoZWFkXCIpLG4uY2xhc3NOYW1lLnRoZWFkKX0sKHQ9S3QudGFidWxhckZvcm1hdChlLmNvbHVtbnMpKS5tYXAoZnVuY3Rpb24obixyKXtyZXR1cm4gZnVuY3Rpb24odCxuLHIpe3ZhciBvPUt0LmxlYWZDb2x1bW5zKGUuY29sdW1ucyk7cmV0dXJuIHcoaG4sbnVsbCx0Lm1hcChmdW5jdGlvbih0KXtyZXR1cm4gdC5oaWRkZW4/bnVsbDpmdW5jdGlvbih0LG4sZSxyKXt2YXIgbz1mdW5jdGlvbih0LG4sZSl7dmFyIHI9S3QubWF4aW11bURlcHRoKHQpLG89ZS1uO3JldHVybntyb3dTcGFuOk1hdGguZmxvb3Ioby1yLXIvbyksY29sU3Bhbjp0LmNvbHVtbnMmJnQuY29sdW1ucy5sZW5ndGh8fDF9fSh0LG4scik7cmV0dXJuIHcoU24se2NvbHVtbjp0LGluZGV4OmUsY29sU3BhbjpvLmNvbFNwYW4scm93U3BhbjpvLnJvd1NwYW59KX0odCxuLG8uaW5kZXhPZih0KSxyKX0pKX0obixyLHQubGVuZ3RoKX0pKTpudWxsfXZhciBQbj1mdW5jdGlvbih0KXtyZXR1cm4gZnVuY3Rpb24obil7cmV0dXJuIGUoe30sbix7aGVhZGVyOnR9KX19O2Z1bmN0aW9uIENuKCl7dmFyIHQ9SXQoKSxuPWJ0KG51bGwpLHI9SHQoKS5kaXNwYXRjaDtyZXR1cm4gZ3QoZnVuY3Rpb24oKXtuJiZyKGZ1bmN0aW9uKHQpe3JldHVybiBmdW5jdGlvbihuKXtyZXR1cm4gZSh7fSxuLHt0YWJsZVJlZjp0fSl9fShuKSl9LFtuXSksdyhcInRhYmxlXCIse3JlZjpuLHJvbGU6XCJncmlkXCIsY2xhc3NOYW1lOnJ0KGV0KFwidGFibGVcIiksdC5jbGFzc05hbWUudGFibGUpLHN0eWxlOmUoe30sdC5zdHlsZS50YWJsZSx7aGVpZ2h0OnQuaGVpZ2h0fSl9LHcoTm4sbnVsbCksdyhtbixudWxsKSl9ZnVuY3Rpb24gRW4oKXt2YXIgdD15dCghMCksbj10WzBdLHI9dFsxXSxvPWJ0KG51bGwpLGk9SXQoKTtyZXR1cm4gZ3QoZnVuY3Rpb24oKXswPT09by5jdXJyZW50LmNoaWxkcmVuLmxlbmd0aCYmcighMSl9LFtvXSksbj93KFwiZGl2XCIse3JlZjpvLGNsYXNzTmFtZTpydChldChcImhlYWRcIiksaS5jbGFzc05hbWUuaGVhZGVyKSxzdHlsZTplKHt9LGkuc3R5bGUuaGVhZGVyKX0sdyhHdCx7cG9zaXRpb246enQuSGVhZGVyfSkpOm51bGx9ZnVuY3Rpb24gSW4oKXt2YXIgdD1idChudWxsKSxuPXl0KCEwKSxyPW5bMF0sbz1uWzFdLGk9SXQoKTtyZXR1cm4gZ3QoZnVuY3Rpb24oKXswPT09dC5jdXJyZW50LmNoaWxkcmVuLmxlbmd0aCYmbyghMSl9LFt0XSkscj93KFwiZGl2XCIse3JlZjp0LGNsYXNzTmFtZTpydChldChcImZvb3RlclwiKSxpLmNsYXNzTmFtZS5mb290ZXIpLHN0eWxlOmUoe30saS5zdHlsZS5mb290ZXIpfSx3KEd0LHtwb3NpdGlvbjp6dC5Gb290ZXJ9KSk6bnVsbH1mdW5jdGlvbiBUbigpe3ZhciB0PUl0KCksbj1IdCgpLmRpc3BhdGNoLHI9anQoZnVuY3Rpb24odCl7cmV0dXJuIHQuc3RhdHVzfSksbz1qdChmdW5jdGlvbih0KXtyZXR1cm4gdC5kYXRhfSksaT1qdChmdW5jdGlvbih0KXtyZXR1cm4gdC50YWJsZVJlZn0pLHU9e2N1cnJlbnQ6bnVsbH0scz14bihmdW5jdGlvbigpe3RyeXtuKGZ1bmN0aW9uKHQpe3JldHVybiBlKHt9LHQse3N0YXR1czphLkxvYWRpbmd9KX0pO3ZhciByPWZ1bmN0aW9uKHIsbyl7dHJ5e3ZhciBpPVByb21pc2UucmVzb2x2ZSh0LnBpcGVsaW5lLnByb2Nlc3MoKSkudGhlbihmdW5jdGlvbih0KXtuKGZ1bmN0aW9uKHQpe3JldHVybiBmdW5jdGlvbihuKXtyZXR1cm4gdD9lKHt9LG4se2RhdGE6dCxzdGF0dXM6YS5Mb2FkZWR9KTpufX0odCkpLHNldFRpbWVvdXQoZnVuY3Rpb24oKXtuKGZ1bmN0aW9uKHQpe3JldHVybiB0LnN0YXR1cz09PWEuTG9hZGVkP2Uoe30sdCx7c3RhdHVzOmEuUmVuZGVyZWR9KTp0fSl9LDApfSl9Y2F0Y2godCl7cmV0dXJuIG8odCl9cmV0dXJuIGkmJmkudGhlbj9pLnRoZW4odm9pZCAwLG8pOml9KDAsZnVuY3Rpb24odCl7VnQuZXJyb3IodCksbihmdW5jdGlvbih0KXtyZXR1cm4gZSh7fSx0LHtkYXRhOm51bGwsc3RhdHVzOmEuRXJyb3J9KX0pfSk7cmV0dXJuIFByb21pc2UucmVzb2x2ZShyJiZyLnRoZW4/ci50aGVuKGZ1bmN0aW9uKCl7fSk6dm9pZCAwKX1jYXRjaCh0KXtyZXR1cm4gUHJvbWlzZS5yZWplY3QodCl9fSx0LnByb2Nlc3NpbmdUaHJvdHRsZU1zKTtyZXR1cm4gZ3QoZnVuY3Rpb24oKXtyZXR1cm4gbihQbih0LmhlYWRlcikpLHMoKSx0LnBpcGVsaW5lLm9uKFwidXBkYXRlZFwiLHMpLGZ1bmN0aW9uKCl7cmV0dXJuIHQucGlwZWxpbmUub2ZmKFwidXBkYXRlZFwiLHMpfX0sW10pLGd0KGZ1bmN0aW9uKCl7dC5oZWFkZXImJnI9PT1hLkxvYWRlZCYmbnVsbCE9byYmby5sZW5ndGgmJm4oUG4odC5oZWFkZXIuYWRqdXN0V2lkdGgodCxpLHUpKSl9LFtvLHQsdV0pLHcoXCJkaXZcIix7cm9sZTpcImNvbXBsZW1lbnRhcnlcIixjbGFzc05hbWU6cnQoXCJncmlkanNcIixldChcImNvbnRhaW5lclwiKSxyPT09YS5Mb2FkaW5nP2V0KFwibG9hZGluZ1wiKTpudWxsLHQuY2xhc3NOYW1lLmNvbnRhaW5lciksc3R5bGU6ZSh7fSx0LnN0eWxlLmNvbnRhaW5lcix7d2lkdGg6dC53aWR0aH0pfSxyPT09YS5Mb2FkaW5nJiZ3KFwiZGl2XCIse2NsYXNzTmFtZTpldChcImxvYWRpbmctYmFyXCIpfSksdyhFbixudWxsKSx3KFwiZGl2XCIse2NsYXNzTmFtZTpldChcIndyYXBwZXJcIiksc3R5bGU6e2hlaWdodDp0LmhlaWdodH19LHcoQ24sbnVsbCkpLHcoSW4sbnVsbCksdyhcImRpdlwiLHtyZWY6dSxpZDpcImdyaWRqcy10ZW1wXCIsY2xhc3NOYW1lOmV0KFwidGVtcFwiKX0pKX12YXIgTG49LyojX19QVVJFX18qL2Z1bmN0aW9uKHQpe2Z1bmN0aW9uIG4obil7dmFyIGU7cmV0dXJuKGU9dC5jYWxsKHRoaXMpfHx0aGlzKS5jb25maWc9dm9pZCAwLGUucGx1Z2luPXZvaWQgMCxlLmNvbmZpZz0obmV3IHBuKS5hc3NpZ24oe2luc3RhbmNlOmkoZSksZXZlbnRFbWl0dGVyOmkoZSl9KS51cGRhdGUobiksZS5wbHVnaW49ZS5jb25maWcucGx1Z2luLGV9cihuLHQpO3ZhciBlPW4ucHJvdG90eXBlO3JldHVybiBlLnVwZGF0ZUNvbmZpZz1mdW5jdGlvbih0KXtyZXR1cm4gdGhpcy5jb25maWcudXBkYXRlKHQpLHRoaXN9LGUuY3JlYXRlRWxlbWVudD1mdW5jdGlvbigpe3JldHVybiB3KGZuLlByb3ZpZGVyLHt2YWx1ZTp0aGlzLmNvbmZpZyxjaGlsZHJlbjp3KFRuLHt9KX0pfSxlLmZvcmNlUmVuZGVyPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuY29uZmlnJiZ0aGlzLmNvbmZpZy5jb250YWluZXJ8fFZ0LmVycm9yKFwiQ29udGFpbmVyIGlzIGVtcHR5LiBNYWtlIHN1cmUgeW91IGNhbGwgcmVuZGVyKCkgYmVmb3JlIGZvcmNlUmVuZGVyKClcIiwhMCksdGhpcy5kZXN0cm95KCkscSh0aGlzLmNyZWF0ZUVsZW1lbnQoKSx0aGlzLmNvbmZpZy5jb250YWluZXIpLHRoaXN9LGUuZGVzdHJveT1mdW5jdGlvbigpe3RoaXMuY29uZmlnLnBpcGVsaW5lLmNsZWFyQ2FjaGUoKSxxKG51bGwsdGhpcy5jb25maWcuY29udGFpbmVyKX0sZS5yZW5kZXI9ZnVuY3Rpb24odCl7cmV0dXJuIHR8fFZ0LmVycm9yKFwiQ29udGFpbmVyIGVsZW1lbnQgY2Fubm90IGJlIG51bGxcIiwhMCksdC5jaGlsZE5vZGVzLmxlbmd0aD4wPyhWdC5lcnJvcihcIlRoZSBjb250YWluZXIgZWxlbWVudCBcIit0K1wiIGlzIG5vdCBlbXB0eS4gTWFrZSBzdXJlIHRoZSBjb250YWluZXIgaXMgZW1wdHkgYW5kIGNhbGwgcmVuZGVyKCkgYWdhaW5cIiksdGhpcyk6KHRoaXMuY29uZmlnLmNvbnRhaW5lcj10LHEodGhpcy5jcmVhdGVFbGVtZW50KCksdCksdGhpcyl9LG59KFEpO2V4cG9ydHtYIGFzIENlbGwsTiBhcyBDb21wb25lbnQscG4gYXMgQ29uZmlnLExuIGFzIEdyaWQsenQgYXMgUGx1Z2luUG9zaXRpb24sWiBhcyBSb3csZXQgYXMgY2xhc3NOYW1lLHcgYXMgY3JlYXRlRWxlbWVudCxrIGFzIGNyZWF0ZVJlZix3IGFzIGgsRyBhcyBodG1sLEl0IGFzIHVzZUNvbmZpZyxndCBhcyB1c2VFZmZlY3QsYnQgYXMgdXNlUmVmLGp0IGFzIHVzZVNlbGVjdG9yLHl0IGFzIHVzZVN0YXRlLEh0IGFzIHVzZVN0b3JlLEF0IGFzIHVzZVRyYW5zbGF0b3J9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Z3JpZGpzLm1vZHVsZS5qcy5tYXBcbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiaW1wb3J0IHsgR3JpZCwgaHRtbCB9IGZyb20gJ2dyaWRqcydcblxuY29uc3QgZGF0YSA9IFtcbiAgWydKb2huJywgJ2pvaG5AZXhhbXBsZS5jb20nLCAnYW5jcmUnLCB0cnVlXSxcbiAgWydNYXJrJywgJ21hcmtAZ21haWwuY29tJywgJ2FuY3JlJywgZmFsc2VdLFxuICBbJ0VvaW4nLCAnZW9pbkBnbWFpbC5jb20nLCAnYW5jcmUnLCB0cnVlXSxcbiAgWydTYXJhaCcsICdzYXJhaGNkZEBnbWFpbC5jb20nLCAnYW5jcmUnLCBmYWxzZV0sXG4gIFsnQWZzaGluJywgJ2Fmc2hpbkBtYWlsLmNvbScsICdhbmNyZScsICdpZGxlJ10sXG5dXG5cbmNvbnN0IGdyaWRDb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ3JpZGpzLWNvbnRhaW5lcicpXG5jb25zdCBncmlkID0gbmV3IEdyaWQoe1xuICBjb2x1bW5zOiBbXG4gICAge1xuICAgICAgbmFtZTogJ1NpdGUnLFxuICAgICAgYXR0cmlidXRlczogKGNlbGwsIHJvdykgPT4gKHsgLi4uZm9ybWF0QXR0cmlidXRlcyhjZWxsLCByb3cpIH0pLFxuICAgICAgZm9ybWF0dGVyOiAoY2VsbCwgXywgY29sdW1uKSA9PiBmb3JtYXRPdXRwdXQoY2VsbCwgXywgY29sdW1uKSxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdVcmwnLFxuICAgICAgYXR0cmlidXRlczogKGNlbGwsIHJvdykgPT4gKHsgLi4uZm9ybWF0QXR0cmlidXRlcyhjZWxsLCByb3cpIH0pLFxuICAgICAgZm9ybWF0dGVyOiAoY2VsbCwgXywgY29sdW1uKSA9PiBmb3JtYXRPdXRwdXQoY2VsbCwgXywgY29sdW1uKSxcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdBbmNyZScsXG4gICAgICBhdHRyaWJ1dGVzOiAoY2VsbCwgcm93KSA9PiAoeyAuLi5mb3JtYXRBdHRyaWJ1dGVzKGNlbGwsIHJvdykgfSksXG4gICAgICBmb3JtYXR0ZXI6IChjZWxsLCBfLCBjb2x1bW4pID0+IGZvcm1hdE91dHB1dChjZWxsLCBfLCBjb2x1bW4pLFxuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ8OJdGF0JyxcbiAgICAgIGF0dHJpYnV0ZXM6IChjZWxsLCByb3cpID0+ICh7IC4uLmZvcm1hdEF0dHJpYnV0ZXMoY2VsbCwgcm93KSB9KSxcbiAgICAgIGZvcm1hdHRlcjogKGNlbGwsIF8sIGNvbHVtbikgPT4gZm9ybWF0T3V0cHV0KGNlbGwsIF8sIGNvbHVtbiksXG4gICAgfSxcbiAgXSxcbiAgc29ydDogdHJ1ZSxcbiAgZGF0YTogZmV0Y2hCYWNrbGlua3MsXG59KS5yZW5kZXIoZ3JpZENvbnRhaW5lcilcblxuZ3JpZC5vbignY2VsbENsaWNrJywgKGUsIGFyZ3MpID0+IGNvcHlMaW5rRWxlbWVudChlLCBhcmdzLmRhdGEpKVxuZ3JpZC5vbigncm93Q2xpY2snLCAoZSwgYXJncykgPT4gZGVsZXRlTGlua0VsZW1lbnQoZSwgYXJncy5jZWxscykpXG5cbi8qKioqKiBVdGlscyAqKioqKi9cbmFzeW5jIGZ1bmN0aW9uIGZldGNoQmFja2xpbmtzKCkge1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goJy9hcGkvYmFja2xpbmtzJylcbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoKVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCByZXNwb25zZURBdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKClcbiAgICAgIGNvbnN0IGRhdGFGb3JtYXR0ZWQgPSByZXNwb25zZURBdGEubWFwKChkYXRhKSA9PiB7XG4gICAgICAgIGxldCBzaXRlRGF0YVxuICAgICAgICBsZXQgdXJsRGF0YVxuICAgICAgICBsZXQgYW5jaG9yRGF0YVxuICAgICAgICBpZiAoIWRhdGEuc3RhdGUpIHtcbiAgICAgICAgICBzaXRlRGF0YSA9IGRhdGEuc2l0ZSA/PyAnPydcbiAgICAgICAgICB1cmxEYXRhID0gZGF0YS51cmwgPz8gJz8nXG4gICAgICAgICAgYW5jaG9yRGF0YSA9IGRhdGEuYW5jaG9yID8/ICc/J1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNpdGVEYXRhID0gZGF0YS5zaXRlID8/ICdsb2FkaW5nJ1xuICAgICAgICAgIHVybERhdGEgPSBkYXRhLnVybCA/PyAnbG9hZGluZydcbiAgICAgICAgICBhbmNob3JEYXRhID0gZGF0YS5hbmNob3IgPz8gJ2xvYWRpbmcnXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFtzaXRlRGF0YSwgdXJsRGF0YSwgYW5jaG9yRGF0YSwgZGF0YS5zdGF0ZSA/PyAnbG9hZGluZyddXG4gICAgICB9KVxuICAgICAgcmV0dXJuIGRhdGFGb3JtYXR0ZWQucmV2ZXJzZSgpXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUubG9nKCdBbiBlcnJvciBpcyBvY2N1cmVkIDooJylcbiAgfVxufVxuXG5mdW5jdGlvbiBiYWNrZ3JvdW5kQ2xhc3Moc3RhdHVzKSB7XG4gIHN3aXRjaCAoc3RhdHVzKSB7XG4gICAgY2FzZSAnb2snOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY2xhc3M6ICdncmlkanMtdGQgIWJnLWVtZXJhbGQtMjAwIGN1cnNvci1kZWZhdWx0IG1heC13LVsxNTBweF0gdHJ1bmNhdGUgcmVsYXRpdmUgZ3JvdXAnLFxuICAgICAgfVxuICAgIGNhc2UgJ2tvJzpcbiAgICAgIHJldHVybiB7IGNsYXNzOiAnZ3JpZGpzLXRkICFiZy1yZWQtMjAwIGN1cnNvci1kZWZhdWx0IG1heC13LVsxNTBweF0gdHJ1bmNhdGUgcmVsYXRpdmUgZ3JvdXAnIH1cbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY2xhc3M6ICdncmlkanMtdGQgIWJnLXN0b25lLTEwMCBjdXJzb3ItZGVmYXVsdCBtYXgtdy1bMTUwcHhdIHRydW5jYXRlIHJlbGF0aXZlIGdyb3VwJyxcbiAgICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBmb3JtYXRBdHRyaWJ1dGVzKGNlbGwsIHJvdykge1xuICBpZiAoY2VsbCA9PT0gbnVsbCkgcmV0dXJuXG4gIGNvbnN0IGlzTGlua0FjdGl2ZSA9IHJvdz8uY2VsbHNbM10uZGF0YVxuICBzd2l0Y2ggKGlzTGlua0FjdGl2ZSkge1xuICAgIGNhc2UgdHJ1ZTpcbiAgICAgIHJldHVybiB7IC4uLmJhY2tncm91bmRDbGFzcygnb2snKSB9XG4gICAgY2FzZSBmYWxzZTpcbiAgICAgIHJldHVybiB7IC4uLmJhY2tncm91bmRDbGFzcygna28nKSB9XG4gICAgY2FzZSAnaWRsZSc6XG4gICAgICByZXR1cm4geyAuLi5iYWNrZ3JvdW5kQ2xhc3MoJ2lkbGUnKSB9XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB7IC4uLmJhY2tncm91bmRDbGFzcygpIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBmb3JtYXRPdXRwdXQoY2VsbCwgXywgY29sdW1uKSB7XG4gIGxldCBjb250ZW50XG4gIGlmIChjZWxsID09PSB0cnVlKSB7XG4gICAgY29udGVudCA9ICdhY3RpZidcbiAgfSBlbHNlIGlmIChjZWxsID09PSBmYWxzZSkge1xuICAgIGNvbnRlbnQgPSAnaW5hY3RpZidcbiAgfSBlbHNlIGlmIChjZWxsID09PSAnaWRsZScpIHtcbiAgICBjb250ZW50ID0gY3JlYXRlSW50ZXJyb2dhdGlvblBvaW50Q2VsbCgpXG4gIH0gZWxzZSBpZiAoY2VsbCA9PT0gJ2xvYWRpbmcnKSB7XG4gICAgY29udGVudCA9IGNyZWF0ZUxvYWRpbmdDZWxsKClcbiAgfSBlbHNlIGlmIChjZWxsID09PSAnPycgJiYgY29sdW1uLm5hbWUgIT09ICdTaXRlJykge1xuICAgIGNvbnRlbnQgPSBjcmVhdGVJbnRlcnJvZ2F0aW9uUG9pbnRDZWxsKClcbiAgfSBlbHNlIGlmIChjb2x1bW4ubmFtZSA9PT0gJ1NpdGUnKSB7XG4gICAgY29udGVudCA9XG4gICAgICBjZWxsID09PSAnPydcbiAgICAgICAgPyBgPHNwYW4gY2xhc3M9J3ctZnVsbCBibG9jayB0ZXh0LWNlbnRlciBjdXJzb3ItZGVmYXVsdCc+Pzwvc2Fwbj5gXG4gICAgICAgIDogYDxzcGFuPiR7Y2VsbH08L3NwYW4+YFxuICAgIGNvbnRlbnQgPSBodG1sKGBcbiAgICAgICAgJHtjb250ZW50fVxuICAgICAgICA8ZGl2IGNsYXNzPVwiZGVsZXRlIGFic29sdXRlIHRvcC0xLzIgLXRyYW5zbGF0ZS15LTEvMiByaWdodC0yIGJnLWdyYXktMjAwLzcwIHRleHQtZ3JheS03MDAgcC0yIGN1cnNvci1wb2ludGVyIGhvdmVyOmJnLWdyYXktMzAwIGhpZGRlbiBncm91cC1ob3ZlcjpibG9jayByb3VuZGVkXCI+XG4gICAgICAgICAgICA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB3aWR0aD1cIjI1XCIgaGVpZ2h0PVwiMjVcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCI+XG4gICAgICAgICAgICAgICAgPHBhdGggZmlsbD1cImN1cnJlbnRDb2xvclwiIGQ9XCJNNyAyMXEtLjgyNSAwLTEuNDEzLS41ODhUNSAxOVY2SDRWNGg1VjNoNnYxaDV2MmgtMXYxM3EwIC44MjUtLjU4OCAxLjQxM1QxNyAyMUg3Wk0xNyA2SDd2MTNoMTBWNlpNOSAxN2gyVjhIOXY5Wm00IDBoMlY4aC0ydjlaTTcgNnYxM1Y2WlwiLz5cbiAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICA8L2Rpdj5cbmApXG4gIH0gZWxzZSBpZiAoY29sdW1uLm5hbWUgPT09ICdVcmwnKSB7XG4gICAgY29uc3QgW2lzSW5wdXRTdHJpbmcsIHZhbHVlLCByYWlzZUVycm9yXSA9IGNlbGwuc3BsaXQoJyAnKVxuICAgIGNvbnN0IGlzSW5wdXQgPSBpc0lucHV0U3RyaW5nID09PSAnI2lucHV0IydcbiAgICBpZiAoIWlzSW5wdXQpIHtcbiAgICAgIGNvbnRlbnQgPSBodG1sKGBcbiAgICAgICAgICAgICAgICA8c3Bhbj4ke2NlbGx9PC9zcGFuPlxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidXJsIGFic29sdXRlIGluc2V0LTAgY3Vyc29yLXBvaW50ZXJcIj48L3NwYW4+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvcHktY29udGVudCBhYnNvbHV0ZSB0b3AtMS8yIC10cmFuc2xhdGUteS0xLzIgcmlnaHQtMiBiZy1ncmF5LTIwMC83MCB0ZXh0LWdyYXktNzAwIHAtMiBjdXJzb3ItcG9pbnRlciBob3ZlcjpiZy1ncmF5LTMwMCBoaWRkZW4gZ3JvdXAtaG92ZXI6YmxvY2sgcm91bmRlZFwiPlxuICAgICAgICAgICAgICAgICAgICA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB3aWR0aD1cIjI1XCIgaGVpZ2h0PVwiMjVcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8cGF0aCBmaWxsPVwiY3VycmVudENvbG9yXCIgZD1cIk05IDE4cS0uODI1IDAtMS40MTMtLjU4OFQ3IDE2VjRxMC0uODI1LjU4OC0xLjQxM1Q5IDJoOXEuODI1IDAgMS40MTMuNTg4VDIwIDR2MTJxMCAuODI1LS41ODggMS40MTNUMTggMThIOVptMC0yaDlWNEg5djEyWm0tNCA2cS0uODI1IDAtMS40MTMtLjU4OFQzIDIwVjdxMC0uNDI1LjI4OC0uNzEzVDQgNnEuNDI1IDAgLjcxMy4yODhUNSA3djEzaDEwcS40MjUgMCAuNzEzLjI4OFQxNiAyMXEwIC40MjUtLjI4OC43MTNUMTUgMjJINVptNC02VjR2MTJaXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIGApXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRlbnQgPSBjcmVhdGVJbnB1dENlbGwoY29sdW1uLCB2YWx1ZSwgcmFpc2VFcnJvciA9PT0gJyNyYWlzZUVycm9yIycpXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGNvbnRlbnQgPSBjZWxsXG4gIH1cblxuICByZXR1cm4gY29udGVudFxufVxuXG5mdW5jdGlvbiBjcmVhdGVJbnB1dENlbGwoY29sdW1uLCB2YWx1ZSA9ICcnLCByYWlzZUVycm9yKSB7XG4gIGNvbnN0IG1vZGFsID0gcmFpc2VFcnJvclxuICAgID8gYFxuICAgIDxwIGNsYXNzPSdhYnNvbHV0ZSBweC0zIHB5LTIgYmctcmVkLTEwMCB0ZXh0LXJlZC05NTAgcm91bmRlZC1tZCBib3JkZXItMiBib3JkZXItcmVkLTUwMCAtdG9wLTUgcmlnaHQtMCBsZWZ0LTAgLXRyYW5zbGF0ZS15LWZ1bGwnPkwndXJsIG4nZXN0IHBhcyB2YWxpZGUsIHZldWlsbGV6IGVudHJlciB1bmUgYWRyZXNzZSBjb3JyZWN0ZTwvcD5cbiAgICBgXG4gICAgOiAnJ1xuICByZXR1cm4gaHRtbChgXG4gICAgPGlucHV0LWNlbGwgY2xhc3M9J3JlbGF0aXZlJz5cbiAgICAgICAgJHttb2RhbH1cbiAgICAgICAgPGlucHV0IHR5cGU9J3RleHQnIHBsYWNlaG9sZGVyPScke2NvbHVtbi5uYW1lfScgY2xhc3M9J3ctZnVsbCBvdXRsaW5lLW5vbmUgYmctc3RvbmUtMTAwJyB2YWx1ZT0nJHt2YWx1ZX0nIC8+XG4gICAgPC9pbnB1dC1jZWxsPlxuICAgIGApXG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUludGVycm9nYXRpb25Qb2ludENlbGwoKSB7XG4gIHJldHVybiBodG1sKGA8c3BhbiBjbGFzcz0ndy1mdWxsIGJsb2NrIHRleHQtY2VudGVyIGN1cnNvci1kZWZhdWx0Jz4/PC9zYXBuPmApXG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUxvYWRpbmdDZWxsKCkge1xuICByZXR1cm4gaHRtbChgXG4gICAgPHNwYW4gY2xhc3M9J2Jsb2NrIHRleHQtY2VudGVyJz5cbiAgICAgICAgPHN2ZyBjbGFzcz1cInctNSBpbmxpbmUtYmxvY2sgY3Vyc29yLWRlZmF1bHQgYW5pbWF0ZS1zcGluIGgtNSB0ZXh0LWJsYWNrXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIGZpbGw9XCJub25lXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiPlxuICAgICAgICAgICAgPGNpcmNsZSBjbGFzcz1cIm9wYWNpdHktMjVcIiBjeD1cIjEyXCIgY3k9XCIxMlwiIHI9XCIxMFwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjRcIj48L2NpcmNsZT5cbiAgICAgICAgICAgIDxwYXRoIGNsYXNzPVwib3BhY2l0eS03NVwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIiBkPVwiTTQgMTJhOCA4IDAgMDE4LThWMEM1LjM3MyAwIDAgNS4zNzMgMCAxMmg0em0yIDUuMjkxQTcuOTYyIDcuOTYyIDAgMDE0IDEySDBjMCAzLjA0MiAxLjEzNSA1LjgyNCAzIDcuOTM4bDMtMi42NDd6XCI+PC9wYXRoPlxuICAgICAgICA8L3N2Zz5cbiAgICA8L3NwYW4+XG4gICAgYClcbn1cblxuYXN5bmMgZnVuY3Rpb24gdXBkYXRlR3JpZERhdGEocGF5bG9hZCkge1xuICBjb25zdCBuZXdEYXRhID0gYXdhaXQgZmV0Y2hCYWNrbGlua3MoKVxuICBpZiAocGF5bG9hZD8udHlwZSA9PT0gJ2lucHV0Jykge1xuICAgIGxldCBpbnB1dFN0cmluZyA9IGAjaW5wdXQjICR7cGF5bG9hZC52YWx1ZX1gXG4gICAgaWYgKHBheWxvYWQuZXJyb3IpIGlucHV0U3RyaW5nICs9ICcgI3JhaXNlRXJyb3IjJ1xuICAgIG5ld0RhdGEucHVzaChbJ2lkbGUnLCBpbnB1dFN0cmluZywgJ2lkbGUnLCAnaWRsZSddKVxuICB9IGVsc2UgaWYgKHBheWxvYWQ/LnR5cGUgPT09ICdyb3cnKSB7XG4gICAgbmV3RGF0YS5wdXNoKFsnbG9hZGluZycsIHBheWxvYWQudmFsdWUsICdsb2FkaW5nJywgJ2xvYWRpbmcnXSlcbiAgfVxuICBpZiAoIW5ld0RhdGEubGVuZ3RoKSByZXR1cm5cblxuICBncmlkXG4gICAgLnVwZGF0ZUNvbmZpZyh7XG4gICAgICBkYXRhOiBuZXdEYXRhLFxuICAgIH0pXG4gICAgLmZvcmNlUmVuZGVyKClcbn1cblxuZnVuY3Rpb24gaXNWYWxpZFVybCh1cmwpIHtcbiAgY29uc3QgcGF0dGVybiA9IG5ldyBSZWdFeHAoXG4gICAgJ14oaHR0cHM/OlxcXFwvXFxcXC8pJyArIC8vIHByb3RvY29sZSAob2JsaWdhdG9pcmUpXG4gICAgICAnKCgoW2EtelxcXFxkXShbYS16XFxcXGQtXSpbYS16XFxcXGRdKSopXFxcXC4pK1thLXpdezIsfXwnICsgLy8gbm9tIGRlIGRvbWFpbmVcbiAgICAgICcoKFxcXFxkezEsM31cXFxcLil7M31cXFxcZHsxLDN9KSknICsgLy8gT1UgdW5lIGFkcmVzc2UgSVAgKHY0KVxuICAgICAgJyhcXFxcOlxcXFxkKyk/KFxcXFwvWy1hLXpcXFxcZCVfLn4rXSopKicgKyAvLyBwb3J0IGV0IGNoZW1pblxuICAgICAgJyhcXFxcP1s7JmEtelxcXFxkJV8ufis9LV0qKT8nICsgLy8gcXVlcnkgc3RyaW5nXG4gICAgICAnKFxcXFwjWy1hLXpcXFxcZF9dKik/JCcsXG4gICAgJ2knXG4gICkgLy8gZnJhZ21lbnQgbG9jYXRvclxuICByZXR1cm4gISFwYXR0ZXJuLnRlc3QodXJsKVxufVxuXG5hc3luYyBmdW5jdGlvbiBjb3B5TGlua0VsZW1lbnQoZSwgY29udGVudCkge1xuICB0cnkge1xuICAgIGNvbnN0IGVsZW1DbGlja2VkID0gZS50YXJnZXRcbiAgICBjb25zdCBpc0NlbGxVcmwgPSBlbGVtQ2xpY2tlZC5jbGFzc0xpc3QuY29udGFpbnMoJ3VybCcpXG4gICAgY29uc3QgaXNDb3B5QnV0dG9uID0gZWxlbUNsaWNrZWQuY2xvc2VzdCgnLmNvcHktY29udGVudCcpICE9PSB1bmRlZmluZWRcblxuICAgIGlmIChpc0NlbGxVcmwpIHtcbiAgICAgIHdpbmRvdy5vcGVuKGNvbnRlbnQpXG4gICAgfSBlbHNlIGlmIChpc0NvcHlCdXR0b24pIHtcbiAgICAgIGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KGNvbnRlbnQpXG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJldXIgbG9ycyBkZSBsYSBjb3BpZScsIGVycilcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBkZWxldGVMaW5rRWxlbWVudChlLCBjZWxscykge1xuICB0cnkge1xuICAgIGNvbnN0IGVsZW1DbGlja2VkID0gZS50YXJnZXRcbiAgICBjb25zdCBkZWxldGVCdXR0b24gPSBlbGVtQ2xpY2tlZC5jbG9zZXN0KCcuZGVsZXRlJylcbiAgICBjb25zdCBpc2RlbGV0ZUJ1dHRvbiA9IGRlbGV0ZUJ1dHRvbiAhPT0gdW5kZWZpbmVkXG5cbiAgICBpZiAoaXNkZWxldGVCdXR0b24pIHtcbiAgICAgIGNvbnN0IGNlbGwgPSBkZWxldGVCdXR0b24uY2xvc2VzdCgndGQnKVxuICAgICAgZGVsZXRlQnV0dG9uLnJlbW92ZSgpXG5cbiAgICAgIC8vY3JlYXRlIGxvYWRpbmcgYnV0dG9uXG4gICAgICBjb25zdCBsb2FkaW5nQnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpXG4gICAgICBsb2FkaW5nQnV0dG9uLmNsYXNzTGlzdC5hZGQoXG4gICAgICAgICdhYnNvbHV0ZScsXG4gICAgICAgICd0b3AtMS8yJyxcbiAgICAgICAgJy10cmFuc2xhdGUteS0xLzInLFxuICAgICAgICAncmlnaHQtMicsXG4gICAgICAgICdiZy1ncmF5LTIwMC83MCcsXG4gICAgICAgICd0ZXh0LWdyYXktNzAwJyxcbiAgICAgICAgJ3AtMicsXG4gICAgICAgICdjdXJzb3ItcG9pbnRlcicsXG4gICAgICAgICdob3ZlcjpiZy1ncmF5LTMwMCcsXG4gICAgICAgICdyb3VuZGVkJ1xuICAgICAgKVxuICAgICAgbG9hZGluZ0J1dHRvbi5pbm5lckhUTUwgPSBgXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9J2Jsb2NrIHRleHQtY2VudGVyJz5cbiAgICAgICAgICAgICAgICAgICAgPHN2ZyBjbGFzcz1cInctNSBpbmxpbmUtYmxvY2sgY3Vyc29yLWRlZmF1bHQgYW5pbWF0ZS1zcGluIGgtNSB0ZXh0LWJsYWNrXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIGZpbGw9XCJub25lXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGNpcmNsZSBjbGFzcz1cIm9wYWNpdHktMjVcIiBjeD1cIjEyXCIgY3k9XCIxMlwiIHI9XCIxMFwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjRcIj48L2NpcmNsZT5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxwYXRoIGNsYXNzPVwib3BhY2l0eS03NVwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIiBkPVwiTTQgMTJhOCA4IDAgMDE4LThWMEM1LjM3MyAwIDAgNS4zNzMgMCAxMmg0em0yIDUuMjkxQTcuOTYyIDcuOTYyIDAgMDE0IDEySDBjMCAzLjA0MiAxLjEzNSA1LjgyNCAzIDcuOTM4bDMtMi42NDd6XCI+PC9wYXRoPlxuICAgICAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgYFxuICAgICAgY2VsbC5hcHBlbmRDaGlsZChsb2FkaW5nQnV0dG9uKVxuXG4gICAgICAvL2NhbGwgc2VydmUgdG8gZGVsZXRlIGZyb20gZGF0YWJhc2VcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goJy9hcGkvYmFja2xpbmtzL2RlbGV0ZScsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgdXJsOiBjZWxsc1sxXS5kYXRhLFxuICAgICAgICB9KSxcbiAgICAgIH0pXG5cbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IHVwZGF0ZUdyaWREYXRhKClcbiAgICAgIH1cbiAgICB9XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0VycmV1ciBsb3JzIGRlIGxhIHN1cHByZXNzaW9uIGR1IGxpZW4nLCBlcnIpXG4gIH1cbn1cblxuLyoqKioqIEV2ZW50cyAqKioqKi9cbmRvY3VtZW50XG4gIC5nZXRFbGVtZW50QnlJZCgnYWRkLXJvdycpXG4gIC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHVwZGF0ZUdyaWREYXRhKHsgdHlwZTogJ2lucHV0JywgdmFsdWU6ICcnIH0pKVxuXG4vKioqKiogY2xhc3NlcyAqKioqKi9cbmNsYXNzIElucHV0Q2VsbCBleHRlbmRzIEhUTUxFbGVtZW50IHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKVxuICAgIHRoaXMuaW5wdXQgPSB0aGlzLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0JylcbiAgfVxuXG4gIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgIHRoaXMuaW5wdXQuZm9jdXMoKVxuICAgIHRoaXMuaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgdGhpcy5vbklucHV0Q2hhbmdlKVxuICB9XG5cbiAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgdGhpcy5pbnB1dC5yZW1vdmVFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLm9uSW5wdXRDaGFuZ2UpXG4gIH1cblxuICBvbklucHV0Q2hhbmdlID0gYXN5bmMgKGUpID0+IHtcbiAgICBjb25zdCB1cmwgPSBlLnRhcmdldC52YWx1ZVxuICAgIGlmICghdXJsKSB7XG4gICAgICB1cGRhdGVHcmlkRGF0YSgpXG4gICAgICByZXR1cm5cbiAgICB9IGVsc2UgaWYgKCFpc1ZhbGlkVXJsKHVybCkpIHtcbiAgICAgIHVwZGF0ZUdyaWREYXRhKHsgdHlwZTogJ2lucHV0JywgdmFsdWU6IGUudGFyZ2V0LnZhbHVlLCBlcnJvcjogdHJ1ZSB9KVxuICAgICAgcmV0dXJuXG4gICAgfSBlbHNlIHtcbiAgICAgIGF3YWl0IHRoaXMuY2hlY2tMaW5rKGUudGFyZ2V0LnZhbHVlKVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGNoZWNrTGluayh1cmwpIHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdXBkYXRlR3JpZERhdGEoeyB0eXBlOiAncm93JywgdmFsdWU6IHVybCB9KVxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgnL2FwaS9iYWNrbGlua3MvY2hlY2snLCB7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHVybHM6IFt1cmxdLFxuICAgICAgICB9KSxcbiAgICAgIH0pXG5cbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IHVwZGF0ZUdyaWREYXRhKClcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdXBkYXRlR3JpZERhdGEoeyB0eXBlOiAnaW5wdXQnLCB2YWx1ZTogdXJsLCBlcnJvcjogdHJ1ZSB9KVxuICAgIH1cbiAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCdpbnB1dC1jZWxsJywgSW5wdXRDZWxsKVxuIl0sIm5hbWVzIjpbIl9yZWdlbmVyYXRvclJ1bnRpbWUiLCJlIiwidCIsInIiLCJPYmplY3QiLCJwcm90b3R5cGUiLCJuIiwiaGFzT3duUHJvcGVydHkiLCJvIiwiZGVmaW5lUHJvcGVydHkiLCJ2YWx1ZSIsImkiLCJTeW1ib2wiLCJhIiwiaXRlcmF0b3IiLCJjIiwiYXN5bmNJdGVyYXRvciIsInUiLCJ0b1N0cmluZ1RhZyIsImRlZmluZSIsImVudW1lcmFibGUiLCJjb25maWd1cmFibGUiLCJ3cml0YWJsZSIsIndyYXAiLCJHZW5lcmF0b3IiLCJjcmVhdGUiLCJDb250ZXh0IiwibWFrZUludm9rZU1ldGhvZCIsInRyeUNhdGNoIiwidHlwZSIsImFyZyIsImNhbGwiLCJoIiwibCIsImYiLCJzIiwieSIsIkdlbmVyYXRvckZ1bmN0aW9uIiwiR2VuZXJhdG9yRnVuY3Rpb25Qcm90b3R5cGUiLCJwIiwiZCIsImdldFByb3RvdHlwZU9mIiwidiIsInZhbHVlcyIsImciLCJkZWZpbmVJdGVyYXRvck1ldGhvZHMiLCJmb3JFYWNoIiwiX2ludm9rZSIsIkFzeW5jSXRlcmF0b3IiLCJpbnZva2UiLCJfdHlwZW9mIiwicmVzb2x2ZSIsIl9fYXdhaXQiLCJ0aGVuIiwiY2FsbEludm9rZVdpdGhNZXRob2RBbmRBcmciLCJFcnJvciIsImRvbmUiLCJtZXRob2QiLCJkZWxlZ2F0ZSIsIm1heWJlSW52b2tlRGVsZWdhdGUiLCJzZW50IiwiX3NlbnQiLCJkaXNwYXRjaEV4Y2VwdGlvbiIsImFicnVwdCIsIlR5cGVFcnJvciIsInJlc3VsdE5hbWUiLCJuZXh0IiwibmV4dExvYyIsInB1c2hUcnlFbnRyeSIsInRyeUxvYyIsImNhdGNoTG9jIiwiZmluYWxseUxvYyIsImFmdGVyTG9jIiwidHJ5RW50cmllcyIsInB1c2giLCJyZXNldFRyeUVudHJ5IiwiY29tcGxldGlvbiIsInJlc2V0IiwiaXNOYU4iLCJsZW5ndGgiLCJkaXNwbGF5TmFtZSIsImlzR2VuZXJhdG9yRnVuY3Rpb24iLCJjb25zdHJ1Y3RvciIsIm5hbWUiLCJtYXJrIiwic2V0UHJvdG90eXBlT2YiLCJfX3Byb3RvX18iLCJhd3JhcCIsImFzeW5jIiwiUHJvbWlzZSIsImtleXMiLCJyZXZlcnNlIiwicG9wIiwicHJldiIsImNoYXJBdCIsInNsaWNlIiwic3RvcCIsInJ2YWwiLCJoYW5kbGUiLCJjb21wbGV0ZSIsImZpbmlzaCIsIl9jYXRjaCIsImRlbGVnYXRlWWllbGQiLCJfY2xhc3NDYWxsQ2hlY2siLCJpbnN0YW5jZSIsIkNvbnN0cnVjdG9yIiwiX2RlZmluZVByb3BlcnRpZXMiLCJ0YXJnZXQiLCJwcm9wcyIsImRlc2NyaXB0b3IiLCJfdG9Qcm9wZXJ0eUtleSIsImtleSIsIl9jcmVhdGVDbGFzcyIsInByb3RvUHJvcHMiLCJzdGF0aWNQcm9wcyIsIl9jYWxsU3VwZXIiLCJfZ2V0UHJvdG90eXBlT2YiLCJfcG9zc2libGVDb25zdHJ1Y3RvclJldHVybiIsIl9pc05hdGl2ZVJlZmxlY3RDb25zdHJ1Y3QiLCJSZWZsZWN0IiwiY29uc3RydWN0IiwiYXBwbHkiLCJzZWxmIiwiX2Fzc2VydFRoaXNJbml0aWFsaXplZCIsIlJlZmVyZW5jZUVycm9yIiwiX2luaGVyaXRzIiwic3ViQ2xhc3MiLCJzdXBlckNsYXNzIiwiX3NldFByb3RvdHlwZU9mIiwiX3dyYXBOYXRpdmVTdXBlciIsIkNsYXNzIiwiX2NhY2hlIiwiTWFwIiwidW5kZWZpbmVkIiwiX2lzTmF0aXZlRnVuY3Rpb24iLCJoYXMiLCJnZXQiLCJzZXQiLCJXcmFwcGVyIiwiX2NvbnN0cnVjdCIsImFyZ3VtZW50cyIsImJpbmQiLCJCb29sZWFuIiwidmFsdWVPZiIsImZuIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsImluZGV4T2YiLCJfc2xpY2VkVG9BcnJheSIsImFyciIsIl9hcnJheVdpdGhIb2xlcyIsIl9pdGVyYWJsZVRvQXJyYXlMaW1pdCIsIl91bnN1cHBvcnRlZEl0ZXJhYmxlVG9BcnJheSIsIl9ub25JdGVyYWJsZVJlc3QiLCJtaW5MZW4iLCJfYXJyYXlMaWtlVG9BcnJheSIsIkFycmF5IiwiZnJvbSIsInRlc3QiLCJsZW4iLCJhcnIyIiwiaXNBcnJheSIsImFzeW5jR2VuZXJhdG9yU3RlcCIsImdlbiIsInJlamVjdCIsIl9uZXh0IiwiX3Rocm93IiwiaW5mbyIsImVycm9yIiwiX2FzeW5jVG9HZW5lcmF0b3IiLCJhcmdzIiwiZXJyIiwib3duS2V5cyIsImdldE93blByb3BlcnR5U3ltYm9scyIsImZpbHRlciIsImdldE93blByb3BlcnR5RGVzY3JpcHRvciIsIl9vYmplY3RTcHJlYWQiLCJfZGVmaW5lUHJvcGVydHkiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiZGVmaW5lUHJvcGVydGllcyIsIm9iaiIsIl90b1ByaW1pdGl2ZSIsInRvUHJpbWl0aXZlIiwiU3RyaW5nIiwiTnVtYmVyIiwiR3JpZCIsImh0bWwiLCJkYXRhIiwiZ3JpZENvbnRhaW5lciIsImRvY3VtZW50IiwiZ2V0RWxlbWVudEJ5SWQiLCJncmlkIiwiY29sdW1ucyIsImF0dHJpYnV0ZXMiLCJjZWxsIiwicm93IiwiZm9ybWF0QXR0cmlidXRlcyIsImZvcm1hdHRlciIsIl8iLCJjb2x1bW4iLCJmb3JtYXRPdXRwdXQiLCJzb3J0IiwiZmV0Y2hCYWNrbGlua3MiLCJyZW5kZXIiLCJvbiIsImNvcHlMaW5rRWxlbWVudCIsImRlbGV0ZUxpbmtFbGVtZW50IiwiY2VsbHMiLCJfZmV0Y2hCYWNrbGlua3MiLCJfY2FsbGVlMyIsInJlc3BvbnNlIiwicmVzcG9uc2VEQXRhIiwiZGF0YUZvcm1hdHRlZCIsIl9jYWxsZWUzJCIsIl9jb250ZXh0MyIsImZldGNoIiwib2siLCJqc29uIiwibWFwIiwiX2RhdGEkc3RhdGUiLCJzaXRlRGF0YSIsInVybERhdGEiLCJhbmNob3JEYXRhIiwic3RhdGUiLCJfZGF0YSRzaXRlIiwiX2RhdGEkdXJsIiwiX2RhdGEkYW5jaG9yIiwic2l0ZSIsInVybCIsImFuY2hvciIsIl9kYXRhJHNpdGUyIiwiX2RhdGEkdXJsMiIsIl9kYXRhJGFuY2hvcjIiLCJ0MCIsImNvbnNvbGUiLCJsb2ciLCJiYWNrZ3JvdW5kQ2xhc3MiLCJzdGF0dXMiLCJpc0xpbmtBY3RpdmUiLCJjb250ZW50IiwiY3JlYXRlSW50ZXJyb2dhdGlvblBvaW50Q2VsbCIsImNyZWF0ZUxvYWRpbmdDZWxsIiwiY29uY2F0IiwiX2NlbGwkc3BsaXQiLCJzcGxpdCIsIl9jZWxsJHNwbGl0MiIsImlzSW5wdXRTdHJpbmciLCJyYWlzZUVycm9yIiwiaXNJbnB1dCIsImNyZWF0ZUlucHV0Q2VsbCIsIm1vZGFsIiwidXBkYXRlR3JpZERhdGEiLCJfeCIsIl91cGRhdGVHcmlkRGF0YSIsIl9jYWxsZWU0IiwicGF5bG9hZCIsIm5ld0RhdGEiLCJpbnB1dFN0cmluZyIsIl9jYWxsZWU0JCIsIl9jb250ZXh0NCIsInVwZGF0ZUNvbmZpZyIsImZvcmNlUmVuZGVyIiwiaXNWYWxpZFVybCIsInBhdHRlcm4iLCJSZWdFeHAiLCJfeDIiLCJfeDMiLCJfY29weUxpbmtFbGVtZW50IiwiX2NhbGxlZTUiLCJlbGVtQ2xpY2tlZCIsImlzQ2VsbFVybCIsImlzQ29weUJ1dHRvbiIsIl9jYWxsZWU1JCIsIl9jb250ZXh0NSIsImNsYXNzTGlzdCIsImNvbnRhaW5zIiwiY2xvc2VzdCIsIndpbmRvdyIsIm9wZW4iLCJuYXZpZ2F0b3IiLCJjbGlwYm9hcmQiLCJ3cml0ZVRleHQiLCJfeDQiLCJfeDUiLCJfZGVsZXRlTGlua0VsZW1lbnQiLCJfY2FsbGVlNiIsImRlbGV0ZUJ1dHRvbiIsImlzZGVsZXRlQnV0dG9uIiwibG9hZGluZ0J1dHRvbiIsIl9jYWxsZWU2JCIsIl9jb250ZXh0NiIsInJlbW92ZSIsImNyZWF0ZUVsZW1lbnQiLCJhZGQiLCJpbm5lckhUTUwiLCJhcHBlbmRDaGlsZCIsImhlYWRlcnMiLCJib2R5IiwiSlNPTiIsInN0cmluZ2lmeSIsImFkZEV2ZW50TGlzdGVuZXIiLCJJbnB1dENlbGwiLCJfSFRNTEVsZW1lbnQiLCJfdGhpcyIsIl9yZWYiLCJfY2FsbGVlIiwiX2NhbGxlZSQiLCJfY29udGV4dCIsImNoZWNrTGluayIsIl94NiIsImlucHV0IiwicXVlcnlTZWxlY3RvciIsImNvbm5lY3RlZENhbGxiYWNrIiwiZm9jdXMiLCJvbklucHV0Q2hhbmdlIiwiZGlzY29ubmVjdGVkQ2FsbGJhY2siLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiX2NoZWNrTGluayIsIl9jYWxsZWUyIiwiX2NhbGxlZTIkIiwiX2NvbnRleHQyIiwidXJscyIsIl94NyIsIkhUTUxFbGVtZW50IiwiY3VzdG9tRWxlbWVudHMiXSwic291cmNlUm9vdCI6IiJ9
