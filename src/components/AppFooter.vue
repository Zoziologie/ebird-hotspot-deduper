<script setup>
defineProps({
  appVersion: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['open-token-modal'])
</script>

<template>
  <footer class="app-footer">
    <div class="container-fluid">
      <div class="footer-line">
        <span>v{{ appVersion }}</span>
        <span class="dot">•</span>
        <a href="https://github.com/Zoziologie/ebird-hotspot-deduper" target="_blank" rel="noopener">GitHub</a>
        <span class="dot">•</span>
        <a class="sponsor-link" href="https://github.com/sponsors/Zoziologie" target="_blank" rel="noopener">
          <i class="bi bi-heart-fill me-1" aria-hidden="true" />
          Sponsor
        </a>
        <span class="dot">•</span>
        <span>Powered by</span>
        <a href="https://zoziologie.raphaelnussbaumer.com/" target="_blank" rel="noopener">Zoziologie</a>
        <span class="dot">•</span>
        <button type="button" class="footer-token-btn" @click="emit('open-token-modal')">
          <i class="bi bi-key-fill me-1" aria-hidden="true" />
          API token
        </button>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  border-top: 1px solid #ccd9ea;
  background: linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%);
  padding: 0.36rem 0;
}

.footer-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  color: #64748b;
}

.footer-line a {
  color: #334155;
  text-decoration: none;
}

.footer-line a:hover {
  text-decoration: underline;
}

.sponsor-link {
  color: #be185d;
  font-weight: 600;
}

.sponsor-link:hover {
  color: #9d174d;
}

.footer-token-btn {
  border: 0;
  background: transparent;
  color: #334155;
  font-size: 0.82rem;
  padding: 0;
}

.footer-token-btn:hover {
  text-decoration: underline;
}

.dot {
  color: #94a3b8;
}
</style>
