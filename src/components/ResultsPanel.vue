<script setup>
const props = defineProps({
  visiblePairCount: {
    type: Number,
    default: 0,
  },
  totalPairCount: {
    type: Number,
    default: 0,
  },
  hasFetchAttempted: {
    type: Boolean,
    default: false,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  sortBy: {
    type: String,
    default: "distance",
  },
  thresholdMeters: {
    type: Number,
    default: 10,
  },
  nameSimilarityPercent: {
    type: Number,
    default: 50,
  },
  pairs: {
    type: Array,
    required: true,
  },
  selectedPairId: {
    type: String,
    default: null,
  },
});

const emit = defineEmits([
  "update:sort-by",
  "update:threshold-meters",
  "update:name-similarity-threshold",
  "select-pair",
]);

const DISTANCE_MIN = 0;
const DISTANCE_MAX = 1000;
const NAME_MIN = 0;
const NAME_MAX = 100;

function updateSortBy(event) {
  emit("update:sort-by", event.target.value);
}

function onDistanceInput(event) {
  emitDistance(event.target.value);
}

function onDistanceBlur(event) {
  emitDistance(event.target.value);
}

function onNameSimilarityInput(event) {
  emitNameSimilarity(event.target.value);
}

function onNameSimilarityBlur(event) {
  emitNameSimilarity(event.target.value);
}

function emitDistance(value) {
  emit("update:threshold-meters", clampInt(value, DISTANCE_MIN, DISTANCE_MAX));
}

function emitNameSimilarity(value) {
  emit("update:name-similarity-threshold", clampInt(value, NAME_MIN, NAME_MAX));
}

function selectPair(id) {
  emit("select-pair", id);
}

function clampInt(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return min;
  }
  const rounded = Math.round(parsed);
  return Math.min(max, Math.max(min, rounded));
}

function formatCount(value) {
  return Number.isFinite(value) ? value.toLocaleString() : "n/a";
}

function editUrl(locId) {
  return `https://ebird.org/mylocations/edit/${encodeURIComponent(locId)}`;
}

function hotspotUrl(locId) {
  return `https://ebird.org/hotspot/${encodeURIComponent(locId)}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }
  return `${Math.round(value * 100)}%`;
}

function nameIntensityClass(score) {
  if (!Number.isFinite(score)) {
    return "name-badge-low";
  }
  if (score >= 0.85) {
    return "name-badge-strong";
  }
  if (score >= 0.65) {
    return "name-badge-medium";
  }
  return "name-badge-low";
}

function distanceIntensityClass(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) {
    return "distance-badge-low";
  }
  if (distanceMeters <= 100) {
    return "distance-badge-strong";
  }
  if (distanceMeters <= 350) {
    return "distance-badge-medium";
  }
  return "distance-badge-low";
}
</script>

<template>
  <section class="results-panel">
    <div class="list-pane-head">
      <div class="head-top">
        <span class="head-title">Duplicate hotspot pairs</span>
        <span class="count-pill">{{ visiblePairCount }}/{{ totalPairCount }}</span>
      </div>
      <div class="head-filters">
        <div class="filter-item">
          <label class="filter-label">Max Distance</label>
          <div class="input-group input-group-sm">
            <input
              type="number"
              class="form-control filter-input"
              :value="thresholdMeters"
              min="0"
              max="1000"
              step="10"
              @input="onDistanceInput"
              @blur="onDistanceBlur"
            />
            <span class="input-group-text">m</span>
          </div>
        </div>

        <div class="filter-item">
          <label class="filter-label">Min Name Similarity</label>
          <div class="input-group input-group-sm">
            <input
              type="number"
              class="form-control filter-input"
              :value="nameSimilarityPercent"
              min="0"
              max="100"
              step="1"
              @input="onNameSimilarityInput"
              @blur="onNameSimilarityBlur"
            />
            <span class="input-group-text">%</span>
          </div>
        </div>

        <div class="filter-item sort-item">
          <label class="filter-label" for="pairs-sort-select">Sort</label>
          <select
            id="pairs-sort-select"
            class="form-select form-select-sm sort-select"
            :value="sortBy"
            @input="updateSortBy"
          >
            <option value="distance">Distance</option>
            <option value="nameSimilarity">Name similarity</option>
          </select>
        </div>
      </div>
    </div>

    <div class="list-pane-body">
      <div v-if="!pairs.length" class="empty-state">
        <i class="bi bi-binoculars" aria-hidden="true" />
        <span v-if="isLoading">Scanning hotspots and computing duplicate candidates...</span>
        <span v-else-if="!hasFetchAttempted">Select a country and click on "Scan Duplicates".</span>
        <span v-else-if="totalPairCount > 0"
          >No candidate pairs for current filters. Try relaxing the thresholds.</span
        >
        <span v-else
          >Well done! No duplicate hotspots found in this region.</span
        >
      </div>
      <button
        v-for="pair in pairs"
        :key="pair.id"
        type="button"
        class="pair-item btn btn-light text-start w-100"
        :class="{ active: selectedPairId === pair.id }"
        @click="selectPair(pair.id)"
      >
        <div class="d-flex justify-content-end align-items-center mb-1">
          <div class="pair-badges">
            <span class="badge pair-badge name-badge" :class="nameIntensityClass(pair.nameSimilarityScore)"
              >Name {{ formatPercent(pair.nameSimilarityScore) }}</span
            >
            <span class="badge pair-badge distance-badge" :class="distanceIntensityClass(pair.distanceMeters)"
              >Distance {{ Math.round(pair.distanceMeters) }} m</span
            >
            <span v-if="pair.isExactDuplicate" class="badge pair-badge exact-badge">Exact</span>
          </div>
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
            <div class="hotspot-metrics">
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
            <div class="hotspot-metrics">
              {{ formatCount(pair.hotspotB.checklistCount) }} checklists ·
              {{ formatCount(pair.hotspotB.speciesCount) }} species
            </div>
          </div>
        </div>
      </button>
    </div>
  </section>
</template>

<style scoped>
.results-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.list-pane-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.7rem 0.8rem;
  padding: 0.82rem 0.84rem;
  border-bottom: 1px solid var(--brand-border);
  background:
    radial-gradient(circle at 100% 0%, rgba(var(--brand-accent-rgb), 0.12) 0%, transparent 42%),
    linear-gradient(
      180deg,
      #ffffff 0%,
      color-mix(in srgb, var(--brand-surface) 62%, #ffffff 38%) 100%
    );
  min-width: 0;
}

.head-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1 1 14rem;
  min-width: 0;
  flex-wrap: wrap;
}

.head-title {
  font-size: 0.99rem;
  font-weight: 700;
  color: var(--brand-primary-dark);
  letter-spacing: 0.01em;
}

.count-pill {
  border-radius: 999px;
  border: 1px solid rgba(var(--brand-primary-rgb), 0.28);
  background: rgba(var(--brand-primary-rgb), 0.11);
  color: var(--brand-primary-dark);
  font-weight: 700;
  padding: 0.06rem 0.5rem;
  font-size: 0.77rem;
  line-height: 1.35;
}

.head-filters {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0;
  flex: 1 1 28rem;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
}

.filter-item {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.22rem;
  flex: 1 1 9rem;
}

.filter-label {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--brand-muted);
}

.input-group-text {
  border-color: color-mix(in srgb, var(--brand-border) 78%, #ffffff 22%);
  background: color-mix(in srgb, var(--brand-surface) 70%, #ffffff 30%);
  color: var(--brand-muted);
  min-width: 2rem;
  justify-content: center;
}

.filter-input {
  width: 100%;
  min-width: 0;
  border-color: color-mix(in srgb, var(--brand-border) 78%, #ffffff 22%);
  font-weight: 600;
  color: var(--brand-ink);
}

.filter-item :deep(.input-group) {
  width: 100%;
  min-width: 0;
  flex-wrap: nowrap;
}

.head-filters :deep(.form-control),
.head-filters :deep(.form-select),
.head-filters :deep(.input-group-text) {
  min-height: 2rem;
}

.sort-item {
  min-width: 0;
  flex-basis: 11rem;
}

.sort-select {
  width: 100%;
  min-width: 0;
  border-color: color-mix(in srgb, var(--brand-border) 78%, #ffffff 22%);
  color: var(--brand-ink);
}

.list-pane-body {
  overflow: auto;
  padding: 0.62rem;
  flex: 1 1 auto;
  min-height: 0;
}

.pair-item {
  border: 1px solid color-mix(in srgb, var(--brand-border) 75%, #ffffff 25%);
  margin-bottom: 0.58rem;
  border-radius: 0.8rem;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(14, 36, 54, 0.08);
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease,
    transform 120ms ease;
}

.pair-item:hover {
  border-color: rgba(var(--brand-primary-rgb), 0.5);
  box-shadow: 0 12px 24px rgba(14, 36, 54, 0.14);
  transform: translateY(-1px);
}

.pair-item.active {
  border-color: var(--brand-primary);
  background:
    linear-gradient(
      180deg,
      rgba(var(--brand-primary-rgb), 0.12) 0%,
      rgba(var(--brand-primary-rgb), 0.06) 100%
    ),
    #ffffff;
}

.pair-locations {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.pair-badges {
  display: flex;
  align-items: center;
  gap: 0.34rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.pair-badge {
  border-radius: 999px;
  padding: 0.24rem 0.52rem;
  font-size: 0.69rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.name-badge {
  color: var(--brand-primary-dark);
}

.name-badge-strong {
  background: rgba(var(--brand-primary-rgb), 0.3);
}

.name-badge-medium {
  background: rgba(var(--brand-primary-rgb), 0.2);
}

.name-badge-low {
  background: rgba(var(--brand-primary-rgb), 0.1);
}

.distance-badge {
  color: #8f351d;
}

.distance-badge-strong {
  background: rgba(var(--brand-accent-rgb), 0.3);
}

.distance-badge-medium {
  background: rgba(var(--brand-accent-rgb), 0.2);
}

.distance-badge-low {
  background: rgba(var(--brand-accent-rgb), 0.1);
}

.exact-badge {
  background: rgba(189, 39, 72, 0.15);
  color: #aa2340;
}

.hotspot-side {
  border: 1px solid color-mix(in srgb, var(--brand-border) 62%, #ffffff 38%);
  border-radius: 0.65rem;
  padding: 0.48rem 0.54rem;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--brand-surface) 55%, #ffffff 45%) 0%,
    #ffffff 100%
  );
}

.hotspot-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.35rem;
  margin-bottom: 0.25rem;
}

.hotspot-name-link {
  color: var(--brand-ink);
  text-decoration: none;
  line-height: 1.2;
}

.hotspot-name-link:hover {
  text-decoration: underline;
}

.icon-link {
  color: var(--brand-muted);
  font-size: 0.95rem;
  line-height: 1;
  text-decoration: none;
  padding: 0.1rem;
}

.icon-link:hover {
  color: var(--brand-primary-dark);
}

.hotspot-metrics {
  color: var(--brand-muted);
  font-size: 0.76rem;
}

.empty-state {
  margin: 0.7rem;
  border: 1px dashed color-mix(in srgb, var(--brand-border) 78%, #ffffff 22%);
  border-radius: 0.76rem;
  background: color-mix(in srgb, var(--brand-surface) 70%, #ffffff 30%);
  color: var(--brand-muted);
  font-size: 0.84rem;
  padding: 0.86rem 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.48rem;
}

@media (max-width: 680px) {
  .list-pane-head {
    gap: 0.55rem;
    padding: 0.7rem 0.68rem;
  }

  .head-title {
    font-size: 0.91rem;
  }

  .head-top,
  .head-filters,
  .filter-item,
  .sort-item {
    flex-basis: 100%;
  }

  .head-filters {
    justify-content: stretch;
  }

  .filter-item {
    width: 100%;
  }

  .filter-label {
    font-size: 0.67rem;
  }
}

@media (max-width: 520px) {
  .pair-locations {
    grid-template-columns: 1fr;
  }
}
</style>
