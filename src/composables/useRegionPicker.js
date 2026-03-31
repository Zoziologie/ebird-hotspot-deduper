import { computed, reactive, ref, watch } from 'vue'

const URL_REGION_KEY = 'regionCode'
const REGION_CODE_PATTERN = /^[A-Z]{2}(?:-[A-Z0-9]+)*$/i

export function useRegionPicker({ apiToken, ebirdGet, onRegionStateChange, clearErrorMessage, setErrorMessage }) {
  const form = reactive({
    countryQuery: '',
    subnational1Query: '',
    subnational2Query: '',
  })

  const selectedCountry = ref(null)
  const selectedSubnational1 = ref(null)
  const selectedSubnational2 = ref(null)

  const countries = ref([])
  const countriesLoaded = ref(false)
  const countriesLoading = ref(false)

  const subnational1Options = ref([])
  const subnational1LoadedFor = ref('')
  const subnational1Loading = ref(false)

  const subnational2Options = ref([])
  const subnational2LoadedFor = ref('')
  const subnational2Loading = ref(false)

  const countrySuggestions = ref([])
  const subnational1Suggestions = ref([])
  const subnational2Suggestions = ref([])

  const selectedRegionCode = computed(
    () => selectedSubnational2.value?.code || selectedSubnational1.value?.code || selectedCountry.value?.code || '',
  )
  const selectedRegionName = computed(
    () => selectedSubnational2.value?.name || selectedSubnational1.value?.name || selectedCountry.value?.name || '',
  )

  const regionLookupBusy = computed(
    () => countriesLoading.value || subnational1Loading.value || subnational2Loading.value,
  )

  const hasAnyRegionInput = computed(
    () => Boolean(form.countryQuery || form.subnational1Query || form.subnational2Query),
  )

  let subnational1RequestId = 0
  let subnational2RequestId = 0

  watch(
    apiToken,
    async (token, previousToken) => {
      const trimmedToken = token.trim()
      const previousTrimmedToken = previousToken?.trim() || ''

      if (!trimmedToken) {
        countries.value = []
        countriesLoaded.value = false
        resetRegionSelectionState()
        return
      }

      if (trimmedToken !== previousTrimmedToken) {
        countries.value = []
        countriesLoaded.value = false
        await initializeRegionPicker()
      }
    },
  )

  async function initializeRegionPicker() {
    resetRegionSelectionState()
    clearErrorMessage()
    await loadCountries()
    const regionCodeFromUrl = readRegionCodeFromUrl()
    if (regionCodeFromUrl) {
      await restoreRegionSelectionFromCode(regionCodeFromUrl)
    }
  }

  async function loadCountries() {
    if (!apiToken.value.trim() || countriesLoaded.value || countriesLoading.value) {
      return
    }

    countriesLoading.value = true
    try {
      const result = await ebirdGet('/ref/region/list/country/world')
      countries.value = normalizeRegionList(result)
      countriesLoaded.value = true
    } catch (error) {
      countries.value = []
      countriesLoaded.value = false
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load countries.')
    } finally {
      countriesLoading.value = false
    }
  }

  async function ensureSubnational1Loaded(countryCode) {
    if (!apiToken.value.trim()) {
      return
    }

    const normalizedCountryCode = asRegionCode(countryCode)
    if (!normalizedCountryCode || subnational1LoadedFor.value === normalizedCountryCode) {
      return
    }

    const requestId = subnational1RequestId + 1
    subnational1RequestId = requestId
    subnational1Loading.value = true

    try {
      const result = await ebirdGet(`/ref/region/list/subnational1/${encodeURIComponent(normalizedCountryCode)}`)
      if (requestId !== subnational1RequestId) {
        return
      }
      subnational1Options.value = normalizeRegionList(result)
      subnational1LoadedFor.value = normalizedCountryCode
    } catch (error) {
      if (requestId !== subnational1RequestId) {
        return
      }
      subnational1Options.value = []
      subnational1LoadedFor.value = ''
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load regions.')
    } finally {
      if (requestId === subnational1RequestId) {
        subnational1Loading.value = false
      }
    }
  }

  async function ensureSubnational2Loaded(subnational1Code) {
    if (!apiToken.value.trim()) {
      return
    }

    const normalizedSubnational1Code = asRegionCode(subnational1Code)
    if (!normalizedSubnational1Code || subnational2LoadedFor.value === normalizedSubnational1Code) {
      return
    }

    const requestId = subnational2RequestId + 1
    subnational2RequestId = requestId
    subnational2Loading.value = true

    try {
      const result = await ebirdGet(`/ref/region/list/subnational2/${encodeURIComponent(normalizedSubnational1Code)}`)
      if (requestId !== subnational2RequestId) {
        return
      }
      subnational2Options.value = normalizeRegionList(result)
      subnational2LoadedFor.value = normalizedSubnational1Code
    } catch (error) {
      if (requestId !== subnational2RequestId) {
        return
      }
      subnational2Options.value = []
      subnational2LoadedFor.value = ''
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load subregions.')
    } finally {
      if (requestId === subnational2RequestId) {
        subnational2Loading.value = false
      }
    }
  }

  async function countryQueryInput() {
    selectedCountry.value = null
    clearSubnational1Selection()
    clearSubnational2Selection()
    onRegionStateChange()
    clearErrorMessage()
    writeRegionCodeToUrl('')

    if (!form.countryQuery.trim()) {
      countrySuggestions.value = []
      return
    }

    await loadCountries()
    countrySuggestions.value = filterRegionList(countries.value, form.countryQuery)
  }

  async function subnational1QueryInput() {
    if (!selectedCountry.value) {
      subnational1Suggestions.value = []
      return
    }

    selectedSubnational1.value = null
    clearSubnational2Selection()
    onRegionStateChange()
    clearErrorMessage()
    writeRegionCodeToUrl(selectedCountry.value.code)

    if (!form.subnational1Query.trim()) {
      subnational1Suggestions.value = []
      return
    }

    await ensureSubnational1Loaded(selectedCountry.value.code)
    subnational1Suggestions.value = filterRegionList(subnational1Options.value, form.subnational1Query)
  }

  async function subnational2QueryInput() {
    if (!selectedSubnational1.value) {
      subnational2Suggestions.value = []
      return
    }

    selectedSubnational2.value = null
    onRegionStateChange()
    clearErrorMessage()
    writeRegionCodeToUrl(selectedSubnational1.value.code)

    if (!form.subnational2Query.trim()) {
      subnational2Suggestions.value = []
      return
    }

    await ensureSubnational2Loaded(selectedSubnational1.value.code)
    subnational2Suggestions.value = filterRegionList(subnational2Options.value, form.subnational2Query)
  }

  function selectCountry(region) {
    selectedCountry.value = region
    form.countryQuery = region.name
    countrySuggestions.value = []
    clearSubnational1Selection()
    clearSubnational2Selection()
    onRegionStateChange()
    clearErrorMessage()
    writeRegionCodeToUrl(region.code)
    void ensureSubnational1Loaded(region.code)
  }

  function selectSubnational1(region) {
    selectedSubnational1.value = region
    form.subnational1Query = region.name
    subnational1Suggestions.value = []
    clearSubnational2Selection()
    onRegionStateChange()
    clearErrorMessage()
    writeRegionCodeToUrl(region.code)
    void ensureSubnational2Loaded(region.code)
  }

  function selectSubnational2(region) {
    selectedSubnational2.value = region
    form.subnational2Query = region.name
    subnational2Suggestions.value = []
    onRegionStateChange()
    clearErrorMessage()
    writeRegionCodeToUrl(region.code)
  }

  function clearSubnational1Selection() {
    selectedSubnational1.value = null
    form.subnational1Query = ''
    subnational1Suggestions.value = []
    subnational1Options.value = []
    subnational1LoadedFor.value = ''
  }

  function clearSubnational2Selection() {
    selectedSubnational2.value = null
    form.subnational2Query = ''
    subnational2Suggestions.value = []
    subnational2Options.value = []
    subnational2LoadedFor.value = ''
  }

  function resetRegionSelectionState() {
    selectedCountry.value = null
    form.countryQuery = ''
    countrySuggestions.value = []
    clearSubnational1Selection()
    clearSubnational2Selection()
    onRegionStateChange()
  }

  function clearSelectedRegion() {
    resetRegionSelectionState()
    clearErrorMessage()
    writeRegionCodeToUrl('')
  }

  function clearCountrySuggestions() {
    setTimeout(() => {
      countrySuggestions.value = []
    }, 150)
  }

  function clearSubnational1Suggestions() {
    setTimeout(() => {
      subnational1Suggestions.value = []
    }, 150)
  }

  function clearSubnational2Suggestions() {
    setTimeout(() => {
      subnational2Suggestions.value = []
    }, 150)
  }

  async function restoreRegionSelectionFromCode(rawCode) {
    const code = asRegionCode(rawCode)
    if (!code) {
      return
    }

    const parts = code.split('-')
    const countryCode = parts[0]
    const country = countries.value.find((item) => item.code === countryCode)
    if (!country) {
      return
    }

    selectedCountry.value = country
    form.countryQuery = country.name

    if (parts.length < 2) {
      return
    }

    await ensureSubnational1Loaded(country.code)
    const subnational1Code = parts.slice(0, 2).join('-')
    const subnational1 = subnational1Options.value.find((item) => item.code === subnational1Code)
    if (!subnational1) {
      return
    }

    selectedSubnational1.value = subnational1
    form.subnational1Query = subnational1.name

    if (parts.length < 3) {
      return
    }

    await ensureSubnational2Loaded(subnational1.code)
    const subnational2 = subnational2Options.value.find((item) => item.code === code)
    if (!subnational2) {
      return
    }

    selectedSubnational2.value = subnational2
    form.subnational2Query = subnational2.name
  }

  return {
    form,
    selectedCountry,
    selectedSubnational1,
    selectedSubnational2,
    selectedRegionCode,
    selectedRegionName,
    countrySuggestions,
    subnational1Suggestions,
    subnational2Suggestions,
    countriesLoading,
    subnational1Loading,
    subnational2Loading,
    regionLookupBusy,
    hasAnyRegionInput,
    initializeRegionPicker,
    countryQueryInput,
    subnational1QueryInput,
    subnational2QueryInput,
    selectCountry,
    selectSubnational1,
    selectSubnational2,
    clearSelectedRegion,
    clearCountrySuggestions,
    clearSubnational1Suggestions,
    clearSubnational2Suggestions,
  }
}

function normalizeRegionList(items) {
  return (items || [])
    .map((item) => ({
      code: asRegionCode(item.code || ''),
      name: String(item.name || '').trim(),
    }))
    .filter((item) => item.code && item.name)
}

function filterRegionList(items, query) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return []
  }

  return items
    .filter((item) => item.name.toLowerCase().includes(normalizedQuery) || item.code.toLowerCase().includes(normalizedQuery))
    .slice(0, 12)
}

function readRegionCodeFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return asRegionCode(params.get(URL_REGION_KEY) || '')
}

function writeRegionCodeToUrl(code) {
  const url = new URL(window.location.href)
  const normalizedCode = asRegionCode(code)
  if (normalizedCode) {
    url.searchParams.set(URL_REGION_KEY, normalizedCode)
  } else {
    url.searchParams.delete(URL_REGION_KEY)
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState({}, '', nextUrl)
}

function asRegionCode(value) {
  const normalized = value.trim().toUpperCase()
  return REGION_CODE_PATTERN.test(normalized) ? normalized : ''
}
