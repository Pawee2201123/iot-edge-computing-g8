from http.server import HTTPServer, BaseHTTPRequestHandler
import json

class TestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers['Content-Length'])
        data = self.rfile.read(length)
        print(f"\n[RECEIVED] {data.decode('utf-8')}")
        
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"OK")

print("Listening on 0.0.0.0:8000...")
HTTPServer(('0.0.0.0', 8000), TestHandler).serve_forever()
