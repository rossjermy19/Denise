import express from "express";
import cors from "cors";
import crypto from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";

const PORT = process.env.PORT || 3001;
const POCKET_BASE = "https://public.heypocketai.com/api/v1";

const app = express();
app.use(cors({ origin: "*", methods: ["GET","POST","PATCH","DELETE","OPTIONS"], allowedHeaders: ["Content-Type","Authorization"] }));
app.options("*", cors());
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

const DB_FILE = "./db.json";
const CONFIG_FILE = "./config.json";

function loadDB() {
    if (!existsSync(DB_FILE)) return { tasks: [], calls: [] };
    return JSON.parse(readFileSync(DB_FILE, "utf8"));
}
function saveDB(data) { writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }
function loadConfig() {
    if (!existsSync(CONFIG_FILE)) return { pocketApiKey: "", webhookSecret: "", configured: false };
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
}
function saveConfig(cfg) { writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); }

async function pocketGet(path, apiKey) {
    const key = apiKey || loadConfig().pocketApiKey;
    const res = await fetch(`${POCKET_BASE}${path}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`Pocket API ${res.status}`);
    return res.json();
}

function verifySignature(secret, timestamp, body, signature) {
    if (!secret) return true;
    const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || "")); }
    catch { return false; }
}

// Extract all useful data from a Pocket recording payload
function processRecording(recording, summarizations, transcript) {
    const sumKey = Object.keys(summarizations || {})[0];
    const sumObj = sumKey ? summarizations[sumKey] : null;

  // Try v2 structure first, fall back to root level
  const v2 = sumObj?.v2 || sumObj;
    const summaryBlock = v2?.summary || {};
    const actionItemsBlock = v2?.actionItems || {};

  const bulletPoints = summaryBlock?.bulletPoints || summaryBlock?.bullet_points || [];
    const summaryMarkdown = summaryBlock?.markdown || summaryBlock?.text || null;
    const actionItems = actionItemsBliomcpko?r.ta cetxiporneIstse mfsr o|m|  "aecxtpiroensIst"e;m
  siBmlpoocrkt? .caocrtsi ofnr_oimt e"mcso r|s|" ;[
    ]i;m
  p
  o r t/ /c rEyxpttroa cftr osmp e"ackreyrpst of"r;o
  mi mtproarnts c{r irpeta
                  d F icloenSsytn cs,p ewarkietresF i=l e[S.y.n.cn,e we xSiestt(s(Styrnacn s}c rfirpotm  |"|f s["];)
.
    mcaopn(stt  =P>O RtT. s=p eparkoecre)s.sf.ielntve.rP(OBRoTo l|e|a n3)0)0]1;;


c o n/s/t  BPuOiClKdE Tf_uBlAlS Et r=a n"shctrtippst: /t/epxutb
  l i cc.ohnesytp otcrkaentsacir.icpotmT/eaxpti /=v 1("t;r
                                                      a
  ncsocnrsitp ta p|p|  =[ ]e)x.pmraeps(st( )=;>
                                        a`p$p{.tu.ssep(ecaokresr( {?  otr.isgpiena:k e"r* "+,  'm:e t'h o:d s':' }[$"{GtE.Tt"e,x"tP}O`S)T."j,o"iPnA(T'C\Hn"',)";D
    E
  L E TcEo"n,s"tO PcTaIlOlN S=" ]{,
      a l l oiwde:d Hreeacdoerrdsi:n g[."iCdo,n
    t e n t -tTiytplee":, "rAeuctohrodriinzga.ttiiotnl"e]  |}|) )";U
  natpipt.loepdt iroencso(r"d*i"n,g "c,o
    r s ( ) )d;u
  raaptpi.ouns:e (r"e/cwoerbdhionogk."d,u reaxtpiroens,s
                  . r a w (c{r etaytpeed:A t":a prpelciocradtiinogn./cjrseoant"e d}A)t),;

 a p p .suusmem(aerxyp:r essusm.mjasroynM(a)r)k;d
o
wcno,n
s t   D Bb_uFlIlLeEt P=o i"n.t/sd,b
  . j s o ns"p;e
  ackoenrsst, 
  C O N F ItGr_aFnIsLcEr i=p t":. /tcroannfsicgr.ijpstoTne"x;t
,

  f u n c taicotni olnoIatdeDmBs(,)
{ 
    riafw S(u!memxairsitzsaStyinocn(sD:B _sFuImLmEa)r)i zraettiuornns ,{
        t a}s;k
  s
  :   [c]o,n scta ltlass:k s[ ]=  }a;c
t i orneIttuermns .JmSaOpN(.iptaerms e=(>r e(a{d
F i l e Siydn:c (iDtBe_mF.IiLdE ,| |" uittfe8m".)g)l;o
                                               b}a
lfAucntcitoinoInt esmaIvde D|B|( d`attaas)k _{$ {wDraittee.Fniolwe(S)y}n_c$({DMBa_tFhI.LrEa,n dJoSmO(N).}s`t,r
i n g i ftye(xdta:t ai,t enmu.ltli,t l2e),)
;   } 
 fduunec:t iiotne ml.odaudeCDoantfei g|(|)  "{N
   o   diaft e("!,e
               x i s t ssStyantcu(sC:O NiFtIeGm_.FiIsLCEo)m)p lreetteudr n| |{  iptoecmk.eitsA_pcioKmepyl:e t"e"d,  ?w e"bdhoonoek"S e:c r"eotp:e n""",,
     c o n fsioguurrceed::  "fpaolcskee t}";,

    r e truercno rJdSiOnNg.Ipda:r sree(croeraddiFnigl.eiSdy,n
                                       c ( C O NrFeIcGo_rFdIiLnEg,T i"tultef:8 "r)e)c;o
r}d
ifnugn.cttiitolne ,s
a v e}C)o)n;f
i
g ( crfegt)u r{n  w{r ictaelFli,l etSaysnkcs( C}O;N
               F}I
G
_/F/I L─E─ ,S eJtSuOpN .esntdrpionignitfsy (─c──f──g──,── ──n──u──l──l──,── ──2──)──)──;── ──}──
──
──a──s──y──n──c── ──f─
uanpcpt.igoent (p"o/cakpeit/Gseett(uppa"t,h ,( raepqi,K erye)s ){ 
= >  c{o
       n s tc oknesyt  =c fagp i=K elyo a|d|C olnofaidgC(o)n;f
       i g (r)e.sp.ojcskoent(A{p icKoenyf;i
                               g u rceodn:s tc frge.sc o=n faiwgauirte df,e thcahs(A`p$i{KPeOyC:K E!T!_cBfAgS.Ep}o$c{kpeattAhp}i`K,e y{,  hweeabdheorosk:S e{c rAeutt:h ocrfigz.awteibohno:o k`SBeecarreetr  |$|{ kneuyl}l`,  }w e}b)h;o
                               o k Uirfl :( !crfegs..woekb)h otohkrUorwl  n|e|w  nEurlrlo r}()`;P
                               o}c)k;e
                               t
                                aApPpI. p$o{srte(s"./satpait/usse}t`u)p;/
  v e rrieftyu-rkne yr"e,s .ajssyonnc( )(;r
    e}q
  ,
   fruensc)t i=o>n  {v
                     e r icfoynSsitg n{a tauprieK(esye c}r e=t ,r etqi.mbeosdtya;m
                     p ,  ibfo d(y!,a psiiKgenya?t.usrtea)r t{s
                                                              W i tihf( "(p!ks_e"c)r)e tr)e truertnu rrne st.rsutea;t
                                                              u s (c4o0n0s)t. jesxopne(c{t eodk :=  fcarlyspet,o .ecrrreoart:e H"mKaecy( "msuhsat2 5s6t"a,r ts ewcirteht )p.ku_p"d a}t)e;(
                                                                ` $ {ttriym e{s
                                                                t a m p }c.o$n{sbto ddya}t`a) .=d iagweasitt( "phoecxk"e)t;G
                                                              e t (t"r/yp u{b lriect/urrenc ocrrdyipntgos.?tliimmiintg=S3a"f,e EaqpuiaKle(yB)u;f
                                                              f e r . fcroonms(te xcpoeucntte d=) ,d aBtuaf.freerc.ofrrdoimn(gssi?g.nlaetnugrteh  |?|?  "0";)
                                                                                                                             ) ;   } 
r e sc.ajtscohn ({{  roekt:u rtnr ufea,l sree;c o}r
d}i
n
g/C/o uEnxtt:r accotu natl l} )u;s
e f u}l  cdaattcah  f{r orme sa. sPtoactkuest( 4r0e0c)o.rjdsionng( {p aoykl:o afda
                                                                    lfsuen,c teirorno rp:r o"cIensvsaRleicdo rAdPiIn gk(erye"c o}r)d;i n}g
,} )s;u
m
maaprpi.zpaotsito(n"s/,a ptir/asnestcurpi/psta)v e{"
,   (croenqs,t  rseusm)K e=y>  ={ 
  O b jceocnts.tk e{y sa(psiuKmemya,r iwzeabthiooonksU r|l|  }{ }=) [r0e]q;.
b o dcyo;n
                    s t  isfu m(O!bajp i=K esyu?m.Ksetya r?t ssWuimtmha(r"ipzka_t"i)o)n sr[estuumrKne yr]e s:. sntualtlu;s
                    (
                      4 0 0/)/. jTsroyn (v{2  oskt:r ufcatlusree,  feirrrsotr,:  f"aIlnlv ablaicdk  AtPoI  rkoeoyt"  l}e)v;e
l 
  c ocnosnts tc fvg2  ==  lsouamdOCbojn?f.ivg2( )|;|
  s ucmoOnbsjt; 
w e bchoonosktS escurmemta r=y Bclfogc.kw e=b hvo2o?k.Sseucmrmeatr y| || |c r{y}p;t
o . rcaonndsotm Bayctteiso(n3I2t)e.mtsoBSltorcikn g=( "vh2e?x."a)c;t
i o nsIatveemCso n|f|i g{(}{; 
p
                            o c kceotnAspti Kbeuyl:l eatpPioKienyt,s  w=e bshuomomkaSreycBrleotc,k ?w.ebbuhloloektUProli:n twse b|h|o oskuUmrmla r|y|B l"o"c,k ?c.obnuflilgeutr_epdo:i nftasl s|e|  }[)];;

    rceosn.sjts osnu(m{m aorky:M atrrkudeo,w nw e=b hsouomkmSaercyrBelto c}k)?;.
m}a)r;k
d
oawpnp .|p|o sstu(m"m/aarpyiB/lsoectku?p./tveexrti f|y|- wneublhlo;o
  k " ,c o(nrsetq ,a crteiso)n I=t>e m{s
    =  caocntsito ncIftge m=s BllooacdkC?o.nafcitgi(o)n;I
t e mcso n|s|t  adcbt i=o nlIotaedmDsBB(l)o;c
k ? .iafc t(idobn._ciatlelmss. l|e|n g[t]h; 
>
  0 )/ /{  Ecxftgr.accotn fsipgeuarkeedr s=  ftrroume ;t rsaanvsecCroinpfti
         g ( ccfogn)s;t  rsepteuarkne rrse s=. j[s.o.n.(n{e wo kS:e tt(r(uter a}n)s;c r}i
p t  r|e|s .[j]s)o.nm(a{p (otk := >f atl.ssep,e amkeesrs)a.gfei:l t"eNro( Bwoeoblheoaonk)s) ]r;e
  c
                        e i v/e/d  Byueitl.d  Mfauklel  at rsahnosrctr itpets tt erxetc
                        o r dcionngs to nt ryaonusrc rPiopctkTeetx,t  t=h e(nt rtarnys cargiapitn .|"|  }[)];)
                                                                            .}m)a;p
                        (
                          ta p=p>. p`o$s{tt(."s/paepaik/esre t?u pt/.csopmepalkeetre "+,  '(:r e'q ,:  r'e's})$ {=t>. t{e
                          x t }c`o)n.sjto icnf(g' \=n 'l)o;a
                          d
                        C o ncfoings(t) ;c aclflg .=c o{n
                                                        f i g u riedd:  =r etcroured;i nsga.viedC,o
                                                        n f i g (tciftgl)e;:  rreesc.ojrsdoinn(g{. toikt:l et r|u|e  "}U)n;t
                                                          i}t)l;e
                                                        d
                                                         /r/e c─o─ rDdaitnag "e,n
                                                          d p o i ndtusr a─t──i──o──n──:── ──r──e──c──o──r──d──i──n──g──.──d──u──r──a──t──i──o──n──,──
                                                        ── 
 a p pc.rgeeatt(e"d/Aatp:i /rdeactoar"d,i n(gr.ecqr,e arteesd)A t=,>
 { 
       scuomnmsatr yd:b  s=u mlmoaardyDMBa(r)k;d
                                                        o w nr,e
                                                        s . j s obnu(l{l
                                                          e t P o itnatssk,s
                                                        :   d b .stpaesakkse,r sc,a
                                                        l l s :  tdrba.ncsaclrlisp,t
                                                        :   t r asntsactrsi:p t{T
                                                                                e x t , 
                                                                                      o p eanc:t idobn.Ittaesmkss,.
                                                                                  f i l t erra(wtS u=m>m atr.isztaattiuosn s=:= =s u"mompaerni"z)a.tlieonngst,h
                                                                                , 
                                                                                  } ; 

    dcoonnes:t  dtba.stkass k=s .afcitlitoenrI(tte m=s>. mta.ps(tiatteums  ==>= =( {"
      d o n e "i)d.:l eintgetmh.,i
                                                                d   | |   i toevme.rgdluoeb:a ldAbc.ttiaosnkIst.efmiIldt e|r|( t` t=a>s kt_.$s{tDaattues. n=o=w=( )"}o_v$e{rMdauteh".)r.alnednogmt(h),}
                                                                ` , 
                                                                                                                                      ttoetxatl:C ailtlesm:. tdibt.lcea,l
                                                                l s . l ednuget:h ,i
                                                        t e m . d}u,e
D a t}e) ;|
|} )";N
  o
 adpapt.ep"a,t
   c h ( " /satpait/utsa:s kist/e:mi.di"s,C o(mrpelqe,t erde s|)|  =i>t e{m
. i sc_ocnosmtp ldebt e=d  l?o a"ddDoBn(e)"; 
:   "coopnesnt" ,t
                                                                          a s k   =s odubr.ctea:s k"sp.ofciknedt("t, 
                                                                            = >   t .riedc o=r=d=i nrgeIqd.:p arreacmosr.diidn)g;.
i d ,i
                                                                          f   ( ! traescko)r drientguTrint lree:s .rsetcaotrudsi(n4g0.4t)i.tjlseo,n
                                                                          ( {  }e)r)r;o
                                                                          r
                                                                          :   "rNeottu rfno u{n dc"a l}l),; 
t a stkass k}.;s
t}a
t
u/s/  =─ ─ tSaestku.ps teantdupso i=n=t=s  "─d──o──n──e──"── ──?── ──"──o──p──e──n──"── ──:── ──"──d──o──n──e──"──;──
── ─
 aipfp .(gteats(k"./satpait/usse t=u=p=" ," d(orneeq",)  rteass)k .=d>u e{ 
=   "cDoonnset" ;c
f g  s=a vleoDaBd(Cdobn)f;i gr(e)s;.
j s orne(st.ajssko)n;(
  {} )c;o
n
faipgpu.rpeods:t (c"f/ga.pcio/ntfaisgkusr"e,d ,( rheaqs,A prieKse)y := >! !{c
  f g .cpooncskte tdAbp i=K elyo,a dwDeBb(h)o;o
k S eccornestt:  tcafsgk. w=e b{h oiodk:S e`cmraentu a|l|_ $n{uDlalt,e .wneobwh(o)o}k`U,r lt:e xctf:g .rweeqb.hbooodkyU.rtle x|t|,  nduulel:  }r)e;q
.}b)o;d
y
.adpupe. p|o|s t"(T"o/daapyi"/,s esttuapt/uvse:r i"foyp-ekne"y," ,s oausrycnec:  ("rmeaqn,u arle"s )} ;=
>   {d
b . tcaosnksst. u{n sahpiifKte(yt a}s k=) ;r esqa.vbeoDdBy(;d
     b ) ;i fr e(s!.ajpsioKne(yt?a.sskt)a;r
     t}s)W;i
t
h/(/" pSky_n"c) )l arteetsutr nr erceosr.dsitnagtsu sf(r4o0m0 )P.ojcskoent( {( sokki:p sf aallsree,a deyr rsotro:r e"dK eoyn emsu)s
   ta pspt.aprots tw(i"t/ha ppik/_s"y n}c)";,
  a styrnyc  {(
  r e q ,  croenss)t  =d>a t{a
                               =  caownasitt  cpfogc k=e tlGoeatd(C"o/npfuibgl(i)c;/
  r e ciofr d(i!ncgfsg?.lpiomcikte=t3A"p,i Kaepyi)K erye)t;u
  r n   r ecso.nsstta tcuosu(n4t0 0=) .djastoan.(r{e ceorrrdoirn:g s"?N.olte ncgotnhf i?g?u r0e;d
  "   } ) ;r
  e s .tjrsyo n{(
  {   o k :c otnrsute ,l irsetc o=r daiwnagiCto upnotc:k ectoGuentt( "}/)p;u
                                                                    b l i}c /craetccohr d{i nrgess?.lsitmaittu=s1(04"0)0;)
  . j s o nc(o{n sotk :r efcaolrsdei,n gesr r=o rl:i s"tI.nrveacloirdd iAnPgIs  k|e|y "l i}s)t;. d}a
                                                   t}a) ;|
              |
               alpips.tp o|s|t (["]/;a
                                 p i / s ectounps/ts advbe "=,  l(oraedqD,B (r)e;s
                 )   = >  l{e
                            t   nceownCsatl l{s  a=p i0K,e yn,e wwTeabshkoso k=U r0l; 
                                             }   =   rfeoqr. b(ocdoyn;s
                            t   riefc  (o!fa prieKceoyr?d.isntgasr)t s{W
                                                                       i t h ( " p ki_f" )()d br.ectaulrlns .rfeisn.ds(tca t=u>s (c4.0i0d) .=j=s=o nr(e{c .oikd:) )f aclosnet,i neurer;o
                                                                       r :   " I n vtarlyi d{ 
                                                                         A P I   k e y "  c}o)n;s
                                                                         t   dceotnasitl  c=f ga w=a ilto apdoCcokneftiGge(t)(;`
                                                                         / p ucbolnisct/ rweecbohrodoiknSgesc/r$e{tr e=c .cifdg}.?wienbchlouodkeS=eaclrle`t) ;|
                            |   c r y p t o .croannsdto mrB y=t edse(t3a2i)l..troeSctorridnign(g" h|e|x "d)e;t
                                                                       a i ls.advaetCao n|f|i gr(e{c ;p
                                                                                                   o c k e t A p i Kceoyn:s ta p{i Kceayl,l ,w etbahsokosk S}e c=r eptr,o cweesbshRoeockoUrrdli:n gw(erb,h odoektUarill .|s|u m"m"a,r iczoantfiiognusr e|d|:  dfeatlasiel .}s)u;m
                                                                       m a rriezsa.tjisoonn,( {d eotka:i lt.rturea,n swcerbihpoto)k;S
                                                                       e c r e t   } ) ;d
                            b}.)c;a
                             l
                             lasp.pu.npsohsitf(t"(/caaplil/)s;e
                               t u p / v e r i fdyb-.wteabshkoso.ku"n,s h(irfetq(,. .r.etsa)s k=s>) ;{

                   c o n s t  ncefwgC a=l llso+a+d;C onnefwiTga(s)k;s
                               + =c otnasstk sd.bl e=n gltoha;d
                             D B ( ) ; 
                            }  icfa t(cdhb .(cearlrl)s .{l ecnogntsho l>e .0e)r r{o rc(f`gF.aciolnefdi gtuor efde t=c ht rrueec;o rsdaivnegC o$n{friegc(.cifdg}):;` ,r eetrurr.nm ersessa.gjes)o;n (}{
    o k :  }t
              r u e   }s)a;v e}D
B ( drbe)s;.
j s o n (r{e so.kj:s ofna(l{s em,e smseasgsea:g e`:S y"nNcoe dw e$b{hnoeowkCsa lrlesc}e inveewd  ryeecto.r dMiankges ,a  $s{hnoerwtT atseksst}  rteacsokrsd iandgd eodn`  y}o)u;r
  P o}c kceatt,c ht h(eenr rt)r y{  argeasi.ns.t"a t}u)s;(
    5}0)0;)
.
jaspopn.(p{o setr(r"o/ra:p ie/rsre.tmueps/scaogmep l}e)t;e "},
}()r;e
q
,/ /r eFso)r c=e>  r{e
- f ectocnhs tA LcLf gr e=c olrodaidnCgosn fiingc(l)u;d icnfgg .scuomnmfairgiuerse d( c=l etarruse ;e xsiasvteiCnogn fciagl(lcsf)g
                     )a;p pr.epso.sjts(o"n/(a{p io/ks:y ntcr/ufeo r}c)e;"
                     ,} )a;s
y
n/c/  (─r─ eDqa,t ar eesn)d p=o>i n{t
s   ─c──o──n──s──t── ──c──f──g── ──=── ──l──o──a──d──C──o──n──f──i──g──(──)──;──
                                    ── 
 aipfp .(g!ectf(g"./paopcik/edtaAtpai"K,e y()r erqe,t urrens )r e=s>. s{t
                                                                        a t ucso(n4s0t0 )d.bj s=o nl(o{a deDrBr(o)r;:
                                                                          " Nroets .cjosnofni(g{u
                                                                            r e d "  t}a)s;k
                                                                            s :  tdrby. t{a
                                                                                          s k s ,  ccoanlslts :l idsbt. c=a lalwsa,i
                                                                                          t   p o cskteattGse:t ({"
                                                                                            / p u b l i co/preenc:o rddbi.ntgass?klsi.mfiitl=t2e0r"()t; 
                                                                                            = >   t .csotnasttu sr e=c=o=r d"ionpgesn "=) .lliesntg.trhe,c
                                                                                          o r d i n g sd o|n|e :l idsbt..tdaastkas .|f|i lltiesrt( t| |= >[ ]t;.
                                                                                                                                                  s t a t ucso n=s=t=  d"bd o=n el"o)a.dlDeBn(g)t;h
                                                                                          , 
                                                                                                  d b . coavlelrsd u=e :[ ]d;b
                                                                                          . t a s klse.tf inletweCra(ltl s= >=  t0.,s tnaetwuTsa s=k=s=  =" o0v;e
                                                                                            r d u e "f)o.rl e(ncgotnhs,t
                                                                                              r e c   o ft orteacloCradlilnsg:s )d b{.
                                                                                            c a l l s . lternyg t{h
                                                                                                                  , 
                                                                                            } , 
                                                                                                       c o n}s)t; 
                                                                        d}e)t;a
                                                                        i
                                                                        la p=p .apwaaticth (p"o/cakpeit/Gteats(k`s//p:uibdl"i,c /(rreecqo,r driensg)s /=$>{ r{e
                                                                                                                                                              c . icdo}n?sitn cdlbu d=e =laolald`D)B;(
                                                                                                                                                              ) ; 
                                                                                                                                                                   c o n scto ntsats kr  ==  ddbe.ttaaislk.sr.efcionrdd(itn g= >| |t .diedt a=i=l=. draetqa. p|a|r armesc.;i
                                                                                                                                                                   d ) ; 
                                                                                                                                                                        i f  c(o!ntsats k{)  craeltlu,r nt arsekss. s}t a=t upsr(o4c0e4s)s.Rjescoonr(d{i negr(rro,r :d e"tNaoitl .fsouumnmda"r i}z)a;t
                                                                                                                                                                        i o ntsa s|k|. sdteattauisl .=s utmamsakr.isztaattiuosn ,= =d=e t"adioln.et"r a?n s"corpiepnt") ;:
                                                                                                                                                                          " d o n e " ; 
                                                                                                                                                                          d b .icfa l(ltsa.spku.ssht(actaulsl )=;=
                                                                                                                                                                          =   " d o n e " )f otra s(kc.odnuset  =t a"sDko noef" ;t
                                                                                                                                                                          a s kssa)v e{D
                                                                                                                                                                          B ( d b ) ;   r e s .ijfs o(n!(dtba.stka)s;k
                                                                                                                                                                          s}.)f;i
                                                                                                                                                                          n
                                                                                                                                                                          da(ptp .=p>o stt.(i"d/ a=p=i=/ ttaasskks."i,d )()r edqb,. traessk)s .=u>n s{h
                                                                                                                                                                          i f tc(otnasstk )d;b
                                                                                                                                                                            =   l o a d D B}(
                                                                                                                                                                            ) ; 
                                                                                                                                                                                 c o n snte wtCaaslkl s=+ +{;  inde:w T`amsaknsu a+l=_ $t{aDsaktse..lneonwg(t)h};`
                                                                                                                                                                                 ,   t e x t :}  rceaqt.cbho d(ye.rtre)x t{,  cdounes:o lree.qe.rbroodry(.`dFuaei l|e|d  "tToo dfaeyt"c,h  srteactoursd:i n"go p$e{nr"e,c .siodu}r:c`e,:  e"rmra.nmueasls"a g}e;)
                                                                                                                                                                                 ;   }d
                                                                                                                                                                                 b . t a s}k
                                                                                                                                                                                 s . u n sshaivfetD(Bt(adsbk));;
                                                                                                                                                                                   s a v erDeBs(.djbs)o;n (r{e sm.ejsssoang(et:a s`kR)e;-
   s}y)n;c
e
d/ /$ {SnyenwcC allaltse}s tr erceocrodridnignsg sw iftrho mf uPlolc kseutm m(asrkiiepss`  a}l)r;e
a d y}  sctaotrcehd  (oenrers)) 
{a prpe.sp.osstta(t"u/sa(p5i0/0s)y.njcs"o,n (a{s yenrcr o(rr:e qe,r rr.emse)s s=a>g e{ 
} ) ;c o}n
 s}t) ;c
f
g/ /=  ─l─ oWaedbChoonofki gr(e)c;e
i v eirf  ─(──!──c──f──g──.──p──o──c──k──e──t──A──p──i──K──e──y──)── ──r──e──t──u──r──n
 arpeps..psotsatt(u"s/(w4e0b0h)o.ojks/opno(c{k eetr"r,o r(:r e"qN,o tr ecso)n f=i>g u{r
   e d "c o}n)s;t
     c ftgr y=  {l
                 o a d C ocnofnisgt( )l;i
s t  c=o naswta irta wpBoocdkye t=G erte(q"./bpoudbyl.itco/Srtercionrgd(i)n;g
  s ? lciomnistt= 1s0i"g)n;a
  t u r e  c=o nrsetq .rheecaodredrisn[g"sx -=h elyipsotc.kreetc-osridginnagtsu r|e|" ]l;i
s t .cdoantsat  |t|i mleisstta m|p|  =[ ]r;e
q . h e acdoenrsst[ "dxb- h=e ylpooacdkDeBt(-)t;i
  m e s t almept" ]n;e
  w C ailfl s( c=f g0.,w enbehwoToaksSkesc r=e t0 ;&
&   ! v efroirf y(Sciognnsatt urreec( coffg .rweecbohrodoiknSgesc)r e{t
,   t i m e sitfa m(pd,b .rcaawlBlosd.yf,i nsdi(gcn a=t>u rce.)i)d  {=
  = =   r erce.tiudr)n)  rceosn.tsitnauteu;s
                                                                      ( 4 0 1 ) . jtsroyn ({{
                                                                                             e r r o r :   "cIonnvsatl idde tsaiigln a=t uarwea"i t} )p;o
                                                                      c k e}t
G e tl(e`t/ ppuabyllioca/dr;e
c o rtdriyn g{s /p$a{yrleoca.di d=} ?JiSnOcNl.updaer=sael(lr`a)w;B
o d y ) ;   }   ccaotncsht  {r  r=e tduertna irle.sr.esctoartduisn(g4 0|0|) .djestoani(l{. deartrao r|:|  "rIencv;a
                                                                                       l i d   JSON" }); }
    const { event, recording, summarizations, transcript } = payload;
                               console.log(`[webhook] ${event} — ${recording?.id}`);
                               if (event === "summary.completed" || event === "summary.regenerated") {
                                     const db = loadDB();
                                     const { call, tasks } = processRecording(recording, summarizations, transcript);
                                     const idx = db.calls.findIndex(c => c.id === call.id);
                                     if (idx >= 0) db.calls[idx] = call; else db.calls.unshift(call);
                                     for (const task of tasks) { if (!db.tasks.find(t => t.id === task.id)) db.tasks.unshift(task); }
                                     saveDB(db);
                               }
                               if (event === "action_items.updated") {
                                     const db = loadDB();
                                     for (const item of payload.actionItems || []) {
                                             const task = db.tasks.find(t => t.id === item.id);
                                             if (task) task.status = item.isCompleted ? "done" : "open";
                                     }
                                     saveDB(db);
                               }
                               res.json({ ok: true });
                            });

app.get("/health", (_, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`Denise backend on port ${PORT}`));
