/**
 * The code that runs first inside the sandbox and defines the `metakit` module scripts import.
 * It is trusted; everything a script can do goes through `call` and `callAsync` to the host, which
 * checks every request again (permissions, ids, sizes), so a script that reaches these functions by
 * other means gains nothing.
 *
 * Written as one function so that the bridge functions are local variables, removed from the
 * global object before any script runs.
 */
export const PRELUDE = String.raw`
(() => {
  'use strict';
  const host = globalThis.__host;
  const hostAsync = globalThis.__host_async;
  delete globalThis.__host;
  delete globalThis.__host_async;

  const lock = (name, value) =>
    Object.defineProperty(globalThis, name, { value, writable: false, configurable: false, enumerable: false });

  const call = (op, ...args) => {
    const answer = JSON.parse(host(op, JSON.stringify(args)));
    if (answer.e !== undefined) throw new Error(answer.e);
    return answer.v;
  };

  const pending = new Map();
  let nextId = 1;
  // The script whose code is running, so that console lines and errors name it, also after an await.
  let activeScript = null;
  const callAsync = (op, ...args) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject, owner: activeScript });
      hostAsync(op, JSON.stringify(args), String(id));
    });
  lock('__settle', (idJson, answerJson) => {
    const key = Number(JSON.parse(idJson));
    const entry = pending.get(key);
    if (!entry) return;
    pending.delete(key);
    activeScript = entry.owner;
    const answer = JSON.parse(answerJson);
    if (answer.e !== undefined) entry.reject(new Error(answer.e));
    else entry.resolve(answer.v);
  });

  // -- console ---------------------------------------------------------------------------
  const show = (value) => {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.message;
    try {
      const json = JSON.stringify(value);
      return json === undefined ? String(value) : json;
    } catch (error) {
      return String(value);
    }
  };
  const line = (level) => (...args) => { call('console', level, args.map(show).join(' '), activeScript); };
  const console = { log: line('log'), info: line('info'), warn: line('warn'), error: line('error'), debug: line('log') };
  lock('console', console);

  const report = (error) => {
    const e = error instanceof Error ? error : new Error(show(error));
    call('script.error', e.message, typeof e.stack === 'string' ? e.stack : '', activeScript);
  };

  // -- registered handlers and the script being loaded ---------------------------------------
  const handlers = [];
  let currentScript = null;
  let oneShot = false;
  lock('__setOneShot', () => { oneShot = true; });

  // -- model objects -------------------------------------------------------------------------
  const cache = new Map();
  const idOf = (value, what) => {
    const id = typeof value === 'string' ? value : value && typeof value === 'object' ? value.id : undefined;
    if (typeof id !== 'string') throw new TypeError(what + ' must be an object of the model or its id.');
    return id;
  };

  const attrsOf = (id) =>
    new Proxy({}, {
      get: (_, key) => (typeof key === 'string' ? call('attr.get', id, key) : undefined),
      set: (_, key, value) => {
        if (typeof key !== 'string') return false;
        call('attr.set', id, key, value === undefined ? null : value);
        return true;
      },
      has: (_, key) => typeof key === 'string' && call('attr.has', id, key),
      ownKeys: () => call('attr.keys', id),
      getOwnPropertyDescriptor: (_, key) =>
        typeof key === 'string' && call('attr.has', id, key)
          ? { enumerable: true, configurable: true, writable: true, value: call('attr.get', id, key) }
          : undefined,
    });

  const wrapObject = (id) => {
    let found = cache.get(id);
    if (found) return found;
    const attrs = attrsOf(id);
    const get = (key) => call('el.get', id)[key];
    found = {
      get id() { return id; },
      get class() { return get('class'); },
      get x() { return get('x'); },
      set x(value) { call('m.update', id, { x: value }); },
      get y() { return get('y'); },
      set y(value) { call('m.update', id, { y: value }); },
      get w() { return get('w'); },
      set w(value) { call('m.update', id, { w: value }); },
      get h() { return get('h'); },
      set h(value) { call('m.update', id, { h: value }); },
      get attrs() { return attrs; },
      get parent() { const p = get('parent'); return p === null ? null : wrapObject(p); },
      children: () => call('el.children', id).map(wrapObject),
      incoming: (relation) => call('el.linked', id, 'in', relation ?? null).map(wrapObject),
      outgoing: (relation) => call('el.linked', id, 'out', relation ?? null).map(wrapObject),
      connectors: (relation) => call('el.connectors', id, relation ?? null).map(wrapConnector),
      update: (patch) => { call('m.update', id, normalizePatch(patch)); },
      delete: () => { call('m.delete', id); },
      toJSON: () => ({ id, ...call('el.get', id) }),
    };
    cache.set(id, found);
    return found;
  };

  const wrapConnector = (id) => {
    let found = cache.get(id);
    if (found) return found;
    const attrs = attrsOf(id);
    const get = (key) => call('cn.get', id)[key];
    found = {
      get id() { return id; },
      get relation() { return get('relation'); },
      get from() { return wrapObject(get('from')); },
      get to() { return wrapObject(get('to')); },
      get attrs() { return attrs; },
      update: (patch) => { call('m.update', id, normalizePatch(patch)); },
      delete: () => { call('m.delete', id); },
      toJSON: () => ({ id, ...call('cn.get', id) }),
    };
    cache.set(id, found);
    return found;
  };

  const normalizePatch = (patch) => {
    const out = {};
    for (const key of ['x', 'y', 'w', 'h', 'attrs']) if (patch && patch[key] !== undefined) out[key] = patch[key];
    if (patch && patch.parent !== undefined) out.parent = patch.parent === null ? null : idOf(patch.parent, 'The parent');
    return out;
  };

  const model = {
    objects: (cls) => call('m.objects', cls ?? null).map(wrapObject),
    object: (id) => (call('m.exists', idOf(id, 'The object')) ? wrapObject(idOf(id, 'The object')) : null),
    connectors: (relation) => call('m.connectors', relation ?? null).map(wrapConnector),
    selection: () => call('m.selection').map((id) => (id.startsWith('cn_') ? wrapConnector(id) : wrapObject(id))),
    create: (cls, options) => {
      const o = options || {};
      const spec = { x: o.x ?? 0, y: o.y ?? 0, attrs: o.attrs ?? {} };
      if (o.w !== undefined) spec.w = o.w;
      if (o.h !== undefined) spec.h = o.h;
      if (o.parent !== undefined && o.parent !== null) spec.parent = idOf(o.parent, 'The parent');
      return wrapObject(call('m.create', cls, spec));
    },
    connect: (relation, from, to, attrs) =>
      wrapConnector(call('m.connect', relation, idOf(from, 'The start'), idOf(to, 'The end'), attrs ?? {})),
    update: (target, patch) => { call('m.update', idOf(target, 'The object'), normalizePatch(patch)); },
    delete: (target) => { call('m.delete', idOf(target, 'The object')); },
    attrs: attrsOf('model'),
  };

  // -- the Kit's own meta-model ---------------------------------------------------------------
  const kit = Object.freeze({
    get name() { return call('t.info').name; },
    get version() { return call('t.info').version; },
    classes: () => call('t.classes'),
    class: (key) => call('t.class', key),
    relations: () => call('t.relations'),
    relation: (key) => call('t.relation', key),
    modelTypes: () => call('t.modelTypes'),
    modelType: (key) => call('t.modelType', key),
    attribute: (owner, key) => call('t.attribute', owner, key),
  });

  // -- dialogs ---------------------------------------------------------------------------------
  const ui = {
    message: (text, kind) => { call('ui.message', kind || 'info', String(text)); },
    warn: (text) => { call('ui.message', 'warning', String(text)); },
    error: (text) => { call('ui.message', 'error', String(text)); },
    confirm: (text) => call('ui.confirm', String(text)),
    prompt: (text, initial) => call('ui.prompt', String(text), initial === undefined ? null : String(initial)),
    choose: (text, options) => call('ui.choose', String(text), options),
    form: (fields, title) => call('ui.form', { title: title ?? undefined, fields }),
    progress: (label, work) => {
      const id = call('ui.progress.start', String(label));
      const handle = { update: (fraction, text) => { call('ui.progress.update', id, fraction ?? null, text ?? null); } };
      let result;
      try {
        result = work(handle);
      } catch (error) {
        call('ui.progress.end', id);
        throw error;
      }
      if (result && typeof result.then === 'function')
        return result.then(
          (value) => { call('ui.progress.end', id); return value; },
          (error) => { call('ui.progress.end', id); throw error; },
        );
      call('ui.progress.end', id);
      return result;
    },
  };

  // -- files and web services (permissions are checked by the host) -------------------------------
  const files = {
    read: (path) => callAsync('files.read', path),
    write: (path, text) => callAsync('files.write', path, String(text)),
    list: (folder) => callAsync('files.list', folder ?? ''),
    exists: (path) => callAsync('files.exists', path),
    open: (options) => callAsync('files.open', options ?? {}),
    save: (name, text) => callAsync('files.save', String(name), String(text)),
  };

  const request = async (method, url, body, options) => {
    const o = options || {};
    const headers = Object.assign({}, o.headers);
    let text = body;
    if (body !== undefined && body !== null && typeof body !== 'string') {
      text = JSON.stringify(body);
      if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
    }
    const answer = await callAsync('http.request', { method, url: String(url), headers, body: text ?? undefined });
    return {
      status: answer.status,
      ok: answer.status >= 200 && answer.status < 300,
      headers: answer.headers,
      text: () => answer.text,
      json: () => JSON.parse(answer.text),
    };
  };
  const http = {
    get: (url, options) => request('GET', url, undefined, options),
    post: (url, body, options) => request('POST', url, body, options),
    put: (url, body, options) => request('PUT', url, body, options),
    delete: (url, options) => request('DELETE', url, undefined, options),
    json: async (url, options) => {
      const response = await request('GET', url, undefined, options);
      if (!response.ok) throw new Error('The web service answered ' + response.status + ' for ' + url + '.');
      return response.json();
    },
  };

  // -- events and commands ------------------------------------------------------------------------
  const on = (event, a, b) => {
    const fn = typeof a === 'function' ? a : b;
    const filter = typeof a === 'function' ? {} : a || {};
    if (typeof fn !== 'function') throw new TypeError('on(event, filter?, handler) needs a function as the handler.');
    if (currentScript === null && !oneShot) throw new Error('on() can only be used at the top level of a script, not inside a handler.');
    if (oneShot) { call('console', 'warn', 'on(' + JSON.stringify(event) + ') was ignored: this run only runs the script once.'); return; }
    const index = handlers.push({ script: currentScript, fn }) - 1;
    call('on.register', event, filter, index);
  };

  const commands = {
    register: (spec) => {
      if (!spec || typeof spec.run !== 'function') throw new TypeError('commands.register needs a "run" function.');
      if (currentScript === null && !oneShot) throw new Error('commands.register() can only be used at the top level of a script, not inside a handler.');
      if (oneShot) { call('console', 'warn', 'The command "' + spec.id + '" was ignored: this run only runs the script once.'); return; }
      const index = handlers.push({ script: currentScript, fn: spec.run }) - 1;
      call('cmd.register', { id: spec.id, label: spec.label, menu: spec.menu, toolbar: spec.toolbar, context: spec.context }, index);
    },
  };

  const cancel = (reason) => ({ cancel: reason === undefined ? 'Cancelled by a script.' : String(reason) });

  // "tool" is the name from before the rename to Kit; it is the same object, so old scripts keep running.
  const metakit = Object.freeze({ on, model, ui, commands, kit, tool: kit, files, http, cancel });

  lock('__loadScript', (id, fn) => {
    currentScript = id;
    activeScript = id;
    const exports = {};
    const require = (name) => {
      if (name === 'metakit') return metakit;
      throw new Error('Cannot find module "' + name + '". Scripts can only import from "metakit".');
    };
    try {
      // The top level is an async function, so a script may await; an error before the first
      // await is reported with its line like any other.
      const answer = fn(exports, require);
      if (answer && typeof answer.then === 'function') answer.then(undefined, report);
    } finally {
      currentScript = null;
    }
  });

  // -- entry points the host calls -------------------------------------------------------------------
  const decorate = (payload) => {
    const target = payload.target;
    if (typeof target === 'string' && target.startsWith('el_'))
      Object.defineProperty(payload, 'object', { enumerable: false, get: () => (call('m.exists', target) ? wrapObject(target) : null) });
    else if (typeof target === 'string' && target.startsWith('cn_'))
      Object.defineProperty(payload, 'connector', { enumerable: false, get: () => (call('m.exists', target) ? wrapConnector(target) : null) });
    return payload;
  };

  lock('__fire', (indexJson, payloadJson) => {
    cache.clear();
    const entry = handlers[JSON.parse(indexJson)];
    activeScript = entry.script;
    const answer = entry.fn(decorate(JSON.parse(payloadJson)));
    if (answer && typeof answer.then === 'function') {
      answer.then(undefined, report);
      return JSON.stringify({});
    }
    if (answer === false) return JSON.stringify({ cancel: 'Cancelled by a script.' });
    if (answer && typeof answer === 'object' && 'cancel' in answer)
      return JSON.stringify({ cancel: answer.cancel === true ? 'Cancelled by a script.' : String(answer.cancel) });
    return JSON.stringify({});
  });

  lock('__run', (indexJson, targetJson, runIdJson) => {
    cache.clear();
    const entry = handlers[JSON.parse(indexJson)];
    activeScript = entry.script;
    const target = JSON.parse(targetJson);
    const runId = JSON.parse(runIdJson);
    const done = (error) => { call('run.done', runId, error); };
    // A synchronous error is thrown to the host, which reports it with its line.
    const answer = entry.fn(target === null ? null : target.startsWith('cn_') ? wrapConnector(target) : wrapObject(target));
    Promise.resolve(answer).then(
      () => done(null),
      (error) => {
        const e = error instanceof Error ? error : new Error(show(error));
        call('script.error', e.message, typeof e.stack === 'string' ? e.stack : '', entry.script);
        done(e.message);
      },
    );
    return JSON.stringify({});
  });

  // A script run by hand that registered no command: its top level, once. It may wait for things.
  lock('__runOnce', (id, fn, runId) => {
    currentScript = id;
    activeScript = id;
    const exports = {};
    const require = (name) => {
      if (name === 'metakit') return metakit;
      throw new Error('Cannot find module "' + name + '". Scripts can only import from "metakit".');
    };
    let answer;
    try {
      answer = fn(exports, require);
    } finally {
      currentScript = null;
    }
    Promise.resolve(answer).then(
      () => call('run.done', runId, null),
      (error) => {
        const e = error instanceof Error ? error : new Error(show(error));
        call('script.error', e.message, typeof e.stack === 'string' ? e.stack : '', id);
        call('run.done', runId, e.message);
      },
    );
  });
})();
`;
