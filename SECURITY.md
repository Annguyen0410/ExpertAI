# Security and responsible-use notes

## Reporting

Do not include credentials or customer data in an issue. For a private
deployment, report a suspected vulnerability to the deployment owner through a
private channel and include reproduction steps, impact, and affected version.

## Security controls in the application

- Passwords are stored as bcrypt hashes.
- Access tokens include expiration and token-version invalidation.
- Role and object-level checks restrict queries, documents, feedback, and
  professional escalations to their owners or authorized roles.
- Request validation, rate limits, security headers, and restrictive CORS are
  applied at the API boundary.
- Uploads have type, signature, size, filename, and ownership checks before
  persistence or agent processing.
- Agent instructions and uploaded text are treated as untrusted input; risky
  actions are bounded and high-stakes requests are escalated.
- Operational logs should store only minimized, redacted data suitable for the
  intended retention policy.

## Deployment requirements

1. Use a secret manager; do not commit `.env` files or place credentials in
   Docker images.
2. Set a unique production `SECRET_KEY`, strict `CORS_ORIGINS`, and HTTPS at
   the edge.
3. Prefer managed Postgres, backups, monitoring, and an external rate-limit
   store for multi-instance deployments.
4. Rotate credentials after suspected exposure. The repository templates must
   contain blank values only.
5. Keep dependencies patched and run vulnerability scanning in CI.
6. Minimize access to document storage and enforce data-retention/deletion
   policies before storing real user documents.

## Important limits

No application-level safeguard makes an AI system a licensed professional or a
substitute for emergency care. Production owners remain responsible for legal,
privacy, clinical, financial, and regional compliance requirements.
