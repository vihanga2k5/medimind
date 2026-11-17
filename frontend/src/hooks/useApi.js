import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../services/api'

// Loads a GET endpoint and reloads whenever the path or refresh value changes.
export function useApi(path, refresh = 0) {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState({ key: null, body: null, error: '' })
  const key = path ? `${path}#${version}#${refresh}` : null

  useEffect(() => {
    if (!path) return
    let active = true
    const requestKey = `${path}#${version}#${refresh}`
    apiRequest(path)
      .then(body => { if (active) setState({ key: requestKey, body, error: '' }) })
      .catch(error => { if (active) setState(previous => ({ key: requestKey, body: previous.body, error: error.message })) })
    return () => { active = false }
  }, [path, version, refresh])

  const reload = useCallback(() => setVersion(value => value + 1), [])
  return { body: state.body, data: state.body?.data, error: state.error, loading: Boolean(key) && state.key !== key, reload }
}
