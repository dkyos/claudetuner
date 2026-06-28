// Centralized configuration for the Claude Monitor extension (classic script shared
// by content scripts + popup + options as the global CT_CONFIG).
//
// ⚙️ SERVER ADDRESS — to change host/port: edit DEFAULT_SERVER_URL + SITE_URL here
// AND in bg/constants.js (the service-worker copy), then start the server on the
// matching PORT. manifest host_permissions is "http://localhost/*" (port-agnostic),
// so a localhost port switch needs no manifest change.
const CT_CONFIG = {
  DEFAULT_SERVER_URL: 'http://localhost:3000',
  DEFAULT_API_KEY: 'claude-manager-dev-key-2024',
  SITE_URL: 'http://localhost:3000'
};
