#!/usr/bin/env python3
"""
Simple local preview server for Fused Protective Services website.
Supports clean URL routing (/careers, /invoice) and local API ingestion (/api/intake).
"""
import http.server
import socketserver
import os
import json
import random
import subprocess

PORT = 5050
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

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

if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"\n=======================================================")
        print(f"  🛡️ Fused Protective Services Preview Live at:")
        print(f"  👉 http://localhost:{PORT}")
        print(f"  📡 Local API Ingestion: http://localhost:{PORT}/api/intake")
        print(f"=======================================================\n")
        httpd.serve_forever()
