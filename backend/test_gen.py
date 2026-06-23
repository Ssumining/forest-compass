import json, sys
sys.path.insert(0, '.')
from generate_pdf import generate_report_pdf
payload = {
  'declarationType': '신규',
  'declaredDate': '2026-06-22',
  'recipient': '시장군수구청장',
  'applicant': {'name':'홍길동','birth':'1990-01-01','address':'서울특별시 종로구 세종대로 1','phone':'010-1234-5678'},
  'landowner': {'sameAsApplicant': True},
  'siteDetails': [{'location':'경기도 가평군 북면','parcel':'산100','landCategory':'임야','areaTotal':5000,'areaByType':{'임업용산지':3000,'공익용산지':1000,'준보전산지':1000},'tempUseAreaSqm':4000}],
  'purpose':'태양광 발전시설 설치',
  'period':{'original':{'start':'2026-07-01','end':'2027-06-30'},'changed':{}},
  'changes':{'before':'','after':'','reason':''},
}
data = generate_report_pdf(payload)
open('test_output.pdf','wb').write(data)
print('OK bytes:', len(data))
