# 밀리터리 스킨 — 26종 개별 컨셉·제작 목록

작성일: 2026-11-05 · 상태: 컨셉·제작 명세 완료, 이미지 생성 중·게임 미적용

[통합 설정·게임 적용 명세](../military-allies-skin-concept.md) · [아트 문서 목차](../README.md)

[전체 이미지 프롬프트·사용 순서](prompts/README.md) · [파일별 JSON 작업 목록](prompts/jobs.json). 캐릭터별 본체·고유 동작·투사체·효과·미리보기·아이콘과 보간·전환 프레임, 배경·기지·UI 프롬프트를 정리했다.

[이미지 생성 진행 기록](GENERATED.md): 실제 생성 수와 원화 검수 상태, 보관 경로를 확인한다. 생성 수는 전체 제작·게임 적용 완료와 구별한다.

영웅 1종·소환 아군 10종·일반 적 10종·보스 5종의 개별 문서다. 기존 대상 ID를 파일명으로 사용한다. 원화·모션·효과 제작 시 통합 명세와 개별 문서를 함께 따른다. 인물·역할은 통합 설정을 유지하며, 세부 팔레트·대표 포즈·직접 통제 스킬의 표시명·고유 파일명은 제작 제안이다.

## 공통 제작 기준

- 아군은 20세 이상의 성인 여성 군인, 약 7~8등신의 전신 비율. 시온은 23세·172cm·보행 영웅이다.
- 시온을 포함한 아군 11종 중 9종은 바스트 모핑 적용, AA인 아카네·히바리는 제외한다. 머리카락·의상·장비 끈 보조 움직임은 AA도 적용한다.
- 머리카락·천은 몸보다 늦게 따라오고 감쇠한다. 발 디딤·가속·정지·회전·사격 반동이 자연스럽게 이어져야 한다.
- 본체 최소 19컷, 아이콘 1장·미리보기 1장. 자연스러운 모션에 필요한 중간·전환 프레임은 추가한다. 프레임 PNG로 출력하는 제작 파이프라인을 우선한다.
- 본체 PNG는 투명 RGBA·sRGB, 오른쪽 방향, 동일 종류의 캔버스·배율·피벗 통일. 일반 인물 768×1024, 호버 768×768, 보스 1536×1536을 개별 작업용 기본안으로 둔다.
- 지상 피벗 (0.5, 0.875), 비행 피벗 (0.5, 0.5). 오버로드의 공중·착지 피벗은 중심으로 통일한다.
- preview.png는 1024×1024 전신, icon.png는 128×128 얼굴·장비 중심. 문자열·UI·바닥 그림자·큰 효과·투사체는 본체와 분리한다.
- 원화·몸체·화면 표시·충돌 크기를 분리한다. 통합 명세의 실제 키 비율·화면 검수 기준을 사용한다.
- 실제 공격 유형·상성·강화·직접 통제·보스 수치는 코드 기준이다. 새 탄약·재장전·무적·경직·소환수를 외형만으로 추가하지 않는다.

## 적용 전에 해결할 차이

| 항목 | 기준 |
| --- | --- |
| 히바리 | 신규 컨셉은 지상. 현재 magpieFlock 비행 판정의 테마별 분기·상성·빙의 회귀 검증 필요 |
| 레이카 | 성인 지휘관+중형 드론 3기로 하나의 비행 전투 개체. 등착식 개인 부양 모듈은 제작 제안 |
| 쿠레하·후우카 | 내부 magic 유지, 신규 UI에서는 특수로 표시 |
| 스토커·블라이터 | ghost를 변이 장막으로 표시하고 기존 근접 저항·불 약점 유지 |
| 스킨 로딩 | 현재 단일 기본 manifest. 신규 테마 선택·패커·문구·기지 분기는 별도 구현 |
| 고유 클립·보조 움직임 | 파일명만으로 자동 재생·런타임 물리가 생기지 않음. 실제 이벤트·클립 전환 연결 필요 |

## 개별 문서

### 영웅 1종

시온 개정 컨셉(2026-11-05): 분홍색의 풀어 내린 긴 머리, 가슴선·복부·허벅지가 드러나는 크롭 제복, 청백색 전류가 흐르는 대형 전자기 대검. 머리 위 링·헤일로는 제외한다. 구 디자인 원본은 보존했다. [개정 디자인 74장·16개 클립 생성 기록](hero/kkomaMudang-v2-generated.md)과 미리보기·패키지를 확인한다. 실행 게임 연결은 별도 단계다.

| 신규 이름 | 기존 이름 | 대상 키 | 문서 |
| --- | --- | --- | --- |
| 시온 (シオン) | 꼬마 무당 | `hero:kkomaMudang` | [kkomaMudang.md](hero/kkomaMudang.md) |

### 소환 아군 10종

| 신규 이름 | 기존 이름 | 대상 키 | 문서 |
| --- | --- | --- | --- |
| 아카네 (アカネ) | 도깨비 방망이병 | `ally:clubGoblin` | [clubGoblin.md](ally/clubGoblin.md) |
| 하야테 (ハヤテ) | 외다리 도깨비 | `ally:oneLegGoblin` | [oneLegGoblin.md](ally/oneLegGoblin.md) |
| 미카 (ミカ) | 씨름 도깨비 | `ally:sumoGoblin` | [sumoGoblin.md](ally/sumoGoblin.md) |
| 아오이 (アオイ) | 여우불 사수 | `ally:foxfireArcher` | [foxfireArcher.md](ally/foxfireArcher.md) |
| 쿠레하 (クレハ) | 구미호 | `ally:gumiho` | [gumiho.md](ally/gumiho.md) |
| 쿠로가네 (クロガネ) | 불가사리 | `ally:bulgasari` | [bulgasari.md](ally/bulgasari.md) |
| 세이라 (セイラ) | 해태 | `ally:haetae` | [haetae.md](ally/haetae.md) |
| 레이카 (レイカ) | 삼족오 | `ally:samjokgo` | [samjokgo.md](ally/samjokgo.md) |
| 히바리 (ヒバリ) | 까치 떼 | `ally:magpieFlock` | [magpieFlock.md](ally/magpieFlock.md) |
| 후우카 (フウカ) | 영등 바람 | `ally:yeongdeungWind` | [yeongdeungWind.md](ally/yeongdeungWind.md) |

### 일반 적 10종

| 신규 이름 | 기존 이름 | 대상 키 | 문서 |
| --- | --- | --- | --- |
| 워커 | 달걀귀신 | `enemy:eggGhost` | [eggGhost.md](enemy/eggGhost.md) |
| 스피터 | 물귀신 투척병 | `enemy:waterGhostThrower` | [waterGhostThrower.md](enemy/waterGhostThrower.md) |
| 스토커 | 처녀귀신 | `enemy:maidenGhost` | [maidenGhost.md](enemy/maidenGhost.md) |
| 아머드 | 장승 망령 | `enemy:jangseungSpirit` | [jangseungSpirit.md](enemy/jangseungSpirit.md) |
| 호버 | 어둑시니 | `enemy:eodduksini` | [eodduksini.md](enemy/eodduksini.md) |
| 그로워 | 그슨대 | `enemy:geuseundae` | [geuseundae.md](enemy/geuseundae.md) |
| 블라이터 | 손각시 | `enemy:sonGakshi` | [sonGakshi.md](enemy/sonGakshi.md) |
| 디스럽터 | 저승사자 | `enemy:grimReaper` | [grimReaper.md](enemy/grimReaper.md) |
| 아이언클래드 | 강철이 | `enemy:gangcheol` | [gangcheol.md](enemy/gangcheol.md) |
| 브리처 | 두억시니 | `enemy:dueoksini` | [dueoksini.md](enemy/dueoksini.md) |

### 보스 5종

| 신규 이름 | 기존 이름 | 대상 키 | 문서 |
| --- | --- | --- | --- |
| 하이브 마더 | 거대 원귀 | `boss:giantWonGwi` | [giantWonGwi.md](boss/giantWonGwi.md) |
| 저거너트 | 철갑 장승왕 | `boss:ironJangseung` | [ironJangseung.md](boss/ironJangseung.md) |
| 멜트다운 | 이무기 강철이 | `boss:imugiGangcheol` | [imugiGangcheol.md](boss/imugiGangcheol.md) |
| 오버로드 | 어둑시니 대왕 | `boss:eodduksiniKing` | [eodduksiniKing.md](boss/eodduksiniKing.md) |
| 타이런트 | 차사왕 | `boss:chasaKing` | [chasaKing.md](boss/chasaKing.md) |

## 납품과 검수

원본은 `output/art-generation/source-assets/<분류>/<기존ID>/military/`에, 배포용은 `public/assets/characters/runtime/military/`에 준비하는 계획이다. 이 문서는 원본·아틀라스·게임 기능을 생성하지 않는다.

모든 종류에 대해 기준 원화 → 실제 게임 크기·반전 확인 → 이동·공격·보조 움직임 → 고유 효과·강화·직접 통제 또는 보스 패턴 순서로 확인한다. 개별 검수와 통합 문서의 완료 기준을 함께 사용한다.

공통 본체 494장+아이콘·미리보기 52장+시온 고유 스킬·효과 24장의 570장은 최소 기준이다. 이번 개별 문서의 추가 효과·보스 동작·중간 프레임은 이 수량에 포함되지 않는다. 공유 효과는 중복 산정하지 않고, 실제 파일 목록과 클립 길이가 정해지면 최종 제작 수량을 갱신한다.
