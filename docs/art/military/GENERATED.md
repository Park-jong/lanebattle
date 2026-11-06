# 밀리터리 스킨 이미지 생성 기록

생성 도구: 내장 image_gen · 전체 작업: 1476개

현재 생성 파일 1476개. 작업별 검수·원본 크기 정렬·애니메이션 연결은 별도 상태로 관리한다. 이 기록은 전체 제작 완료를 의미하지 않는다.

[전체 프롬프트](prompts/README.md) · [개별 컨셉 목록](README.md) · [파일 검증 기록](generated/VALIDATION.md)

시온의 이 표·기본 원본 폴더는 자주색 포니테일·세이버를 사용한 이전 디자인 이력이다. 분홍 장발·전류 대검 리비전은 `output/art-generation/revisions/shion-electromagnetic-v2/`에서 별도 관리하며, 아래 수량에 합산하지 않는다.

2026-11-06: [시온 기본 공격 2dimg2motion 시험 적용](shion-2dimg2motion.md). 핵심 포즈 4장과 중간 프레임 8장을 내장 image_gen으로 생성하고 기준 프레임 2장을 합쳐 14프레임으로 연결했다. 원본은 `output/art-generation/revisions/shion-2dimg2motion-attack/`에 보관하며 아래 기존 생성 수에 합산하지 않는다.

같은 날 걷기도 핵심 포즈 4장과 중간 프레임 8장의 12프레임 반복으로 교체했다. 원본·납품·비교 GIF는 `output/art-generation/revisions/shion-2dimg2motion-walk/`, 실제 프롬프트는 [걷기 프롬프트 기록](prompts/shion-2dimg2motion-walk.json)에 보관한다. 게임은 공격과 걷기를 합친 motion-v2 아틀라스를 사용한다.

## 종류별 생성 상태

| 이름 | 대상 키 | 생성 수 | 기준 원화 검수 |
| --- | --- | --- | --- |
| [시온 (シオン)](../../../output/art-generation/source-assets/hero/kkomaMudang/military/idle_00.png) | `hero:kkomaMudang` | 70 | accepted reference: 23-year-old adult officer, purple ponytail, white uniform, purple cape, saber and command gauntlet. |
| [쿠로가네 (クロガネ)](../../../output/art-generation/source-assets/ally/bulgasari/military/idle_00.png) | `ally:bulgasari` | 53 | accepted reference: Inspected full-body reference: designated hairstyle, military uniform, weapon and role match concept; final canvas alignment pending. |
| [아카네 (アカネ)](../../../output/art-generation/source-assets/ally/clubGoblin/military/idle_00.png) | `ally:clubGoblin` | 46 | accepted reference: bright red twin tails, AA adult proportions, navy skirt, electric baton, knee-high boots. |
| [아오이 (アオイ)](../../../output/art-generation/source-assets/ally/foxfireArcher/military/idle_00.png) | `ally:foxfireArcher` | 49 | accepted reference: Inspected full-body reference: designated hairstyle, military uniform, weapon and role match concept; final canvas alignment pending. |
| [쿠레하 (クレハ)](../../../output/art-generation/source-assets/ally/gumiho/military/idle_00.png) | `ally:gumiho` | 53 | accepted reference: Inspected full-body reference: designated hairstyle, military uniform, weapon and role match concept; final canvas alignment pending. |
| [세이라 (セイラ)](../../../output/art-generation/source-assets/ally/haetae/military/idle_00.png) | `ally:haetae` | 53 | accepted reference: Inspected full-body reference: designated hairstyle, military uniform, weapon and role match concept; final canvas alignment pending. |
| [히바리 (ヒバリ)](../../../output/art-generation/source-assets/ally/magpieFlock/military/idle_00.png) | `ally:magpieFlock` | 51 | accepted reference: Inspected full-body reference: designated hairstyle, military uniform, weapon and role match concept; final canvas alignment pending. |
| [하야테 (ハヤテ)](../../../output/art-generation/source-assets/ally/oneLegGoblin/military/idle_00.png) | `ally:oneLegGoblin` | 49 | accepted reference: Inspected full-body reference: designated hairstyle, military uniform, weapon and role match concept; final canvas alignment pending. |
| [레이카 (レイカ)](../../../output/art-generation/source-assets/ally/samjokgo/military/idle_00.png) | `ally:samjokgo` | 53 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |
| [미카 (ミカ)](../../../output/art-generation/source-assets/ally/sumoGoblin/military/idle_00.png) | `ally:sumoGoblin` | 49 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |
| [후우카 (フウカ)](../../../output/art-generation/source-assets/ally/yeongdeungWind/military/idle_00.png) | `ally:yeongdeungWind` | 55 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |
| [브리처](../../../output/art-generation/source-assets/enemy/dueoksini/military/idle_00.png) | `enemy:dueoksini` | 47 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |
| [워커](../../../output/art-generation/source-assets/enemy/eggGhost/military/idle_00.png) | `enemy:eggGhost` | 46 | Visually checked same Walker identity; complete shoe soles and hair visible with generous transparent padding. Animation alignment pending. |
| [호버](../../../output/art-generation/source-assets/enemy/eodduksini/military/idle_00.png) | `enemy:eodduksini` | 49 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |
| [아이언클래드](../../../output/art-generation/source-assets/enemy/gangcheol/military/idle_00.png) | `enemy:gangcheol` | 47 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |
| [그로워](../../../output/art-generation/source-assets/enemy/geuseundae/military/idle_00.png) | `enemy:geuseundae` | 50 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |
| [디스럽터](../../../output/art-generation/source-assets/enemy/grimReaper/military/idle_00.png) | `enemy:grimReaper` | 51 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |
| [아머드](../../../output/art-generation/source-assets/enemy/jangseungSpirit/military/idle_00.png) | `enemy:jangseungSpirit` | 46 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |
| [스토커](../../../output/art-generation/source-assets/enemy/maidenGhost/military/idle_00.png) | `enemy:maidenGhost` | 49 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |
| [블라이터](../../../output/art-generation/source-assets/enemy/sonGakshi/military/idle_00.png) | `enemy:sonGakshi` | 52 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |
| [스피터](../../../output/art-generation/source-assets/enemy/waterGhostThrower/military/idle_00.png) | `enemy:waterGhostThrower` | 49 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |
| [타이런트](../../../output/art-generation/source-assets/boss/chasaKing/military/idle_00.png) | `boss:chasaKing` | 52 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |
| [오버로드](../../../output/art-generation/source-assets/boss/eodduksiniKing/military/idle_00.png) | `boss:eodduksiniKing` | 57 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |
| [하이브 마더](../../../output/art-generation/source-assets/boss/giantWonGwi/military/idle_00.png) | `boss:giantWonGwi` | 52 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |
| [멜트다운](../../../output/art-generation/source-assets/boss/imugiGangcheol/military/idle_00.png) | `boss:imugiGangcheol` | 58 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |
| [저거너트](../../../output/art-generation/source-assets/boss/ironJangseung/military/idle_00.png) | `boss:ironJangseung` | 50 | accepted reference: Inspected full-body reference: faction, main silhouette, equipment and creature/machine role match concept; animation and final pivot alignment pending. |

## 원본·진행 파일

- 캐릭터 원본: `output/art-generation/source-assets/<분류>/<종류ID>/military/`.
- 배경·기지·UI 원본: `output/art-generation/military-theme/`.
- 작업 상태: `output/art-generation/military-run/progress.sqlite3` 및 `status.json`.
- 생성 출처·실제 프롬프트·해상도: `output/art-generation/military-run/generated.jsonl`.
- 외형 불일치 결과는 같은 run 폴더의 `rejected/`에 보존하고 후속 동작의 참조에서 제외한다.
- 생성 출력의 원래 RGBA와 투명 알파를 보존한다. 목표 크기와 다른 파일은 기록 후 정렬 검수 대상으로 남긴다.
