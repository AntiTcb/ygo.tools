import 'unplugin-icons/types/svelte';

declare global {
  namespace App {
    interface Platform {
      env: {
        COUNTER: DurableObjectNamespace;
      };
      context: {
        waitUntil(promise: Promise<any>): void;
      };
      caches: CacheStorage & { default: Cache };
    }
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

declare module '*';

export {};
