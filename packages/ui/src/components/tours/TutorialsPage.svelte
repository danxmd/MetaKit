<script lang="ts">
  import { onMount } from 'svelte';
  import type { Topic } from '@metakit-app/docs';
  import { loadDocsIndex } from '../../docs/load';
  import { tours, type TourSnapshot } from '../../tours/tour-state';
  import {
    tourBlocker,
    tourLength,
    type TourGoTo,
    type TourWhere,
  } from '../../tours/start';
  import type { Tour } from '../../tours/tours';

  let {
    where,
    onStart,
    onGoTo,
    onReadTopic,
    onClose,
  }: {
    /** What is open, which decides whether a tour can start here. */
    where: TourWhere;
    onStart: (tour: Tour) => void;
    /** Go where a blocked tour can run; `then` starts it once there, when that is possible. */
    onGoTo: (goTo: TourGoTo, then: Tour | null) => void;
    onReadTopic: (id: string) => void;
    /** On the start page there is no top bar, so the page offers its own way back. */
    onClose?: () => void;
  } = $props();

  let list = $state<readonly Tour[]>([]);
  let written = $state<Topic[] | null>(null);
  let writtenFailed = $state(false);
  let snap = $state<TourSnapshot>(tours.get());

  onMount(() => {
    const stop = tours.subscribe((s) => (snap = s));
    // The tour texts and the docs are separate chunks, fetched when this page first opens.
    void import('../../tours/tours').then((m) => (list = m.TOURS));
    loadDocsIndex().then(
      (index) => (written = index.byCategory('tutorials')),
      () => (writtenFailed = true),
    );
    return stop;
  });
</script>

<main class="tutorials" data-testid="tutorials-page">
  <div class="wrap">
    {#if onClose}
      <button
        type="button"
        class="ghost back"
        onclick={onClose}
        data-testid="tutorials-back">← Start page</button
      >
    {/if}
    <header>
      <h1>Tutorials</h1>
      <p class="lead">
        Guided tours point at the real buttons of a page, one step at a time.
        Written tutorials walk you through a whole task.
      </p>
    </header>

    <section aria-labelledby="tours-heading">
      <h2 id="tours-heading">Guided tours</h2>
      {#if list.length === 0}
        <p class="muted">Loading…</p>
      {/if}
      <ul class="tours">
        {#each list as tour (tour.id)}
          {@const done = snap.done.includes(tour.id)}
          {@const blocked = tourBlocker(tour, where)}
          <li class="card tour" data-testid="tour-card-{tour.id}">
            <div class="title-row">
              <h3>{tour.title}</h3>
              <span class="badge" class:done data-testid="tour-status-{tour.id}"
                >{done ? 'Done' : 'Not started'}</span
              >
            </div>
            <p class="summary">{tour.summary}</p>
            <p class="meta">{tourLength(tour)}</p>
            <div class="actions">
              {#if blocked}
                <p class="needs" data-testid="tour-needs-{tour.id}">
                  {blocked.message}
                </p>
                <button
                  type="button"
                  onclick={() =>
                    onGoTo(blocked.goTo, blocked.thenStart ? tour : null)}
                  data-testid="tour-goto-{tour.id}">{blocked.label}</button
                >
              {:else}
                <button
                  type="button"
                  class="primary"
                  onclick={() => onStart(tour)}
                  data-testid="tour-start-{tour.id}"
                  >{done ? 'Start again' : 'Start'}</button
                >
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </section>

    <section aria-labelledby="written-heading">
      <h2 id="written-heading">Written tutorials</h2>
      <p class="muted intro">
        Step-by-step help topics. They open in the documentation.
      </p>
      {#if writtenFailed}
        <p class="notice error" role="alert">
          The tutorials could not be loaded.
        </p>
      {:else if !written}
        <p class="muted">Loading…</p>
      {:else}
        <ul class="written">
          {#each written as topic (topic.id)}
            <li>
              <button
                type="button"
                class="topic"
                onclick={() => onReadTopic(topic.id)}
                data-testid="written-tutorial"
                data-topic={topic.id}
              >
                <strong>{topic.title}</strong>
                <span class="muted">{topic.summary}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
</main>

<style>
  .tutorials {
    height: 100%;
    overflow: auto;
    background: var(--app-bg);
  }
  .wrap {
    max-width: 60rem;
    margin: 0 auto;
    padding: var(--gap-6) var(--gap-5);
    display: grid;
    gap: var(--gap-6);
  }
  .back {
    justify-self: start;
    margin-bottom: calc(-1 * var(--gap-4));
  }
  header {
    display: grid;
    gap: var(--gap-2);
  }
  .lead {
    color: var(--text-muted);
    font-size: var(--text-m);
    max-width: 40rem;
  }
  section {
    display: grid;
    gap: var(--gap-3);
    align-content: start;
  }
  .intro {
    font-size: var(--text-s);
    margin-top: calc(-1 * var(--gap-2));
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .tours {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: var(--gap-3);
  }
  .tour {
    padding: var(--gap-4);
    display: grid;
    grid-template-rows: auto 1fr auto auto;
    gap: var(--gap-2);
  }
  .title-row {
    display: flex;
    gap: var(--gap-2);
    align-items: baseline;
    justify-content: space-between;
  }
  .badge.done {
    background: var(--success-soft);
    color: var(--success);
  }
  .summary {
    font-size: var(--text-s);
    color: var(--text-muted);
  }
  .meta {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-2);
    align-items: center;
    margin-top: var(--gap-1);
  }
  .needs {
    flex-basis: 100%;
    font-size: var(--text-s);
    color: var(--text);
  }
  .written {
    display: grid;
    gap: var(--gap-2);
  }
  .topic {
    width: 100%;
    display: grid;
    gap: var(--gap-1);
    text-align: left;
    padding: var(--gap-3) var(--gap-4);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .topic strong {
    color: var(--text-strong);
    font-size: var(--text-m);
  }
  .topic span {
    font-weight: 400;
  }
</style>
