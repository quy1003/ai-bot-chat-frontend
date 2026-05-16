<template>
  <div class="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6">
    <NuxtRouteAnnouncer />
    <div class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
      <ChatBox />
    </div>
  </div>
</template>

<script setup lang="ts">
import ChatBox from './components/ChatBox.vue'
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=General+Sans:wght@400;500;600;700&display=swap');

:root {
  color-scheme: light;
}

body {
  margin: 0;
  font-family: 'General Sans', 'Segoe UI', sans-serif;
}
</style>
