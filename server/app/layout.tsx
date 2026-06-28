export const metadata = {
  title: "Claude Monitor — Local Server",
  description: "Local drop-in backend for the Claude Monitor extension",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Tell the Dark Reader extension to leave this page alone — it already
            uses a dark theme, and its DOM rewrites cause React hydration mismatches. */}
        <meta name="darkreader-lock" />
      </head>
      <body
        suppressHydrationWarning
        style={{
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          margin: 0,
          background: "#0b0d12",
          color: "#e5e7eb",
        }}
      >
        {children}
      </body>
    </html>
  );
}
