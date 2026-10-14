#!/bin/bash
# runset.sh <tag> <scenario...>; scenario = name:gl:dpr:throttle:heavy:zooms:holdms
export CLIENT_DIR=/workspace/.worktrees/fix/816-governor-slightly-slow-gpu/packages/client
tag=$1; shift
for sc in "$@"; do
  IFS=: read -r name gl dpr thr heavy zooms hold off <<<"$sc"
  out=res-$tag-$name.json
  echo "== $tag $name start $(date +%T) load $(cut -d' ' -f1-3 /proc/loadavg)"
  env ${heavy:+HEAVY=$heavy} ${off:+OFF=$off} ZOOMS=$zooms HOLD_MS=$hold SAVE=feed-$tag-$name.json timeout 900 node probe816.cjs $gl $dpr $thr 4502 > $out 2> err-$tag-$name.log
  echo "   exit $? $(date +%T)"
  python3 -c "
import json,sys
d=json.load(open('$out'))
print('   load',d['loadStart'],d.get('loadAfterFall'),d['loadEnd'],'loadToPlay',d.get('loadToPlayS'),'fallS',d.get('fallS'))
for k,v in (d.get('fall') or {}).items(): print('   fall',k,v)
for h in d['holds']: print('   hold',h)
" 2>&1
done
