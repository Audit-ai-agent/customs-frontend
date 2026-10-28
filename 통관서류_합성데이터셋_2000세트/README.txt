================================================================
통관 서류 3종 합성 데이터셋 (B/L · Commercial Invoice · Packing List)
생성형 AI 문서 자동 심사 에이전트 - 교차검증/이상탐지 테스트용
================================================================

■ 구성
  clean_sets/    정상(정합) 1,000세트  → 3,000개 PDF
      set_0001/  C0001_BL.pdf, C0001_INV.pdf, C0001_PL.pdf
      set_0002/  ...
  error_sets/    오류(불일치 주입) 1,000세트 → 3,000개 PDF
      set_0001/  E0001_BL.pdf, E0001_INV.pdf, E0001_PL.pdf
      set_0002/  ...
  clean_manifest.csv     정상 1,000세트의 정답(ground-truth) 데이터
  error_labels.csv       오류 1,000세트에 주입된 오류의 정답 라벨
  error_type_summary.csv 오류 유형별 발생 건수 요약

  * 서류 양식은 업로드된 3개 원본 이미지(B/L, Commercial Invoice,
    Packing List)의 필드/박스 구조를 그대로 재현했습니다.

■ 정상/오류 세트의 관계 (중요)
  set_NNNN 번호는 clean과 error가 서로 대응합니다.
  error_sets/set_0001 은 clean_sets/set_0001 과 "동일한 기준 데이터"에서
  출발해 1~3개의 오류만 주입한 버전입니다. 따라서 두 세트를 직접 비교(diff)
  하여 오류 위치를 확인하거나, 오류 세트만으로 모델의 탐지 성능을 평가할 수
  있습니다.

■ 오류 세트 특성
  - 세트당 오류 개수: 1개(50%), 2개(35%), 3개(15%) 비율로 랜덤 주입
  - 총 오류 라벨 1,634건 / 오류 세트 1,000개
  - 오류 유형(13종):
      QTY_MISMATCH            Invoice ↔ Packing List 수량 불일치
      GROSS_WEIGHT_MISMATCH   B/L ↔ Packing List 총중량 불일치
      AMOUNT_CALC_ERROR       Amount ≠ Quantity × Unit price (계산 오류)
      TOTAL_MISMATCH          TOTAL ≠ Amount 합계
      CONSIGNEE_MISMATCH      수하인/Applicant 상호 불일치
      PORT_DISCHARGE_MISMATCH 양륙항 불일치
      CONTAINER_NO_MISMATCH   컨테이너 번호 불일치
      INVOICE_NO_MISMATCH     송장번호 불일치 (INV ↔ PL)
      DESCRIPTION_MISMATCH    품명 불일치
      VESSEL_MISMATCH         선박명 불일치
      CARTONS_MISMATCH        포장 수량(Cartons) 불일치
      NET_GT_GROSS            순중량 > 총중량 (논리 모순)
      LC_NO_MISMATCH          신용장(L/C) 번호 불일치

■ error_labels.csv 컬럼
  set_id             오류 세트 ID (예: E0001)
  num_errors_in_set  해당 세트에 주입된 총 오류 개수
  error_type         오류 유형 코드
  affected_doc       오류가 표기된 서류 (BILL_OF_LADING / COMMERCIAL_INVOICE / PACKING_LIST)
  field              오류가 발생한 항목명
  correct_value      정상(정답)값
  wrong_value        오류 세트에 실제 표기된 값
  note               한글 설명

■ clean_manifest.csv 컬럼
  set_id + 세트가 공유하는 교차검증 대상 필드 전체
  (수출자/수입자/은행/적재·양륙항/선박/B-L·송장·L-C 번호/컨테이너/품명/
   수량/단가/금액/합계/카톤수/순중량/총중량/CBM 등)
  → 정상 세트의 "정답표"로 활용하거나, 오류 탐지 정확도 채점의 기준으로 사용.

■ 활용 예시
  1) OCR/추출 정확도 테스트  : PDF → 추출값 vs manifest 비교
  2) 교차검증 로직 테스트     : error_sets 투입 → 탐지 결과 vs error_labels 비교
  3) 정밀도/재현율 산출       : 라벨된 1,634건 기준 confusion matrix 작성

■ 주의
  본 데이터는 100% 합성(가상)이며 실제 기업/거래 정보가 아닙니다.
  세관·법적 판단 근거가 아니라 알고리즘 검증 용도로만 사용하십시오.
================================================================

================================================================
■ v2 추가: 오류 세트 Certificate of Origin (2026-08-14)
================================================================
  error_sets/ 의 1,000세트 전부에 E####_CO.pdf(원산지증명서)가 추가되었습니다.
  내용은 해당 세트의 기준 데이터(clean_manifest.csv)에서 생성했습니다:
  수출자/수하인/운송정보/송장번호/품명/수량 + 원산지 REPUBLIC OF KOREA.

  이 중 343세트에는 CO 전용 오류 1건이 결정론적으로 주입되어 있으며
  error_labels.csv 에 affected_doc=CERTIFICATE_OF_ORIGIN 으로 라벨되어
  있습니다 (num_errors_in_set 도 반영). 추가 오류 유형(4종):
      CO_ORIGIN_MISMATCH       CO 원산지가 실제 원산지(대한민국)와 불일치 (87건)
      CO_CONSIGNEE_MISMATCH    CO 수하인이 Invoice 수입자와 불일치 (100건)
      CO_INVOICE_NO_MISMATCH   CO 기재 송장번호가 Invoice와 불일치 (80건)
      CO_DESCRIPTION_MISMATCH  CO 품명이 Invoice 품명과 불일치 (76건)
  → 총 오류 라벨 1,634 + 343 = 1,977건. error_type_summary.csv 갱신됨.

  재생성: python make_error_co.py  (표준 라이브러리만 사용, seed 고정으로
  같은 PDF·라벨이 재현됩니다. CO는 텍스트 레이어 PDF라 pypdf 추출과
  업로드-자동추출 파이프라인에 그대로 사용할 수 있습니다.)
  주의: clean_sets 에는 CO가 없습니다(오류 세트 전용 추가).

================================================================
■ v3 추가: 정상 세트 Certificate of Origin (2026-08-24)
================================================================
  clean_sets/ 의 1,000세트 전부에 C####_CO.pdf(원산지증명서)가 추가되었습니다.
  (→ 정상 세트도 4종 서류: BL · INV · PL · CO, 총 4,000개 PDF)
  내용은 clean_manifest.csv 기준 데이터 그대로이며 오류는 없습니다:
  수출자/수하인(=수입자)/운송정보/송장번호/품명/수량 + 원산지 REPUBLIC OF KOREA.
  인증서 번호(KCCI-2025-#####)·양식·폰트는 오류 세트 CO와 동일하므로
  clean_sets/set_NNNN/C####_CO.pdf 와 error_sets/set_NNNN/E####_CO.pdf 를
  직접 비교하면 CO 오류가 주입된 343세트만 내용이 다르고 나머지 657세트는
  바이트 단위로 동일합니다.

  재생성: python make_clean_co.py  (make_error_co.py 의 PDF 생성 함수를
  그대로 import, 표준 라이브러리만 사용, 결정론적.)
  라벨/요약 CSV는 변경되지 않습니다(정상 세트는 오류 없음).
