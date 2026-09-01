<div align='center'>
    <h1>shim 2.0</h1>
    <h3>by Yolkbot and Flowaway-Goldenbody</h3>
</div>

<br><br>

## live demo
navigate to https://define.mathvariables.xyz/learn.html to play shell with sfc. The best hax of shell shockers made by the (** hated by harrison, a BLUE WIZARD DIGITAL INC. dev) statefarm client dev team.
## about
shim is a copy of shell shockers that proxies all requests (** including websockets not just using an alt link of shell!) and allows for userscript injection. it works on any device, even chromebooks with locked-down extensions and devtools disabled.

(** note: it also has a guard to prevent lightspeed filter agent to immediately navigate to block page because it will be detected as a proxy! click cancel for all the "Leave Site? Changes may not be saved!" dialogs, [ DO NOT CLICK PREVENT THIS SITE FROM ADDING ADDITIONAL DIALOGS AS THIS WILL BLOCK THE PAGE!!! ])

shim functions as a copy of normal shell shockers, but when you visit the `/inject` page, you can inject userscripts that will run on the main game page. shim supports all tampermonkey userscripts to the best of its ability. (** it didnt support all userscript apis)

## From Flowaway-Goldenbody:
I also fixed the broken websocket patch for shell shockers. onlypuppy7 wrote the original one but its not working at my end.
<br>

## setup
1. install [bun](https://bun.sh/) (node also supported)
2. clone this repo
3. run `bun install`
4. run `bun .`
5. install "node js" for ws proxy. (node js is together plz dont install node and js)
6. run node src/wsproxy.js
7. configure statefarmclient at http://localhost:6602/inject
8. play at http://localhost:6602/

<br><br>
<h5 align='center'>Special thx for villainsrule for the shim repo</h5>