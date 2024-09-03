<script lang="ts">
  let { data } = $props();
</script>

<pre><code>{JSON.stringify(data.cards, null, 2) || 'No cards'}</code></pre>
