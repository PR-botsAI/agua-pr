# H2O PR + official OVHcloud MCP

Preferred infrastructure-control path for H2O PR V2.

## Official MCP endpoints

Use the endpoint matching the OVHcloud account/region:

- EU: `https://mcp.eu.ovhcloud.com/mcp`
- US: `https://mcp.us.ovhcloud.com/mcp`
- CA: `https://mcp.ca.ovhcloud.com/mcp`

Transport: Streamable HTTP
Authentication: OAuth2 / OVHcloud IAM
Custom headers: none required for manual configuration

Official documentation: https://www.ovhcloud.com/en/public-cloud/mcp-server/
Official MCP Hub: https://mcp.eu.ovhcloud.com/

## Why we use the official MCP

OVHcloud hosts it. H2O PR does not need to run or patch a third-party MCP server and no long-lived OVH API token should be committed to this repository. OAuth2 and OVHcloud IAM allow the infrastructure permissions granted to the AI client to be constrained.

## Initial permissions for H2O PR

Start with the minimum permissions required to inspect and deploy the API. Do not grant broad account administration unless needed.

Required initially:

1. Inspect Public Cloud projects and compute instances.
2. Inspect instance public/private networking.
3. Inspect security groups/firewall configuration.
4. Inspect and manage the H2O PR compute instance selected for deployment.
5. Inspect container/registry resources if H2O PR uses an OVH registry.
6. Inspect DNS/network resources relevant to `api.h20pr.com` if available through the connected account.

Do not initially grant destructive permissions for unrelated infrastructure.

## Deployment target

The V2 API image is produced by GitHub CI as:

`ghcr.io/pr-botsai/agua-pr-api:v2-edge`

The OVH server will run the image behind Caddy using `deploy/ovh/compose.yaml` and `deploy/ovh/Caddyfile`.

Target public API:

`https://api.h20pr.com/api/v1/health`

## Safe deployment sequence

1. Use the OVHcloud MCP to list the user's projects/instances.
2. Identify the intended H2O PR production instance; do not create a new billable server unless the user explicitly approves it.
3. Inspect OS, public IP, status, firewall/security group, CPU/RAM and available storage.
4. Confirm TCP 80/443 can reach the intended server and SSH/admin access remains constrained.
5. Point only the `api.h20pr.com` DNS record to the production server. Do not alter the existing `h20pr.com` GitHub Pages records during staging.
6. Deploy `deploy/ovh/compose.yaml` and `deploy/ovh/Caddyfile` to the server and start the stack.
7. Verify `/api/v1/health`, `/api/v1/reservoirs/aaa`, `/api/v1/prepa`, and one municipality/rationing query.
8. Verify HTTPS and CORS from `https://h20pr.com`.
9. Only then switch the public frontend from GitHub-generated JSON to `https://api.h20pr.com`.
10. Keep the static GitHub data bridge available as an emergency fallback until V2 has proven stable.

## ChatGPT custom MCP app

If the ChatGPT workspace supports custom remote MCP apps, add the OVH endpoint directly as a custom app and complete OVHcloud OAuth in the browser. Scan the tools, review the write actions, and keep destructive actions disabled unless they are explicitly needed.

This repository never stores the user's OVHcloud login, OAuth tokens, API secrets, SSH private keys, or passwords.
