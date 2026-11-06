# 밀리터리 스킨 — 전체 이미지 프롬프트

작성일: 2026-11-05 · 상태: 프롬프트 작성 완료, 이미지 생성 진행 중

[26종 개별 컨셉](../README.md) · [통합 게임 적용 명세](../../military-allies-skin-concept.md) · [JSON 작업 목록](jobs.json)

실제 생성 수와 기준 원화 검수 상태는 [이미지 생성 진행 기록](../GENERATED.md)을 따른다. 아래 작업 수는 전체 제작 목록이며 완료 수를 의미하지 않는다.

캐릭터 26종의 파일별 프롬프트와 테마 부가 이미지 **총 1476개**를 정리했다. 각 코드 블록은 공통 문구를 따로 붙이지 않아도 사용할 수 있는 전체 프롬프트다.

| 범위 | 작업 수 | 의미 |
| --- | --- | --- |
| 캐릭터 기본·고유 이미지 | 738 | 본체 최소 19컷, 미리보기·아이콘, 개별 문서에 명시된 스킬·투사체·효과 |
| 보간·전환 확장 | 598 | 부드러운 대기·보행·회수·피격 및 start·stop·turn 제작안 |
| 테마 부가 이미지 | 140 | 5장 배경 레이어·기지 파손·잠금, 상태·자원·스킬 아이콘·패널 참고 원화 |

## 사용 순서

시온은 2026-11-05에 분홍색 긴 머리·가슴선/복부/허벅지 노출·전류가 흐르는 대형 전자기 대검으로 개정했으며 머리 위 링은 취소했다. [개정 컨셉](../hero/kkomaMudang.md)과 [개정 프롬프트](hero/kkomaMudang-prompts.md)를 따른다. 기존 생성 원화는 이전 디자인이므로 새 `idle_00` 검수 후 후속 프레임·타이틀·스킬 아이콘의 참조로 사용한다. 자동 생성용 `jobs.json`·`character-designs.en.json`과 실행 프롬프트도 개정 컨셉에 맞췄다. 개정 디자인 74장과 16개 클립은 별도 리비전으로 생성·패키징했으며 [시온 개정 생성 기록](../hero/kkomaMudang-v2-generated.md)을 따른다. 기존 원본 경로의 구 디자인과 섞지 않는다.

1. 종류별 `idle_00.png`를 먼저 생성·검수한다. 시온은 23세·172cm, 아군은 성인 일반 등신이다. 기본 테마의 SD 원화를 형태 참조로 혼용하지 않는다.
2. 확정 기준 원화를 실제 이미지 참조로 전달해 기본 동작을 생성한다. 프롬프트에 파일명이 적혀 있는 것만으로 도구에 이미지가 전달되지는 않는다.
3. `preview.png`·`icon.png`를 같은 원화에서 파생한다. 개별 효과는 첫 컷을 기준으로 후속 컷을 만들며 인물·무기를 효과에 합성하지 않는다.
4. 기본 동작의 키프레임을 확인한 뒤 앞뒤 기준 컷을 참조해 보간·전환 프레임을 만든다. 추가 컷의 실제 재생 순서는 개별 파일의 순서표를 따른다.
5. 배경은 장별 rear부터 확정해 나머지 레이어의 시점·색을 맞춘다. 기지는 정상 외형을 먼저 확정한 뒤 같은 이미지를 참조해 파손 1~3을 만든다.
6. 실제 출력 크기·투명 알파·피벗·얼굴·소품 수·옷·손발·클립 연결을 확인한 후 런타임 아틀라스·문구·기지·UI에 연결한다. PNG·코드 연결은 이번 프롬프트 작성에 포함되지 않는다.

## 공통 제작·검수 규칙

- 실제 생성에서 도구의 투명 배경 옵션을 켠다. 배경 rear 레이어만 불투명이다. 정확한 납품 크기·좌표는 생성 뒤 검수·정렬한다.
- 본체는 오른쪽 전신 측면 또는 약한 3/4 측면, 한 파일 한 포즈. 모든 동작의 카메라·기준 배율·캔버스·루트·장비 개수를 고정한다.
- 아군 9종에 제복을 입은 체형의 모핑을 적용하며, AA 아카네·히바리는 제외한다. 머리카락·의상·끈의 관성·감쇠는 두 캐릭터에도 적용한다.
- AA·A 등의 컵 표기와 키 차이를 유지한다. 모션을 위해 신체 체적·얼굴 나이·머리 크기를 바꾸거나 의상·무기를 관통시키지 않는다.
- 공격은 실제 판정 시점의 `attack_01`에 맞추고 그림 때문에 새 준비·재장전·경직·무적을 추가하지 않는다. 몸체와 큰 궤적·투사체·오라·상태 표식을 분리한다.
- 모핑·천·머리카락 움직임은 1차로 프레임 제작에 포함한다. 파일명 추가만으로 실시간 물리·메시 변형·클립 전환이 생기지 않는다.
- `motion_extension` 프레임은 제작안이며 게임의 자동 재생 대상이 아니다. fps와 전환 조건은 실제 미리보기로 정하고 이벤트 판정은 유지한다.
- 같은 효과를 재사용할 수 있어도 각 소유자별 출력 경로·팔레트를 명시했다. 동일 효과의 중복 생성은 최종 제작 단계에서 검수 후 합칠 수 있다.
- 보스·아군·적의 기본형과 이 문서에 없는 강화 파생 외형·별도 보이스·실시간 리깅 파츠는 추가 범위다. 직접 통제 30개 스킬은 개별 컨셉대로 기본 공격 모션을 우선 재사용하고 아이콘 30개를 별도 준비했다.

## 캐릭터별 프롬프트

| 분류 | 이름 | 대상 키 | 프롬프트 | 기본·고유 | 보간·전환 |
| --- | --- | --- | --- | --- | --- |
| hero | 시온 (シオン) | `hero:kkomaMudang` | [kkomaMudang-prompts.md](hero/kkomaMudang-prompts.md) | 47 | 23 |
| ally | 쿠로가네 (クロガネ) | `ally:bulgasari` | [bulgasari-prompts.md](ally/bulgasari-prompts.md) | 30 | 23 |
| ally | 아카네 (アカネ) | `ally:clubGoblin` | [clubGoblin-prompts.md](ally/clubGoblin-prompts.md) | 23 | 23 |
| ally | 아오이 (アオイ) | `ally:foxfireArcher` | [foxfireArcher-prompts.md](ally/foxfireArcher-prompts.md) | 26 | 23 |
| ally | 쿠레하 (クレハ) | `ally:gumiho` | [gumiho-prompts.md](ally/gumiho-prompts.md) | 30 | 23 |
| ally | 세이라 (セイラ) | `ally:haetae` | [haetae-prompts.md](ally/haetae-prompts.md) | 30 | 23 |
| ally | 히바리 (ヒバリ) | `ally:magpieFlock` | [magpieFlock-prompts.md](ally/magpieFlock-prompts.md) | 28 | 23 |
| ally | 하야테 (ハヤテ) | `ally:oneLegGoblin` | [oneLegGoblin-prompts.md](ally/oneLegGoblin-prompts.md) | 26 | 23 |
| ally | 레이카 (レイカ) | `ally:samjokgo` | [samjokgo-prompts.md](ally/samjokgo-prompts.md) | 30 | 23 |
| ally | 미카 (ミカ) | `ally:sumoGoblin` | [sumoGoblin-prompts.md](ally/sumoGoblin-prompts.md) | 26 | 23 |
| ally | 후우카 (フウカ) | `ally:yeongdeungWind` | [yeongdeungWind-prompts.md](ally/yeongdeungWind-prompts.md) | 32 | 23 |
| enemy | 브리처 | `enemy:dueoksini` | [dueoksini-prompts.md](enemy/dueoksini-prompts.md) | 24 | 23 |
| enemy | 워커 | `enemy:eggGhost` | [eggGhost-prompts.md](enemy/eggGhost-prompts.md) | 23 | 23 |
| enemy | 호버 | `enemy:eodduksini` | [eodduksini-prompts.md](enemy/eodduksini-prompts.md) | 26 | 23 |
| enemy | 아이언클래드 | `enemy:gangcheol` | [gangcheol-prompts.md](enemy/gangcheol-prompts.md) | 24 | 23 |
| enemy | 그로워 | `enemy:geuseundae` | [geuseundae-prompts.md](enemy/geuseundae-prompts.md) | 27 | 23 |
| enemy | 디스럽터 | `enemy:grimReaper` | [grimReaper-prompts.md](enemy/grimReaper-prompts.md) | 28 | 23 |
| enemy | 아머드 | `enemy:jangseungSpirit` | [jangseungSpirit-prompts.md](enemy/jangseungSpirit-prompts.md) | 23 | 23 |
| enemy | 스토커 | `enemy:maidenGhost` | [maidenGhost-prompts.md](enemy/maidenGhost-prompts.md) | 26 | 23 |
| enemy | 블라이터 | `enemy:sonGakshi` | [sonGakshi-prompts.md](enemy/sonGakshi-prompts.md) | 29 | 23 |
| enemy | 스피터 | `enemy:waterGhostThrower` | [waterGhostThrower-prompts.md](enemy/waterGhostThrower-prompts.md) | 26 | 23 |
| boss | 타이런트 | `boss:chasaKing` | [chasaKing-prompts.md](boss/chasaKing-prompts.md) | 29 | 23 |
| boss | 오버로드 | `boss:eodduksiniKing` | [eodduksiniKing-prompts.md](boss/eodduksiniKing-prompts.md) | 34 | 23 |
| boss | 하이브 마더 | `boss:giantWonGwi` | [giantWonGwi-prompts.md](boss/giantWonGwi-prompts.md) | 29 | 23 |
| boss | 멜트다운 | `boss:imugiGangcheol` | [imugiGangcheol-prompts.md](boss/imugiGangcheol-prompts.md) | 35 | 23 |
| boss | 저거너트 | `boss:ironJangseung` | [ironJangseung-prompts.md](boss/ironJangseung-prompts.md) | 27 | 23 |

## 테마 부가 프롬프트

- [배경·기지·파손·잠금](environment-and-bases-prompts.md): 62개.
- [UI·상태·자원·스킬 아이콘·패널](ui-and-status-prompts.md): 78개.

## 작업 목록 필드

`jobs.json`의 각 항목은 id, subject_key, section, kind, priority, output, target_size, transparent_background, references, prompt, notes를 가진다. 출력 경로와 참조 경로는 제작 예정 파일이며 파일 존재·생성 완료를 의미하지 않는다. 상대 파일 경로는 저장소 루트 기준이다.

참조 파일은 해당 작업보다 먼저 생성·검수되어야 한다. 병렬 실행 전에 references에 기록된 작업 간 의존 관계를 확인한다. 기준 원화에는 참조가 없고, 후속 프레임에는 기준 원화가 포함된다. 작업 목록을 실제 생성 도구에 연결할 때는 매 작업의 prompt 전체와 존재하는 references 이미지를 전달한다.
