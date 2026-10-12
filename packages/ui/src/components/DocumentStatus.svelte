<script lang="ts">
  /** The save or sync status and the people of the open document, shown in the top bar. */
  interface Person {
    instance: string;
    name: string;
    colour: string;
    initials: string;
  }

  let {
    saveText,
    saveBad = false,
    syncText,
    me,
    people = [],
    testid = 'save-status',
    tour,
  }: {
    saveText: string;
    saveBad?: boolean;
    /** Longer text about syncing; read out only when it says more than `saveText`. */
    syncText?: string;
    me?: Person;
    people?: Person[];
    testid?: string;
    /** Prefix of the tour anchors, so a tour can point at the status and the people. */
    tour?: string;
  } = $props();
</script>

<span
  class="status"
  class:bad={saveBad}
  data-testid={testid}
  data-tour={tour && `${tour}-save`}>{saveText}</span
>
{#if syncText !== undefined}
  <span
    class="status sync"
    class:visually-hidden={syncText === saveText}
    data-testid="sync-status"
    title={syncText}>{syncText}</span
  >
{/if}
{#if me}
  <ul
    class="people"
    aria-label="People in this model"
    data-testid="people"
    data-tour={tour && `${tour}-people`}
  >
    <li
      class="avatar me"
      style="background:{me.colour}"
      title="{me.name} (you)"
      data-testid="avatar-me"
    >
      {me.initials}
    </li>
    {#each people as person (person.instance)}
      <li
        class="avatar"
        style="background:{person.colour}"
        title={person.name}
        data-testid="avatar-{person.instance}"
      >
        {person.initials}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .status {
    color: var(--text-muted);
    font-size: var(--text-s);
    white-space: nowrap;
  }
  .status.bad {
    color: var(--danger);
  }
  .sync {
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    max-width: 18rem;
  }
  .people {
    flex: none;
    display: flex;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .avatar {
    width: 1.7rem;
    height: 1.7rem;
    border-radius: 50%;
    /* Text on the person's own colour, which is chosen by them and always mid to strong. */
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
    display: grid;
    place-items: center;
    border: 2px solid var(--surface);
    margin-left: -0.35rem;
  }
  .avatar:first-child {
    margin-left: 0;
  }
  .avatar.me {
    outline: 2px solid var(--line-strong);
  }
</style>
