export function useEbirdApi({ apiToken }) {
  async function ebirdGet(path) {
    const response = await fetch(`https://api.ebird.org/v2${path}`, {
      headers: {
        'X-eBirdApiToken': apiToken.value.trim(),
      },
    })

    if (!response.ok) {
      throw new Error(`eBird request failed (${response.status})`)
    }

    return response.json()
  }

  return {
    ebirdGet,
  }
}
