// Path breadcrumb: [대시보드] › [Claude Code] › [현재]. Each non-last item is a
// link (back-navigation); the last item is the current page (no link).
export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav
      style={{
        fontSize: 13,
        marginBottom: 14,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
            {i > 0 && (
              <span style={{ color: "#4b5563", margin: "0 8px" }}>›</span>
            )}
            {it.href && !last ? (
              <a
                href={it.href}
                style={{ color: "#7dd3fc", textDecoration: "none" }}
              >
                {it.label}
              </a>
            ) : (
              <span
                style={{
                  color: last ? "#e5e7eb" : "#9ca3af",
                  fontWeight: last ? 600 : 400,
                  maxWidth: 360,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {it.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
