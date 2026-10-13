<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head>
  <title>Admin sign in · ygo.tools</title>
</svelte:head>

<section class="card mx-auto flex w-full max-w-sm flex-col gap-3 p-4">
  {#if !data.configured}
    <p class="text-sm">The admin dashboard is disabled: <code class="code">ADMIN_DASHBOARD_PASS</code> is not set.</p>
  {:else}
    <form method="POST" action="?/login" class="flex flex-col gap-2">
      <label class="label flex flex-col gap-1">
        <span class="label-text text-xs font-medium">Password</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input class="input text-sm" type="password" name="password" autocomplete="current-password" required autofocus />
      </label>
      {#if form?.wrong}<p class="text-error-500 text-sm">Wrong password.</p>{/if}
      <button class="btn preset-filled-primary-500 btn-sm" type="submit">Sign in</button>
    </form>
  {/if}
</section>
