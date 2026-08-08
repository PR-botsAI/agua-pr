# H2O PR — OVH VPS production setup

The OVH MCP connector is not required. Production deployment uses GitHub Actions over SSH.

## Architecture

- `h20pr.com`: existing public frontend
- `api.h20pr.com`: OVH VPS, Caddy HTTPS reverse proxy
- API container: `ghcr.io/pr-botsai/agua-pr-api:v2-edge`
- Deployment: `.github/workflows/deploy-ovh.yml`

## 1. Collect VPS information from OVH

Open OVHcloud Manager → Bare Metal Cloud → Virtual Private Servers → your VPS.

Record:

- public IPv4 address
- operating system / distribution
- SSH username (commonly `ubuntu`, `debian`, or an administrator account)
- SSH port (normally `22`)

Do not put passwords or private SSH keys into the repository.

## 2. Create a dedicated deployment SSH key on your Windows PC

Open **Windows Terminal** or **Command Prompt** and run:

```powershell
ssh-keygen -t ed25519 -C "h2opr-github-deploy" -f %USERPROFILE%\.ssh\h2opr_ovh_deploy
```

When asked for a passphrase, a GitHub Actions deployment key normally needs to be non-interactive. Use a dedicated key that is only authorized on the H2O PR VPS and protect the GitHub repository accordingly.

This creates:

- private key: `%USERPROFILE%\.ssh\h2opr_ovh_deploy`
- public key: `%USERPROFILE%\.ssh\h2opr_ovh_deploy.pub`

Never paste the private key into chat.

## 3. Add the public key to the VPS

Display the public key:

```powershell
type %USERPROFILE%\.ssh\h2opr_ovh_deploy.pub
```

Add that one-line public key to the deployment user's `~/.ssh/authorized_keys` on the VPS.

Test from Windows before configuring GitHub:

```powershell
ssh -i %USERPROFILE%\.ssh\h2opr_ovh_deploy USER@VPS_IP
```

Replace `USER` and `VPS_IP` with the real values.

## 4. Install Docker on the VPS if needed

First check:

```bash
docker --version
docker compose version
```

If both commands work, continue.

For Ubuntu/Debian, Docker's official installation instructions are preferred. After installation, ensure the deployment user can run Docker without an interactive password. One common setup is:

```bash
sudo usermod -aG docker "$USER"
```

Then log out and reconnect before testing `docker ps`.

## 5. Add GitHub repository secrets

Open:

`PR-botsAI/agua-pr` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Create:

### `OVH_HOST`
The VPS public IPv4 address.

### `OVH_USER`
The SSH username used in step 3.

### `OVH_PORT`
Normally:

```text
22
```

### `OVH_SSH_KEY`
Open the private deployment key on your own PC:

```powershell
type %USERPROFILE%\.ssh\h2opr_ovh_deploy
```

Copy the complete private key, including the BEGIN/END lines, directly into the GitHub secret. Do not put it into any repository file or chat message.

### `GHCR_USER` (only if the container package is private)

```text
PR-botsAI
```

### `GHCR_TOKEN` (only if the container package is private)
A GitHub token with read access to the GHCR package. If the image is public, leave both GHCR secrets unset.

## 6. Create DNS for the API

At the DNS provider currently authoritative for `h20pr.com`, add:

```text
Type: A
Name: api
Value: VPS_PUBLIC_IPV4
TTL: 300 or provider default
```

Do **not** change the existing `@` or `www` records used by the public site.

Verify from Windows:

```powershell
nslookup api.h20pr.com 1.1.1.1
```

It must resolve to the OVH VPS IP before Caddy can reliably obtain the TLS certificate.

## 7. Make sure ports are reachable

The VPS/network firewall must allow inbound:

- TCP 22 from the administrator/deployment path
- TCP 80 from the internet
- TCP 443 from the internet
- UDP 443 is optional for HTTP/3

The API container itself is not published directly; Caddy is the public entry point.

## 8. Run the GitHub deployment

Open:

`PR-botsAI/agua-pr` → **Actions** → **Deploy H2O PR API to OVH VPS** → **Run workflow**

Use image tag:

```text
v2-edge
```

The workflow will:

1. connect to the VPS using the deployment key;
2. verify Docker and Docker Compose;
3. copy `compose.yaml` and `Caddyfile`;
4. pull the H2O PR API container;
5. start/restart the API and Caddy;
6. check `https://api.h20pr.com/api/v1/health` from outside the VPS.

## 9. Production verification

These must return successfully:

```text
https://api.h20pr.com/api/v1/health
https://api.h20pr.com/api/v1/reservoirs/aaa
https://api.h20pr.com/api/v1/prepa
https://api.h20pr.com/api/v1/municipalities
```

Only after those checks pass should the public frontend switch its primary live-data source from the temporary GitHub JSON bridge to `api.h20pr.com`.

## Security rules

- Never store the SSH private key in Git.
- Never paste the SSH private key into ChatGPT.
- Use a dedicated deployment key, not a personal all-purpose key.
- Do not expose port 8080 publicly.
- Do not change `h20pr.com` / `www.h20pr.com` DNS while staging the API.
- Keep the GitHub static-data bridge until the OVH API has proven stable.
