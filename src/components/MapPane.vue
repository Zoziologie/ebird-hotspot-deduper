<script setup>
defineProps({
  showLoadingOverlay: {
    type: Boolean,
    default: false,
  },
  mapContainerRef: {
    type: [Function, Object],
    required: true,
  },
})
</script>

<template>
  <section class="map-pane">
    <div :ref="mapContainerRef" class="leaflet-map" />
    <div v-if="showLoadingOverlay" class="loading-overlay">
      <div class="loading-card">
        <div class="spinner-border text-primary" role="status" aria-hidden="true" />
        <div class="small text-muted mt-2">Loading hotspots...</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.map-pane {
  min-height: 0;
  border-left: 1px solid #dde8f3;
  background: #ffffff;
  position: relative;
}

.leaflet-map {
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(246, 250, 255, 0.7);
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(1px);
}

.loading-card {
  background: #ffffff;
  border: 1px solid #d8e2ef;
  border-radius: 0.7rem;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.12);
  padding: 0.85rem 1rem 0.65rem;
  text-align: center;
}
</style>
