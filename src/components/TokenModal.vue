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
    <div class="modal-dialog-custom card shadow">
      <div class="card-body">
        <h5 class="card-title mb-2">Enter eBird API token</h5>
        <p class="small text-muted mb-3">
          Needed for region lookup and hotspot fetch.
          <a href="https://ebird.org/api/keygen" target="_blank" rel="noopener">Get token</a>
        </p>
        <input
          :value="tokenDraft"
          type="password"
          class="form-control"
          placeholder="API token"
          @input="emit('update:tokenDraft', $event.target.value)"
          @keyup.enter="emit('save-token')"
        >
        <div v-if="tokenError" class="text-danger small mt-2">{{ tokenError }}</div>
        <div class="d-flex justify-content-end mt-3">
          <button class="btn btn-primary" @click="emit('save-token')">Save</button>
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
  background: rgba(17, 24, 39, 0.45);
  z-index: 3000;
}

.modal-dialog-custom {
  width: min(520px, 92vw);
  position: relative;
  z-index: 3001;
}
</style>
