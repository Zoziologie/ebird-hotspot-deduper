<script setup>
defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  tokenDraft: {
    type: String,
    default: '',
  },
  tokenError: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:tokenDraft', 'save-token', 'close'])
</script>

<template>
  <div v-if="show" class="modal-backdrop-custom">
    <div class="modal-dialog-custom card token-card shadow">
      <div class="card-body">
        <h5 class="card-title mb-2 token-title">Enter eBird API token</h5>
        <p class="small token-copy mb-3">
          Needed for region lookup and hotspot fetch.
          <a href="https://ebird.org/api/keygen" target="_blank" rel="noopener">Get token</a>
        </p>
        <input
          :value="tokenDraft"
          type="password"
          class="form-control token-input"
          placeholder="API token"
          @input="emit('update:tokenDraft', $event.target.value)"
          @keyup.enter="emit('save-token')"
        >
        <div v-if="tokenError" class="text-danger small mt-2">{{ tokenError }}</div>
        <div class="d-flex justify-content-end mt-3">
          <button class="btn btn-primary token-save-btn" @click="emit('save-token')">Save token</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop-custom {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 29, 41, 0.52);
  z-index: 3000;
}

.modal-dialog-custom {
  width: min(520px, 92vw);
  position: relative;
  z-index: 3001;
}

.token-card {
  border: 1px solid color-mix(in srgb, var(--brand-border) 68%, #ffffff 32%);
  border-radius: 0.95rem;
  overflow: hidden;
  background:
    radial-gradient(circle at 100% 0%, rgba(var(--brand-accent-rgb), 0.15) 0%, transparent 42%),
    #ffffff;
}

.token-title {
  color: var(--brand-primary-dark);
  font-weight: 700;
}

.token-copy {
  color: var(--brand-muted);
}

.token-copy a {
  color: var(--brand-primary-dark);
  font-weight: 600;
}

.token-input {
  border-color: color-mix(in srgb, var(--brand-border) 80%, #ffffff 20%);
}

.token-save-btn {
  border-radius: 999px;
  min-width: 7.25rem;
  font-weight: 600;
}

.text-danger {
  color: #bb2748 !important;
}
</style>
