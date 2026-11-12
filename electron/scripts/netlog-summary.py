import json,sys
raw=open(sys.argv[1]).read()
try: d=json.loads(raw)
except Exception: d=json.loads(raw.rstrip().rstrip(',')+']}')
inv={v:k for k,v in d['constants']['logEventTypes'].items()}
urls=set();probe=0;udp=[]
for e in d['events']:
    t=inv.get(e['type'],'')
    pr=e.get('params') or {}
    if t=='REQUEST_ALIVE' and 'url' in pr: urls.add(pr['url'])
    if t=='HOST_RESOLVER_MANAGER_IPV6_REACHABILITY_CHECK': probe+=1
    if t=='HOST_RESOLVER_MANAGER_REQUEST' and 'host' in pr: urls.add('RESOLVE '+str(pr['host']))
print(sys.argv[2],'| urls:',sorted(urls) or '-','| ipv6 probe events:',probe)
