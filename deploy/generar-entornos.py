# Genera los entornos de la pila desde ~/.config/lab: rest.env, ladder-lab.env y sens-lab.env.
# Uso: generar-entornos.py <archivo-uri-duenio> <archivo-clave-authenticator>
import base64,hashlib,hmac,json,os,sys,time
from urllib.parse import urlsplit
os.umask(0o077)  # los archivos llevan secretos: 600 sin importar la sesión
L=os.path.expanduser("~/.config/lab")
sec=json.load(open(L+"/secretos.json"))
uri=open(sys.argv[1]).read().strip(); apw=open(sys.argv[2]).read().strip()
host=urlsplit(uri).hostname; db=urlsplit(uri).path.lstrip("/")
b=lambda x:base64.urlsafe_b64encode(x).rstrip(b"=").decode()
now=int(time.time())
h=b(json.dumps({"alg":"HS256","typ":"JWT"},separators=(",",":")).encode())
p=b(json.dumps({"role":"service_role","iat":now,"exp":now+20*365*86400},separators=(",",":")).encode())
sig=b(hmac.new(sec["jwt"].encode(),f"{h}.{p}".encode(),hashlib.sha256).digest())
key=f"{h}.{p}.{sig}"
open(L+"/rest.env","w").write(f"PGRST_DB_URI=postgres://authenticator:{apw}@{host}/{db}?sslmode=require\nPGRST_JWT_SECRET={sec['jwt']}\n")
open(L+"/ladder-lab.env","w").write(f"MCP_TRANSPORT=http\nMCP_AUTH_TOKEN={sec['mcp']}\nSUPABASE_URL=http://lab-proxy:8080\nSUPABASE_SERVICE_KEY={key}\nLOG_LEVEL=info\n")
open(L+"/sens-lab.env","w").write(f"SUPABASE_URL=http://lab-proxy:8080\nSUPABASE_SERVICE_ROLE_KEY={key}\nCANDIDATAS_BACKEND=supabase\n")
open(L+"/service-key","w").write(key)
print("env generados para host", host.split(".")[0])
