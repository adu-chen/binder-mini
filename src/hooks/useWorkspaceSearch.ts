import { useState, useRef } from "react";
import { searchFiles } from "../ipc";
import type { SearchResult } from "../types/agent";

/**
 * @GOV
 * codes: BR-WS-DATA-005
 * type: RB
 * chain: WS-SEARCH
 * rules: BR-WS-DATA-005
 * boundary: in=workspace search query string from SearchPanel and workspaceMachine Active state | out=SearchResult list from SearchIndex FTS5 via search_files IPC, with debounce and stale-on-mutation reset
 * term_ref: TERM-CORE-001, TERM-WS-005, TERM-WS-006
 */

/**
 * Encapsulates debounced FTS5 search against the active Workspace.
 *
 * Rules:
 * - BR-WS-DATA-005: SearchIndex is workspace-scoped; results only returned for non-empty queries
 * - debounce: 300ms after the last keystroke
 * - stale invalidation: call clearSearchResults() after any file mutation (create/rename/delete)
 * - non-Active state guard: caller must pass isActive=false to suppress IPC when not in Active state
 */
export function useWorkspaceSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchQueryChange(
    query: string,
    workspaceRoot: string | null,
    isActive: boolean,
  ): void {
    setSearchQuery(query);

    // Clear any pending debounced call
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    // Empty query or non-Active state → clear results immediately, no IPC
    if (!query.trim() || !workspaceRoot || !isActive) {
      setSearchResults([]);
      return;
    }

    const capturedRoot = workspaceRoot;
    const capturedQuery = query.trim();

    debounceRef.current = setTimeout(() => {
      void searchFiles(capturedRoot, capturedQuery)
        .then((results) => setSearchResults(results))
        .catch(() => setSearchResults([]));
    }, 300);
  }

  /** Call after file mutations (create/rename/delete) to invalidate stale results. */
  function clearSearchResults(): void {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSearchResults([]);
  }

  return {
    searchQuery,
    searchResults,
    handleSearchQueryChange,
    clearSearchResults,
  };
}
