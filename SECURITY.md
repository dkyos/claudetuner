# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Claude Monitor, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please use [GitHub Security Advisories](https://github.com/chaehyun2/claudetuner/security/advisories/new) to report vulnerabilities privately.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Scope

The following are in scope:

- Extension source code (this repository)
- Data transmitted between the extension and the Claude Monitor API
- Authentication and authorization flows
- Cross-site scripting (XSS) in extension UI

The following are out of scope:

- The Claude Monitor cloud backend (upstream). This fork's local `server/` runs only on your own machine.
- Claude.ai itself
- Chrome Web Store infrastructure

### Response

We aim to acknowledge reports within 48 hours and provide a fix or mitigation plan within 7 days for critical issues.

## Supported Versions

Only the latest version published on the Chrome Web Store is supported with security updates.
