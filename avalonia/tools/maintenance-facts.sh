#!/usr/bin/env bash
# A6: maintenance facts for FluentAvalonia and Avalonia.Controls.DataGrid, from the GitHub API and nuget.org.
# Run where `gh` is authenticated (GH_TOKEN), for example in CI. Usage: maintenance-facts.sh <outdir>
set -uo pipefail
out="$1"; mkdir -p "$out"; since=$(date -u -d '12 months ago' +%Y-%m-%dT%H:%M:%SZ)
for r in amwx/FluentAvalonia AvaloniaUI/Avalonia.Controls.DataGrid; do
  n=$(echo "$r" | tr '/' '_'); echo "=== $r (since $since)" | tee -a "$out/summary.txt"
  gh api "repos/$r" --jq '{full_name, archived, pushed_at, updated_at, open_issues_and_prs: .open_issues_count, stars: .stargazers_count, default_branch, html_url}' | tee -a "$out/summary.txt"
  echo "open issues (not PRs): $(gh api -X GET search/issues -f q="repo:$r is:issue is:open" --jq .total_count)" | tee -a "$out/summary.txt"
  echo "open PRs: $(gh api -X GET search/issues -f q="repo:$r is:pr is:open" --jq .total_count)" | tee -a "$out/summary.txt"
  echo "latest release (GitHub releases):" | tee -a "$out/summary.txt"
  gh api "repos/$r/releases?per_page=5" --jq '.[] | "\(.tag_name) \(.published_at) \(.html_url)"' | tee -a "$out/summary.txt"
  echo "latest tags:" | tee -a "$out/summary.txt"; gh api "repos/$r/tags?per_page=5" --jq '.[].name' | tee -a "$out/summary.txt"
  gh api --paginate "repos/$r/commits?since=$since&per_page=100" --jq '.[] | [.commit.committer.date, (.author.login // .commit.author.name), .commit.message[0:80]] | @tsv' > "$out/$n-commits.tsv"
  echo "last commit: $(head -1 "$out/$n-commits.tsv")" | tee -a "$out/summary.txt"
  echo "commits in last 12 months: $(wc -l < "$out/$n-commits.tsv")" | tee -a "$out/summary.txt"
  echo "committers in last 12 months (by commits):" | tee -a "$out/summary.txt"; cut -f2 "$out/$n-commits.tsv" | sort | uniq -c | sort -rn | tee -a "$out/summary.txt"
  # maintainer statements: recent comments and issues by the top committer
  top=$(cut -f2 "$out/$n-commits.tsv" | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')
  echo "top committer: $top; their 12 most recent issue/PR comments:" | tee -a "$out/summary.txt"
  gh api "repos/$r/issues/comments?since=$since&sort=updated&direction=desc&per_page=100" --jq ".[] | select(.user.login==\"$top\") | \"\(.created_at) \(.html_url) \(.body[0:240] | gsub(\"\\n\";\" \"))\"" | head -12 | tee -a "$out/summary.txt"
  echo "issues/discussions mentioning maintenance, support, future, abandoned, help wanted:" | tee -a "$out/summary.txt"
  gh api -X GET search/issues -f q="repo:$r maintain OR maintainer OR abandoned OR deprecated OR \"looking for\" in:title,body" -f sort=updated -f per_page=10 --jq '.items[] | "\(.updated_at) #\(.number) \(.state) \(.title) \(.html_url)"' | tee -a "$out/summary.txt"
done
for p in fluentavaloniaui avalonia.controls.datagrid; do
  echo "=== nuget $p" | tee -a "$out/summary.txt"
  curl -sS -H 'Accept-Encoding: gzip' "https://api.nuget.org/v3/registration5-gz-semver2/$p/index.json" | gunzip | python3 -c "
import json,sys,urllib.request,gzip
d=json.load(sys.stdin); items=[]
for pg in d['items']:
    if 'items' in pg: items+=pg['items']
    else:
        r=urllib.request.urlopen(urllib.request.Request(pg['@id'],headers={'Accept-Encoding':'gzip'})); b=r.read()
        try: b=gzip.decompress(b)
        except Exception: pass
        items+=json.loads(b)['items']
for i in items[-6:]:
    c=i['catalogEntry']; print(c['version'], c['published'][:10], 'DEPRECATED: '+json.dumps(c['deprecation']) if 'deprecation' in c else '')
" | tee -a "$out/summary.txt"
done
