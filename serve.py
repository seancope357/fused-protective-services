#!/usr/bin/env python3
"""
Simple local preview server for Fused Protective Services website.
Supports clean URL routing (/careers, /invoice) and local API ingestion (/api/intake).

It also sends production's security headers, read out of vercel.json rather
than restated here (SPEC-006). A CSP that exists only in production is a CSP
you debug in production, and a second hand-maintained copy of the policy in
this file would be wrong the first time a script hash changed — which happens
whenever anyone edits src/data/. One generated source of truth, two servers.
"""
import http.server
import socketserver
import os
import json
import random
import subprocess

# 5050 unless told otherwise. The override exists because more than one
# checkout of this repository can be alive on one machine — a worktree per
# person or per agent — and the second `python3 serve.py` would otherwise die
# on EADDRINUSE while appearing to succeed to anyone who only reads the URL.
# CI does not set it, so CI still gets 5050 and .github/workflows/ci.yml needs
# no coordination with this file.
PORT = int(os.environ.get('FPS_PREVIEW_PORT', '5050'))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


def production_headers():
    """The header list vercel.json applies to every path.

    Deliberately strict about shape: if the file is missing, unparseable or no
    longer carries a catch-all rule, say so and stop. Serving the site with
    the headers silently absent would make a local sweep report a clean policy
    that production does not have, which is worse than not serving at all.
    """
    path = os.path.join(DIRECTORY, 'vercel.json')
    try:
        with open(path, encoding='utf-8') as fh:
            config = json.load(fh)
    except FileNotFoundError:
        raise SystemExit(
            "vercel.json is missing. It is generated — run `node build.mjs`."
        )
    except json.JSONDecodeError as exc:
        raise SystemExit(f"vercel.json is not valid JSON ({exc}).")

    for rule in config.get('headers', []):
        if rule.get('source') == '/(.*)':
            pairs = [(h['key'], h['value']) for h in rule.get('headers', [])]
            if not pairs:
                raise SystemExit("vercel.json's catch-all rule carries no headers.")
            return pairs

    raise SystemExit(
        "vercel.json has no '/(.*)' header rule, so the preview server has no\n"
        "policy to mirror. Run `node build.mjs` and check build.mjs's vercelConfig()."
    )


HEADERS = production_headers()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def translate_path(self, path):
        if path == '/careers':
            path = '/careers.html'
        elif path == '/invoice':
            path = '/invoice.html'
        elif path in ('/privacy', '/terms', '/sms-consent'):
            path = f"{path}.html"
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # Every response, including the /api/intake ones, because Vercel's
        # rule is '/(.*)' and matches the functions too.
        #
        # Strict-Transport-Security is sent here as well even though it does
        # nothing over http://localhost: RFC 6797 §8.1 requires a user agent to
        # IGNORE an STS header that did not arrive over a secure transport, so
        # it cannot poison a developer's other local sites. Sending it keeps
        # this list literally equal to production's, which is the point.
        for key, value in HEADERS:
            self.send_header(key, value)
        super().end_headers()

    def do_OPTIONS(self):
        # Same-origin only, like the production functions.
        self.send_response(204)
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/intake':
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)
            try:
                data = json.loads(body_bytes.decode('utf-8'))
            except Exception:
                data = {}

            is_candidate = bool(data.get('appPosition') or data.get('positionId') or data.get('type') == 'candidate')
            ref_code = data.get('refCode') or (
                f"TX-CAND-{random.randint(1000, 9999)}" if is_candidate else f"TX-FPS-{random.randint(1000, 9999)}"
            )

            # Persist to local PostgreSQL. Values travel as psql variables, never
            # by string interpolation, and a failed insert is reported as a
            # failure — the preview server does not fake a delivery either.
            if is_candidate:
                fields = {
                    'ref_code': ref_code,
                    'position_id': data.get('appPosition') or 'general-roster',
                    'license_level': data.get('appLicenseLevel') or 'unspecified',
                    'full_name': data.get('appFullName') or 'Anonymous Candidate',
                    'phone': data.get('appPhone') or '',
                    'email': data.get('appEmail') or '',
                    'tops_number': data.get('appLicenseNumber') or '',
                    'service_branch': data.get('appServiceBranch') or 'civilian',
                    'bio': data.get('appBio') or ''
                }
                table = 'candidate_applications'
            else:
                fields = {
                    'ref_code': ref_code,
                    'full_name': data.get('formName') or 'Anonymous Client',
                    'company': data.get('formCompany') or '',
                    'phone': data.get('formPhone') or '',
                    'email': data.get('formEmail') or '',
                    'service_division': data.get('formDivision') or '',
                    'armed_preference': data.get('formArmedPreference') or '',
                    'deployment_location': data.get('formLocation') or '',
                    'schedule': data.get('formSchedule') or '',
                    'notes': data.get('formNotes') or ''
                }
                table = 'client_quotes'

            columns = ', '.join(fields)
            values = ', '.join(f":'{k}'" for k in fields)
            args = ['psql', '-d', 'fused_protective_services', '-q', '-X']
            for k, v in fields.items():
                args += ['-v', f'{k}={v}']
            args += ['-c', f'INSERT INTO {table} ({columns}) VALUES ({values});']
            persisted = False
            try:
                result = subprocess.run(args, check=False, capture_output=True, text=True)
                persisted = result.returncode == 0
                if not persisted:
                    print(f"[Local Intake] DB insert failed: {result.stderr.strip()}")
            except Exception as e:
                print(f"[Local Intake] DB insert failed ({e})")

            if not persisted:
                res_body = json.dumps({
                    "ok": False,
                    "refCode": ref_code,
                    "error": "not_delivered",
                    "message": "Local database write failed; nothing was recorded. See the serve.py console."
                }).encode('utf-8')
                self.send_response(503)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(res_body)))
                self.end_headers()
                self.wfile.write(res_body)
                return

            is_emergency = not is_candidate and (
                'Emergency' in str(data.get('formDivision')) or
                'Level IV PPO' in str(data.get('formDivision')) or
                'urgent' in str(data.get('formNotes', '')).lower()
            )

            res_body = json.dumps({
                "ok": True,
                "type": "candidate" if is_candidate else "quote",
                "refCode": ref_code,
                "priority": "emergency" if is_emergency else "standard",
                "message": (
                    "Candidate application received and logged for command review."
                    if is_candidate else
                    f"Request received — dispatch reference {ref_code}. A commanding officer will contact {data.get('formPhone', 'you')} within {'45 minutes' if is_emergency else '2 hours'}."
                )
            }).encode('utf-8')

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(res_body)))
            self.end_headers()
            self.wfile.write(res_body)
            return

        if self.path == '/api/stripe-checkout':
            # No mock links, locally or anywhere. The real function needs a
            # Stripe key and a stored invoice; run `vercel dev` to exercise it.
            res_body = json.dumps({
                "ok": False,
                "error": "payments_not_configured",
                "message": "Online payment is not available from the local preview server."
            }).encode('utf-8')

            self.send_response(503)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(res_body)))
            self.end_headers()
            self.wfile.write(res_body)
            return

        self.send_response(404)
        self.end_headers()

class PreviewServer(socketserver.ThreadingTCPServer):
    """Threaded on purpose.

    A single-threaded TCPServer serves one connection at a time, so a browser
    that holds a socket open — which every modern one does — can stall the
    next request behind it. That is invisible while you click around by hand
    and is exactly what makes an automated pass over the six pages flaky: a
    page load times out, the scan reports a page it never saw, and the result
    is a green check for work that was not done.
    """
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with PreviewServer(("", PORT), Handler) as httpd:
        print(f"\n=======================================================")
        print(f"  🛡️ Fused Protective Services Preview Live at:")
        print(f"  👉 http://localhost:{PORT}")
        print(f"  📡 Local API Ingestion: http://localhost:{PORT}/api/intake")
        print(f"  🔒 Sending {len(HEADERS)} production headers from vercel.json,")
        print(f"     Content-Security-Policy enforcing. Violations appear in")
        print(f"     the browser console, which is where they are supposed to")
        print(f"     be found — not in production.")
        print(f"=======================================================\n")
        httpd.serve_forever()
