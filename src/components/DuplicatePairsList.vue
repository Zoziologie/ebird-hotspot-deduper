<script setup>
const props = defineProps({
  pairs: {
    type: Array,
    required: true,
  },
  selectedPairId: {
    type: String,
    default: null,
  },
})

const emit = defineEmits(['select-pair'])

function selectPair(id) {
  emit('select-pair', id)
}

function formatCount(value) {
  return Number.isFinite(value) ? value.toLocaleString() : 'n/a'
}

function editUrl(locId) {
  return `https://ebird.org/mylocations/edit/${encodeURIComponent(locId)}`
}

function hotspotUrl(locId) {
  return `https://ebird.org/hotspot/${encodeURIComponent(locId)}`
}
</script>

<template>
  <div class="list-pane-head">
    <span class="fw-semibold">Duplicate hotspot pair</span>
    <span class="badge rounded-pill text-bg-light border">{{ pairs.length }}</span>
  </div>
  <div class="list-pane-body">
    <div v-if="!pairs.length" class="text-muted small px-3 py-3">No candidates.</div>
    <button
      v-for="pair in pairs"
      :key="pair.id"
      type="button"
      class="pair-item btn btn-light text-start w-100"
      :class="{ active: selectedPairId === pair.id }"
      @click="selectPair(pair.id)"
    >
      <div class="d-flex justify-content-between align-items-center mb-1">
        <strong>{{ Math.round(pair.distanceMeters) }} m</strong>
        <span v-if="pair.isExactDuplicate" class="badge text-bg-danger">Exact</span>
      </div>

      <div class="pair-locations small">
        <div class="hotspot-side">
          <div class="hotspot-head">
            <a
              class="hotspot-name-link fw-semibold"
              :href="hotspotUrl(pair.hotspotA.locId)"
              target="_blank"
              rel="noopener"
              @click.stop
            >
              {{ pair.hotspotA.locName }}
            </a>
            <a
              class="icon-link"
              :href="editUrl(pair.hotspotA.locId)"
              target="_blank"
              rel="noopener"
              title="Edit hotspot"
              aria-label="Edit hotspot"
              @click.stop
            >
              <i class="bi bi-pencil-square" aria-hidden="true" />
            </a>
          </div>
          <div class="text-muted">
            {{ formatCount(pair.hotspotA.checklistCount) }} checklists ·
            {{ formatCount(pair.hotspotA.speciesCount) }} species
          </div>
        </div>

        <div class="hotspot-side">
          <div class="hotspot-head">
            <a
              class="hotspot-name-link fw-semibold"
              :href="hotspotUrl(pair.hotspotB.locId)"
              target="_blank"
              rel="noopener"
              @click.stop
            >
              {{ pair.hotspotB.locName }}
            </a>
            <a
              class="icon-link"
              :href="editUrl(pair.hotspotB.locId)"
              target="_blank"
              rel="noopener"
              title="Edit hotspot"
              aria-label="Edit hotspot"
              @click.stop
            >
              <i class="bi bi-pencil-square" aria-hidden="true" />
            </a>
          </div>
          <div class="text-muted">
            {{ formatCount(pair.hotspotB.checklistCount) }} checklists ·
            {{ formatCount(pair.hotspotB.speciesCount) }} species
          </div>
        </div>
      </div>
    </button>
  </div>
</template>

<style scoped>
.list-pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.72rem 0.8rem;
  border-bottom: 1px solid #d2deeb;
  background: #f8fbff;
}

.list-pane-body {
  overflow: auto;
  padding: 0.6rem;
}

.pair-item {
  border: 1px solid #d6e2f0;
  margin-bottom: 0.55rem;
  border-radius: 0.68rem;
  background: #ffffff;
  box-shadow: 0 3px 12px rgba(15, 23, 42, 0.06);
  transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
}

.pair-item:hover {
  border-color: #8ab4e6;
  box-shadow: 0 7px 18px rgba(30, 64, 112, 0.12);
  transform: translateY(-1px);
}

.pair-item.active {
  border-color: #2b77d3;
  background: #edf5ff;
}

.pair-locations {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.hotspot-side {
  border: 1px solid #dde7f3;
  border-radius: 0.55rem;
  padding: 0.45rem 0.52rem;
  background: linear-gradient(180deg, #fbfdff 0%, #f4f8ff 100%);
}

.hotspot-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.35rem;
  margin-bottom: 0.25rem;
}

.hotspot-name-link {
  color: #0f172a;
  text-decoration: none;
  line-height: 1.2;
}

.hotspot-name-link:hover {
  text-decoration: underline;
}

.icon-link {
  color: #475569;
  font-size: 0.95rem;
  line-height: 1;
  text-decoration: none;
  padding: 0.1rem;
}

.icon-link:hover {
  color: #0f6edb;
}

@media (max-width: 520px) {
  .pair-locations {
    grid-template-columns: 1fr;
  }
}
</style>
