/**
 * Query cache. Responses are persisted to AsyncStorage so the last-loaded news is shown offline and on
 * cold start; anything older than a day is dropped. 4xx errors are not retried; 5xx/network once.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { onlineManager, QueryClient } from '@tanstack/react-query'

import { ApiError } from './api/client'

const DAY = 24 * 60 * 60 * 1000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // matches the API's s-maxage=60
      gcTime: DAY,
      retry: (count, err) => count < 1 && (!(err instanceof ApiError) || err.isRetryable),
      retryDelay: 1_500,
      networkMode: 'offlineFirst',
    },
  },
})

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'loklens-query-cache-v1',
  throttleTime: 2_000,
})

export const PERSIST_MAX_AGE = DAY

/** Lets TanStack Query pause/resume requests with the device's connectivity. */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
)
