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
        <a class="zoziologie-link" href="https://zoziologie.raphaelnussbaumer.com/" target="_blank" rel="noopener">
          <span class="zoziologie-icon" aria-hidden="true" />
          Zoziologie
        </a>
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
  border-top: 1px solid var(--brand-border);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--brand-surface) 58%, #ffffff 42%) 0%,
      color-mix(in srgb, var(--brand-surface) 76%, #ffffff 24%) 100%
    );
  padding: 0.42rem 0;
}

.footer-line {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  font-size: 0.82rem;
  color: var(--brand-muted);
}

.footer-line a {
  color: var(--brand-ink);
  text-decoration: none;
}

.footer-line a:hover {
  text-decoration: underline;
}

.sponsor-link {
  color: #c84a2f;
  font-weight: 600;
}

.sponsor-link:hover {
  color: #9e381f;
}

.footer-token-btn {
  border: 1px solid rgba(var(--brand-primary-rgb), 0.24);
  background: rgba(var(--brand-primary-rgb), 0.08);
  color: var(--brand-primary-dark);
  border-radius: 999px;
  font-size: 0.82rem;
  padding: 0.14rem 0.5rem;
  font-weight: 600;
}

.footer-token-btn:hover {
  background: rgba(var(--brand-primary-rgb), 0.16);
}

.zoziologie-link {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  color: var(--brand-primary-dark);
  font-weight: 600;
}

.zoziologie-icon {
  width: 1.1rem;
  height: 1.1rem;
  background-color: currentColor;
  -webkit-mask: url('/logo_w.svg') center / contain no-repeat;
  mask: url('/logo_w.svg') center / contain no-repeat;
}

.dot {
  color: color-mix(in srgb, var(--brand-muted) 60%, #ffffff 40%);
}
</style>
