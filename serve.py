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
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
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

            # Persist to local PostgreSQL if available
            try:
                if is_candidate:
                    pos = (data.get('appPosition') or '').replace("'", "''")
                    lic = (data.get('appLicenseLevel') or '').replace("'", "''")
                    name = (data.get('appFullName') or '').replace("'", "''")
                    phone = (data.get('appPhone') or '').replace("'", "''")
                    email = (data.get('appEmail') or '').replace("'", "''")
                    tops = (data.get('appLicenseNumber') or '').replace("'", "''")
                    branch = (data.get('appServiceBranch') or '').replace("'", "''")
                    bio = (data.get('appBio') or '').replace("'", "''")
                    subprocess.run([
                        'psql', '-d', 'fused_protective_services', '-c',
                        f"INSERT INTO candidate_applications (ref_code, position_id, license_level, full_name, phone, email, tops_number, service_branch, bio) "
                        f"VALUES ('{ref_code}', '{pos}', '{lic}', '{name}', '{phone}', '{email}', '{tops}', '{branch}', '{bio}');"
                    ], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    name = (data.get('formName') or '').replace("'", "''")
                    comp = (data.get('formCompany') or '').replace("'", "''")
                    phone = (data.get('formPhone') or '').replace("'", "''")
                    email = (data.get('formEmail') or '').replace("'", "''")
                    div = (data.get('formDivision') or '').replace("'", "''")
                    armed = (data.get('formArmedPreference') or '').replace("'", "''")
                    loc = (data.get('formLocation') or '').replace("'", "''")
                    sched = (data.get('formSchedule') or '').replace("'", "''")
                    notes = (data.get('formNotes') or '').replace("'", "''")
                    subprocess.run([
                        'psql', '-d', 'fused_protective_services', '-c',
                        f"INSERT INTO client_quotes (ref_code, full_name, company, phone, email, service_division, armed_preference, deployment_location, schedule, notes) "
                        f"VALUES ('{ref_code}', '{name}', '{comp}', '{phone}', '{email}', '{div}', '{armed}', '{loc}', '{sched}', '{notes}');"
                    ], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception as e:
                print(f"[Local Intake] Note: DB insert skipped ({e})")

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
            self.send_header('Access-Control-Allow-Origin', '*')
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
