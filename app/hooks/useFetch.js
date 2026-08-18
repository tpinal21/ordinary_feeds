import useSWR from "swr";

export function useFetch(key, fetcher, config) {
  return useSWR(key, (_key) => fetcher({ key: _key }), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    ...config,
  });
}
