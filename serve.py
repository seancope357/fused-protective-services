#!/usr/bin/env python3
"""
Simple local server to preview Fused Protective Services website.
"""
import http.server
import socketserver
import os
import webbrowser

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

if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"\n=======================================================")
        print(f"  🛡️ Fused Protective Services Preview Live at:")
        print(f"  👉 http://localhost:{PORT}")
        print(f"=======================================================\n")
        httpd.serve_forever()
