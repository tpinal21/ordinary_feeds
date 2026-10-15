import { useFetch } from "app/hooks/useFetch";
import { apiFetch } from "app/lib/api-client";
import { GALLERIES_KEY } from "app/lib/feeds";

// The gallery list backs both the picker and the preview, and SWR dedupes on
// the key, so components can each ask for it instead of drilling it down.
export function useGalleries() {
  const { data, isLoading } = useFetch(
    GALLERIES_KEY,
    ({ key }) => apiFetch(key),
    { revalidateIfStale: false },
  );

  return { galleries: data?.data, isLoading };
}
