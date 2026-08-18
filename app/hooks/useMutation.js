import useSWRMutation from "swr/mutation";

export function useMutation(key, fetcher, config) {
  return useSWRMutation(
    key,
    (_key, { arg }) => fetcher({ key: _key, arg }),
    config,
  );
}
