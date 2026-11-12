import json,sys
def J(p): return json.loads(open(p,encoding="utf-8-sig",newline="").read().replace("\r",""))
for o in sys.argv[2:]:
  for c in ["c0","c1","c2","c3"]:
    d=f"{sys.argv[1]}/{o}-{c}/bench"
    try:
      s=[J(d+f"/scroll{i}.json") for i in (1,2)]
      raw=open(d+"/sorts.jsonl",encoding="utf-8-sig",newline="").read().replace("\r","").replace("\n",""); sorts=[json.loads("{"+p+"}") for p in raw.split("}{") if p] if False else [json.loads(x+"}") for x in raw.replace("}{","}|{").split("|") for x in [x.rstrip("}")]]
    except Exception as e: print(o,c,"ERR",e); continue
    print(o,c,"scroll worst/p99/median/>100ms:",[(x["worstFrameMs"],x["p99FrameMs"],x["medianFrameMs"],x["over100ms"]) for x in s],"| sorts(10): max compute",max(x["computeAndAssignMs"] for x in sorts),"max to-frame",max(x["toRenderedFrameMs"] for x in sorts),"|",open(d+"/coldstart.txt").read().strip())
