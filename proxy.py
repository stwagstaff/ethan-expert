"""
EthanExpert API Proxy
Runs locally on port 8888, relays requests to Anthropic with CORS headers.
Start with: python proxy.py
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request, urllib.error, json, sys

PORT = 8888
ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

class ProxyHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        print(f'[proxy] {args[0]} {args[1]}')

    def send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers',
            'Content-Type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-calls')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors()
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body   = self.rfile.read(length)

        # Forward to Anthropic
        req = urllib.request.Request(
            ANTHROPIC_URL,
            data=body,
            headers={
                'Content-Type':       'application/json',
                'x-api-key':          self.headers.get('x-api-key', ''),
                'anthropic-version':  self.headers.get('anthropic-version', '2023-06-01'),
            },
            method='POST'
        )

        try:
            with urllib.request.urlopen(req) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self.send_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            data = e.read()
            self.send_response(e.code)
            self.send_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_response(500)
            self.send_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

if __name__ == '__main__':
    server = HTTPServer(('localhost', PORT), ProxyHandler)
    print(f'EthanExpert proxy running on http://localhost:{PORT}')
    print('Keep this window open while using EthanExpert.')
    print('Press Ctrl+C to stop.\n')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nProxy stopped.')
