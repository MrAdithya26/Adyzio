import openpyxl, re, sys
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
pl=list(openpyxl.load_workbook(sys.argv[1],read_only=True)['Product Links'].iter_rows(values_only=True))[1:]
tp=list(openpyxl.load_workbook(sys.argv[2],read_only=True)['Templates'].iter_rows(values_only=True))
thead,trows=tp[0],tp[1:]
tmap={r[0].lower():r for r in trows}
slug=lambda s: re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
SLOTS=["09:00","12:30","16:00","19:00","21:30"]
wb=openpyxl.Workbook()
st=wb.active; st.title="Start"
st["A1"]="Start date (change this one cell; every date moves)"; st["B1"]="=TODAY()+7"
st["B1"].number_format="dd-mmm-yyyy"; st["A1"].font=Font(bold=True); st["B1"].fill=PatternFill("solid",fgColor="FFF2CC")
st["A3"]="Reels per day"; st["B3"]=5
st["A4"]="Days needed"; st["B4"]="=ROUNDUP(140/B3,0)"
st["A6"]="Posting times (IST)"; 
for i,t in enumerate(SLOTS): st.cell(7+i,1,f"Slot {i+1}"); st.cell(7+i,2,t)
st.column_dimensions["A"].width=48; st.column_dimensions["B"].width=16
H=["#","Day","Post date","Time (IST)","Product","Reel file","Thumbnail file","DM keyword","Adyzio page (planned)",
 "Amazon search","Flipkart search","Meesho search",
 "Amazon product link","Flipkart product link","Meesho product link",
 "Amazon affiliate","Flipkart affiliate","Meesho affiliate",
 "Links status","Page status","IG","FB","YT","Pinterest","Telegram","WhatsApp","Notes"]
sc=wb.create_sheet("Schedule"); sc.append(H)
for c in sc[1]: c.font=Font(bold=True,color="FFFFFF"); c.fill=PatternFill("solid",fgColor="1F4E78"); c.alignment=Alignment(wrap_text=True)
for i,r in enumerate(pl):
    n=i+2; name=r[1]
    sc.append([i+1, f"=INT((A{n}-1)/Start!$B$3)+1", f"=Start!$B$1+B{n}-1",
      f"=INDEX(Start!$B$7:$B$11,MOD(A{n}-1,Start!$B$3)+1)", name, r[3], r[4],
      "LINK", f"https://adyzio.com/{slug(name)}/", r[7], r[8], r[6],
      None,None,None,None,None,None,"Link needed","Not made",None,None,None,None,None,None,None])
    sc.cell(n,3).number_format="ddd dd-mmm"
yellow=PatternFill("solid",fgColor="FFF2CC")
for row in sc.iter_rows(min_row=2,min_col=13,max_col=18):
    for c in row: c.fill=yellow
dv1=DataValidation(type="list",formula1='"Link needed,Some links,All links,Checked"'); sc.add_data_validation(dv1); dv1.add("S2:S141")
dv2=DataValidation(type="list",formula1='"Not made,Draft,Live"'); sc.add_data_validation(dv2); dv2.add("T2:T141")
dv3=DataValidation(type="list",formula1='"Scheduled,Posted,Skipped"'); sc.add_data_validation(dv3); dv3.add("U2:Z141")
sc.conditional_formatting.add("A2:AA141",FormulaRule(formula=['$C2=TODAY()'],fill=PatternFill("solid",fgColor="E2EFDA")))
for col,w in zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ",[5,5,11,8,28,30,30,9,40]+[18]*9+[13,11]+[10]*6): sc.column_dimensions[col].width=w
sc.freeze_panes="F2"; sc.auto_filter.ref="A1:AA141"
tw=wb.create_sheet("Templates")
tw.append(["#"]+list(thead))
for i,r in enumerate(pl):
    tw.append([i+1]+list(tmap[r[1].lower()]))
cp=wb.create_sheet("Captions",2)
cp.append(["#","Product"]+list(thead[1:]))
for c in cp[1]: c.font=Font(bold=True)
L="ABCDEFGHIJKLMNOP"
for i,r in enumerate(pl):
    n=i+2; row=[i+1,f"=Schedule!E{n}"]
    for j in range(1,len(thead)):
        ref=f"Templates!{L[j+1]}{n}"
        row.append(f'=SUBSTITUTE(SUBSTITUTE({ref},"[LINK]",Schedule!$I{n}),"[AMZ]",IF(Schedule!$P{n}<>"","As an Amazon Associate I earn from qualifying purchases.",""))')
    cp.append(row)
cp.freeze_panes="C2"
for col in "CDEFGHIJKLMN": cp.column_dimensions[col].width=40
miss=[]
hw=wb.create_sheet("How to use")
for line in [
"ADYZIO – REELS SCHEDULE (Dec 2026). One row = one reel. Made 22 Nov 2026 from Adyzio_Product_Links.xlsx and Adyzio_Social_Captions.xlsx (originals not changed).",
"1. LINKS: for each row open the 3 search links, find the SAME product, paste its page link in the yellow 'product link' columns. The extension 1.8 'Link finder' will do this with you and fill the affiliate columns.",
"2. Amazon affiliate = SiteStripe short link. Flipkart and Meesho affiliate = ExtraPe. Search links earn nothing.",
"3. PAGE: each reel gets one adyzio.com page with up to 3 store buttons. Captions and DMs send THAT page, not the raw store links (Amazon does not allow its links in DMs to people who did not ask).",
"4. DATE: change only Start!B1. 5 reels a day, times in Start!B7:B11. 140 reels = 28 days.",
"5. CAPTIONS tab fills the page link automatically. The Amazon line appears only when an Amazon affiliate link is filled.",
"6. AUTO-DM: in the DM tool set keyword LINK -> reply with the page link from column I.",
"7. After posting, mark IG / FB / YT / Pinterest / Telegram / WhatsApp as Posted.",
"Never write prices in captions. Keep #ad on every post. A product with no link on any store gets 'Skipped'."]:
    hw.append([line])
hw.column_dimensions["A"].width=140
wb.save(sys.argv[3]); print("missing templates:",miss)
