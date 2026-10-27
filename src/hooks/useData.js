/*
 * Data-loading hooks that talk to the API:
 *   useDebounce  - wait until the user stops typing
 *   useFetch     - load one resource
 *   usePaginated - load one page of a list and move between pages
 *   useOptions   - load a list as dropdown options
 * Each loader returns loading / error values and a reload() function.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { parseError } from "../utils/errors";

// Drop empty filters ("", null, undefined) so they are not sent as ?search=&....
const clean = (obj) =>
  Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined));

/** Debounce a fast-changing value such as a search box. */
// Without this, every key press in a search box would call the API.
export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** GET a single (non-paginated) resource. Re-fetches when `params` change. */
export function useFetch(url, params, enabled = true) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  // tick is a counter. Changing it re-runs the effect below, which is how reload() works.
  const [tick, setTick] = useState(0);
  // params as text. An object is new on every render, but this text only changes when a filter
  // really changes, so it is safe in the effect's dependency list.
  const key = JSON.stringify(clean(params));

  useEffect(() => {
    // enabled=false lets a page wait (for example until a class is chosen) before loading.
    if (!enabled) return undefined;
    // `cancelled` stops an old, slow answer from overwriting a newer one after the inputs changed.
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .get(url, { params: JSON.parse(key) })
      .then(({ data }) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((e) => !cancelled && setState((s) => ({ ...s, loading: false, error: parseError(e).message })));
    return () => {
      cancelled = true;
    };
  }, [url, key, enabled, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

/** GET a paginated list endpoint with page state. Going back to page 1 whenever filters change. */
// The server answers { count, results }. rows = this page, count = rows in total.
export function usePaginated(url, filters, pageSize = 20) {
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ rows: [], count: 0, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(clean(filters));

  // A new search or filter makes the old page number meaningless, so go back to page 1.
  useEffect(() => setPage(1), [key]);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .get(url, { params: { ...JSON.parse(key), page, page_size: pageSize } })
      .then(({ data }) => !cancelled && setState({ rows: data.results, count: data.count, loading: false, error: null }))
      .catch((e) => !cancelled && setState((s) => ({ ...s, loading: false, error: parseError(e).message })));
    return () => {
      cancelled = true;
    };
  }, [url, key, page, pageSize, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, page, setPage, pageSize, reload };
}

/** Load up to 200 rows of a list endpoint as <select> options. */
// toOption turns one row into { value, label }. The options list is memoised so dropdowns stay stable.
export function useOptions(url, toOption, params, enabled = true) {
  const { data, loading } = useFetch(url, { page_size: 200, ...params }, enabled);
  const options = useMemo(() => (data?.results || []).map(toOption), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  return { options, loading, rows: data?.results || [] };
}
