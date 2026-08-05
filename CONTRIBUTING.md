# Contributing

작은 변경은 `corepack npm run check:quick`만 실행합니다. Backend public API가 바뀐
변경은 `corepack npm run check:contract`도 실행합니다. 전역 npm 대신 Corepack이
packageManager pin의 npm 10.9.8을 사용하게 합니다.

Browser에서 Agent, Data, 데이터 저장소 또는 비밀을 직접 연결하지 마십시오.
실제 문서·토큰·실행 결과는 Git이 아니라 _local 또는 _artifacts에 둡니다.
