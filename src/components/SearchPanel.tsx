import type { SearchResult } from "../types/agent";

/**
 * @GOV
 * codes: BR-SYS-UI-001
 * type: RB
 * chain: WS-SEARCH
 * rules: BR-SYS-UI-001
 * boundary: in=search query string and SearchResult list from FTS5 search index | out=SearchPanel with file path and snippet results
 * term_ref: TERM-WS-005
 */

interface SearchPanelProps {
  query: string;
  onQueryChange: (q: string) => void;
  results: SearchResult[];
  onResultClick: (filePath: string) => void;
}

export function SearchPanel({ query, onQueryChange, results, onResultClick }: SearchPanelProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "8px 12px",
        gap: 8,
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="搜索文件内容…"
        style={{
          width: "100%",
          padding: "5px 8px",
          fontSize: 12,
        }}
      />
      {query.trim() !== "" && (
        <div style={{ maxHeight: 200, overflowY: "auto" }}>
          {results.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 12, padding: "4px 0" }}>
              无匹配结果
            </p>
          ) : (
            results.map((r) => (
              <button
                key={r.filePath}
                onClick={() => onResultClick(r.filePath)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "4px 6px",
                  borderRadius: 3,
                  fontSize: 12,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "none";
                }}
              >
                <div style={{ color: "var(--text-primary)" }}>{r.filePath}</div>
                <div
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: 11,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.preview}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
