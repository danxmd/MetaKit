import {
  CANCELLABLE_EVENTS,
  CommandError,
  effectiveAttributes,
  effectiveRelationAttributes,
  ModelCalculator,
  type AttributeDef,
  type ClassId,
  type ConnectorId,
  type ElementId,
  type EventBus,
  type EventPayload,
  type EventResult,
  type Json,
  type Model,
  type ModelStore,
  type Rule,
  type RuleAction,
  type RuleValue,
  type Kit,
} from '@metakit-app/core';
import { toText, truthy, type Value } from '@metakit-app/formula';
import type { CommandRegistry } from './commands';
import type { BehaviourHost } from './host';

export interface RuleEngineOptions {
  store: ModelStore;
  bus: EventBus;
  calculator: ModelCalculator;
  /** The Kit as it is now; read on every use so that Build mode edits are seen. */
  kit: () => Kit;
  host: BehaviourHost;
  commands: CommandRegistry;
}

export interface RuleTestResult {
  condition: { value: Json; error?: string };
  /** What the actions would do, in plain English; nothing is changed. */
  steps: string[];
}

/** How deep rules may trigger rules (ADR 0005). */
export const MAX_RULE_DEPTH = 8;

/** A problem in a rule that the person who built it should read; never escapes the engine. */
class RuleProblem extends Error {}

type Outcome = 'done' | 'stop' | { cancel: string };

interface Ctx {
  rule: Rule;
  payload: EventPayload;
  /** The object the event is about, or null (model and app events). */
  self: string | null;
  /** The object a createObject action made last, the default end of a createConnector. */
  created: string | null;
}

const isId = (v: string) =>
  v.startsWith('el_') || v.startsWith('cn_') || v === 'model';

const isFormulaText = (v: unknown): v is string =>
  typeof v === 'string' && v.startsWith('=');

/**
 * Runs the rules of a Kit: one bus handler per enabled rule, and the rules with the event
 * "command" as entries in the command registry. Actions go through the model store inside the step
 * that triggered the rule, so one undo takes back both. Problems in a rule become a warning for
 * the user and end that rule; they are never thrown.
 */
export class RuleEngine {
  private readonly o: RuleEngineOptions;
  private stops: (() => void)[] = [];
  private readonly storeStops: (() => void)[] = [];
  private depth = 0;
  /** Rule, target and event of the handlers running in the current cascade. */
  private seen = new Set<string>();
  /** Scopes open now; formulas read the state of the step in progress while any is open. */
  private active = 0;
  private latest: Model | undefined;
  private pending: (() => void) | null = null;

  constructor(options: RuleEngineOptions) {
    this.o = options;
    // The store only shows a step's changes when it ends, but rules run inside the step. Every
    // command reports the state it made, so formulas and later actions see earlier ones.
    this.storeStops.push(
      options.store.after('*', ({ command, state }) => {
        this.latest = state as Model;
        // An empty batch is how `run` opens a step the rule's actions then join (one undo).
        if ((command as { type: string }).type === 'batch' && this.pending) {
          const job = this.pending;
          this.pending = null;
          job();
        }
      }),
    );
  }

  /** Reads the rules again after the Kit changed. */
  reload(): void {
    this.unsubscribe();
    const { bus, commands } = this.o;
    commands.clear('rule');
    for (const rule of Object.values(this.o.kit().rules ?? {})) {
      if (rule.enabled === false) continue;
      if (rule.when.event === 'command') {
        commands.register({
          id: rule.id,
          label: rule.command?.label ?? rule.label,
          place: rule.command?.place ?? 'model',
          source: 'rule',
          run: (target) => this.run(rule.id, target),
        });
        continue;
      }
      const { class: cls, attribute, relation } = rule.when;
      this.stops.push(
        bus.on(rule.when.event, (payload) => this.handle(rule, payload), {
          ...(cls ? { class: cls } : {}),
          ...(attribute ? { attribute } : {}),
          ...(relation ? { relation } : {}),
        }),
      );
    }
  }

  /** Runs a rule on demand, for a command entry or a panel button. */
  run(ruleId: string, target: string | null): void {
    const rule = this.o.kit().rules?.[ruleId as Rule['id']];
    if (!rule) {
      this.o.host.message('warning', `The rule ${ruleId} does not exist.`);
      return;
    }
    if (rule.enabled === false) {
      this.o.host.message('warning', `Rule "${rule.label}" is switched off.`);
      return;
    }
    const payload: EventPayload = {
      event: 'command' as EventPayload['event'],
      target,
      user: 'local',
      ...(rule.when.attribute ? { attribute: rule.when.attribute } : {}),
    };
    this.pending = () => void this.invoke(rule, payload);
    try {
      this.o.store.execute({ type: 'batch', commands: [] });
    } catch (e) {
      this.warn(rule, e);
    } finally {
      this.pending = null;
    }
  }

  /** A dry run: the value of the condition for `target`, and what each action would do. */
  test(rule: Rule, target: string | null): RuleTestResult {
    const ctx: Ctx = {
      rule,
      self: target && isId(target) ? target : null,
      created: null,
      payload: {
        event: rule.when.event as EventPayload['event'],
        target,
        user: 'local',
        ...(rule.when.attribute ? { attribute: rule.when.attribute } : {}),
      },
    };
    let condition: RuleTestResult['condition'];
    if (rule.if === undefined || rule.if.trim() === '')
      condition = { value: true };
    else {
      const r = this.calc().evaluate(target, rule.if, this.extras(ctx));
      condition = {
        value: r.value as Json,
        ...(r.error ? { error: r.error } : {}),
      };
    }
    return { condition, steps: this.describeAll(rule.then, ctx, '') };
  }

  dispose(): void {
    this.unsubscribe();
    this.o.commands.clear('rule');
    this.storeStops.splice(0).forEach((s) => s());
  }

  private unsubscribe(): void {
    this.stops.splice(0).forEach((s) => s());
  }

  // Running -----------------------------------------------------------------------------------

  private handle(rule: Rule, payload: EventPayload): EventResult {
    const out = this.invoke(rule, payload);
    return out && typeof out === 'object' ? out : undefined;
  }

  private invoke(
    rule: Rule,
    payload: EventPayload,
  ): { cancel: string } | undefined {
    if (this.depth >= MAX_RULE_DEPTH) {
      this.o.host.message(
        'warning',
        `Rule "${rule.label}": stopped because rules triggered each other more than ${MAX_RULE_DEPTH} levels deep.`,
      );
      return undefined;
    }
    const key = `${rule.id}|${payload.target ?? ''}|${payload.event}`;
    if (this.seen.has(key)) return undefined;
    this.seen.add(key);
    this.depth += 1;
    this.active += 1;
    const live = this.o.bus.state as Model | undefined;
    if (live) this.latest = live;
    try {
      const ctx: Ctx = {
        rule,
        payload,
        self: payload.target && isId(payload.target) ? payload.target : null,
        created: null,
      };
      if (rule.if !== undefined && rule.if.trim() !== '') {
        const r = this.calc().evaluate(ctx.self, rule.if, this.extras(ctx));
        if (r.error) throw new RuleProblem(`the condition: ${r.error}`);
        if (!truthy(r.value)) return undefined;
      }
      const out = this.runAll(rule.then, ctx);
      return typeof out === 'object' ? out : undefined;
    } catch (e) {
      this.warn(rule, e);
      return undefined;
    } finally {
      this.active -= 1;
      this.depth -= 1;
      if (this.depth === 0) this.seen.clear();
    }
  }

  private warn(rule: Rule, e: unknown): void {
    const reason = e instanceof Error ? e.message : String(e);
    this.o.host.message('warning', `Rule "${rule.label}": ${reason}`);
  }

  private runAll(list: readonly RuleAction[], ctx: Ctx): Outcome {
    for (const action of list) {
      const out = this.runOne(action, ctx);
      if (out !== 'done') return out;
    }
    return 'done';
  }

  private runOne(a: RuleAction, ctx: Ctx): Outcome {
    const { host, commands } = this.o;
    switch (a.action) {
      case 'setAttribute': {
        const target = this.targetOf(ctx, a.target);
        this.setAttribute(target, a.attribute, this.valueOf(ctx, a.value));
        return 'done';
      }
      case 'createObject': {
        const live = this.live();
        const base = ctx.self
          ? live.elements[ctx.self as ElementId]
          : undefined;
        const defs = this.defsOf(a.class);
        const attrs: Record<string, Json> = {};
        for (const [key, raw] of Object.entries(a.attributes ?? {})) {
          const def = defs.find((d) => d.key === key);
          if (!def)
            throw new RuleProblem(
              `the class has no attribute "${key}" to fill in.`,
            );
          attrs[def.id] = this.valueOf(ctx, raw);
        }
        const off = a.offset ?? { x: 40, y: 40 };
        const r = this.mutate({
          type: 'createElement',
          class: a.class,
          x: (base?.x ?? 0) + off.x,
          y: (base?.y ?? 0) + off.y,
          attrs,
        });
        if (typeof r === 'string') ctx.created = r;
        return 'done';
      }
      case 'createConnector': {
        const from = a.from === undefined ? ctx.self : this.idOf(ctx, a.from);
        const to =
          a.to === undefined ? (ctx.created ?? ctx.self) : this.idOf(ctx, a.to);
        if (!from || !to)
          throw new RuleProblem('a connector needs two objects to join.');
        this.mutate({
          type: 'createConnector',
          relation: a.relation,
          from: from as ElementId,
          to: to as ElementId,
        });
        return 'done';
      }
      case 'delete': {
        const target = this.targetOf(ctx, a.target);
        this.mutate({ type: 'delete', id: target as ElementId });
        return 'done';
      }
      case 'message':
        host.message(a.kind, this.textOf(ctx, a.text));
        return 'done';
      case 'ask': {
        const yes = host.confirm(this.textOf(ctx, a.text));
        return this.runAll(yes ? a.then : (a.else ?? []), ctx);
      }
      case 'choose': {
        const answer = host.choose(this.textOf(ctx, a.text), a.options);
        if (answer === null) return this.stopOrCancel(ctx, 'Cancelled.');
        // Before an action nothing can be written, so the answer only decides whether it goes on.
        if (this.isBefore(ctx)) return 'done';
        this.setAttribute(this.targetOf(ctx, a.target), a.attribute, answer);
        return 'done';
      }
      case 'cancel': {
        const reason = this.textOf(ctx, a.reason) || 'Cancelled by a rule.';
        if (!this.isCancellable(ctx)) return 'stop';
        host.message('warning', reason);
        return { cancel: reason };
      }
      case 'openModel':
        host.openModel(this.textOf(ctx, a.model));
        return 'done';
      case 'runCommand': {
        const name = this.textOf(ctx, a.command);
        const entry =
          commands.get(name) ??
          commands.list().find((c) => c.label === name || c.id === name);
        if (entry) entry.run(ctx.self);
        else host.runCommand(name, ctx.self);
        return 'done';
      }
      case 'runScript':
        host.runScript(this.textOf(ctx, a.script), ctx.self);
        return 'done';
    }
  }

  private isCancellable(ctx: Ctx): boolean {
    return (CANCELLABLE_EVENTS as readonly string[]).includes(
      ctx.payload.event,
    );
  }

  /** True while the model is not changed yet, so the actions cannot write. */
  private isBefore(ctx: Ctx): boolean {
    return this.isCancellable(ctx) && this.o.bus.state !== undefined;
  }

  private stopOrCancel(ctx: Ctx, reason: string): Outcome {
    return this.isCancellable(ctx) ? { cancel: reason } : 'stop';
  }

  // Formulas ----------------------------------------------------------------------------------

  /** Outside a step the shared calculator is right; inside one it would read the old state. */
  private calc(): ModelCalculator {
    if (this.active === 0) return this.o.calculator;
    return new ModelCalculator(this.o.kit(), () => this.live());
  }

  private live(): Model {
    return this.active > 0 && this.latest
      ? this.latest
      : (this.o.store.state as Model);
  }

  private extras(ctx: Ctx): Record<string, Value> {
    const p = ctx.payload;
    return {
      $old: (p.old ?? null) as Value,
      $new: (p.new ?? null) as Value,
      $event: p.event as string,
      $attribute: p.attribute ?? null,
    };
  }

  private formula(ctx: Ctx, source: string): Json {
    const r = this.calc().evaluate(ctx.self, source, this.extras(ctx));
    if (r.error) throw new RuleProblem(`${source}: ${r.error}`);
    return r.value as Json;
  }

  private valueOf(ctx: Ctx, v: RuleValue): Json {
    return isFormulaText(v) ? this.formula(ctx, v) : v;
  }

  private textOf(ctx: Ctx, v: string): string {
    return isFormulaText(v) ? toText(this.formula(ctx, v) as Value) : v;
  }

  /** An id given as `self`, an id, or a formula that gives one. */
  private idOf(ctx: Ctx, t: string): string {
    if (t === 'self') {
      if (!ctx.self)
        throw new RuleProblem('there is no object to use as self.');
      return ctx.self;
    }
    if (!isFormulaText(t) && isId(t)) return t;
    const v = this.formula(ctx, isFormulaText(t) ? t : `=${t}`);
    if (typeof v !== 'string' || !isId(v))
      throw new RuleProblem(`"${t}" does not give an object.`);
    return v;
  }

  private targetOf(ctx: Ctx, t: string | undefined): string {
    if (t === undefined || t === '') {
      if (!ctx.self) throw new RuleProblem('there is no object to change.');
      return ctx.self;
    }
    return this.idOf(ctx, t);
  }

  // Changes -----------------------------------------------------------------------------------

  private defsOf(owner: ClassId | string): AttributeDef[] {
    const kit = this.o.kit();
    try {
      if (owner === 'model')
        return kit.modelTypes[this.live().manifest.modelType]?.attributes ?? [];
      if (owner.startsWith('rel_'))
        return effectiveRelationAttributes(kit, owner as never);
      return effectiveAttributes(kit, owner as ClassId);
    } catch {
      return [];
    }
  }

  private setAttribute(target: string, key: string, value: Json): void {
    const m = this.live();
    const owner =
      target === 'model'
        ? 'model'
        : (m.elements[target as ElementId]?.class ??
          m.connectors[target as ConnectorId]?.relation);
    if (!owner) throw new RuleProblem('the object to change does not exist.');
    const def = this.defsOf(owner).find((d) => d.key === key);
    if (!def) throw new RuleProblem(`there is no attribute "${key}" to set.`);
    this.mutate({
      type: 'setAttribute',
      target: target as ElementId,
      attr: def.id,
      value,
    });
  }

  /** Runs a command in the step in progress; a refusal becomes a problem that ends the rule. */
  private mutate(
    command: Parameters<ModelStore['execute']>[0] & { type: string },
  ): unknown {
    let r;
    try {
      r = this.o.store.execute(command as never);
    } catch (e) {
      if (e instanceof CommandError) {
        if (/before handler/.test(e.message))
          throw new RuleProblem(
            'this rule runs before the action, so it can only cancel or ask. Use an event that says "changed" to change things.',
          );
        throw new RuleProblem(e.message);
      }
      throw e;
    }
    if (!r.ok) throw new RuleProblem(r.reason);
    return r.value;
  }

  // Dry run -----------------------------------------------------------------------------------

  private describeAll(
    list: readonly RuleAction[],
    ctx: Ctx,
    indent: string,
  ): string[] {
    return list.flatMap((a) => this.describe(a, ctx, indent));
  }

  private show(ctx: Ctx, v: RuleValue): string {
    if (!isFormulaText(v)) return JSON.stringify(v);
    const r = this.calc().evaluate(ctx.self, v, this.extras(ctx));
    return r.error
      ? `the formula ${v} (it fails now: ${r.error})`
      : `${JSON.stringify(r.value)} (from ${v})`;
  }

  private showText(ctx: Ctx, v: string): string {
    if (!isFormulaText(v)) return `"${v}"`;
    const r = this.calc().evaluate(ctx.self, v, this.extras(ctx));
    return r.error
      ? `the formula ${v} (it fails now: ${r.error})`
      : `"${toText(r.value)}" (from ${v})`;
  }

  private who(t: string | undefined): string {
    return t === undefined || t === '' || t === 'self'
      ? 'the object'
      : `the object given by ${t}`;
  }

  private describe(a: RuleAction, ctx: Ctx, indent: string): string[] {
    const kit = this.o.kit();
    const line = (s: string) => [`${indent}${s}`];
    switch (a.action) {
      case 'setAttribute':
        return line(
          `Set ${a.attribute} of ${this.who(a.target)} to ${this.show(ctx, a.value)}.`,
        );
      case 'createObject':
        return line(
          `Create a ${kit.classes[a.class]?.key ?? a.class} object${
            a.attributes
              ? ` with ${Object.entries(a.attributes)
                  .map(([k, v]) => `${k} = ${this.show(ctx, v)}`)
                  .join(', ')}`
              : ''
          }.`,
        );
      case 'createConnector':
        return line(
          `Connect ${a.from ? `"${a.from}"` : 'the object'} to ${
            a.to ? `"${a.to}"` : 'the new object or the object'
          } with a ${kit.relations[a.relation]?.key ?? a.relation} connector.`,
        );
      case 'delete':
        return line(`Delete ${this.who(a.target)}.`);
      case 'message':
        return line(`Show a ${a.kind} message ${this.showText(ctx, a.text)}.`);
      case 'ask':
        return [
          ...line(`Ask ${this.showText(ctx, a.text)}. If the answer is yes:`),
          ...this.describeAll(a.then, ctx, `${indent}  `),
          ...(a.else && a.else.length > 0
            ? [
                ...line('If the answer is no:'),
                ...this.describeAll(a.else, ctx, `${indent}  `),
              ]
            : []),
        ];
      case 'choose':
        return line(
          `Ask ${this.showText(ctx, a.text)} with the choices ${a.options.join(', ')}, and put the answer in ${a.attribute} of ${this.who(a.target)}.`,
        );
      case 'cancel':
        return line(
          `Cancel the action, saying ${this.showText(ctx, a.reason)}.`,
        );
      case 'openModel':
        return line(`Open the model ${this.showText(ctx, a.model)}.`);
      case 'runCommand':
        return line(`Run the command ${this.showText(ctx, a.command)}.`);
      case 'runScript':
        return line(`Run the script ${this.showText(ctx, a.script)}.`);
    }
  }
}
