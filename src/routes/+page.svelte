<script lang="ts">
  import Monster from './Monster.svelte';
</script>

<div class="flex flex-col gap-4 md:grid md:grid-cols-2">
  <div id="attacking" class="card">
    <header>Player A: Attacking Monster</header>
    <Monster />
  </div>
  <div id="defending" class="card">
    <header>Player B: Defending Monster</header>
    <Monster />
  </div>
  <div id="modifications" class="card col-span-2">
    <header>Modifications</header>
    <article>
      <ul>
        <li>Player A's Modifiers:</li>
        <li>Player B's Modifiers:</li>
      </ul>
    </article>
  </div>
  <div id="result" class="card col-span-2">
    <header>Battle Result</header>
    <article>
      <ul>
        <li>Damage Player A Takes:</li>
        <li>Damage Player B Takes:</li>
      </ul>
    </article>
  </div>
</div>

<style lang="postcss">
  .card {
    @apply p-4 preset-filled-surface-100-900;
  }
</style>
