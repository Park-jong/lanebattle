# 시온 전류 대검 리비전 — 생성·패키지 기록

2026-11-05 · 내장 `image_gen` · 새 디자인 74장 생성, 16개 클립 패키징 완료 · 실행 게임 미연결.

[시온 컨셉](kkomaMudang.md) · [모션 미리보기](../../../../output/art-generation/revisions/shion-electromagnetic-v2/package/preview.html) · [전체 패키지 ZIP](../../../../output/art-generation/revisions/shion-electromagnetic-v2/shion-electromagnetic-v2.zip)

분홍색의 풀어 내린 긴 머리, 가슴선·복부·허벅지가 드러나는 크롭 장교 제복, 청백색 전류가 흐르는 대형 전자기 대검으로 제작했다. 머리 위 링·헤일로와 포니테일은 없다. 새 기준 원화를 모든 본체·아이콘·미리보기·타이틀의 참조로 사용했다. 연속 동작에는 이전 자세와 보간 대상도 참조했다.

| 종류 | 프레임 수 | 미리보기 |
| --- | --- | --- |
| 대기 | 8 | [idle.gif](../../../../output/art-generation/revisions/shion-electromagnetic-v2/package/idle.gif) |
| 걷기 | 8 | [walk.gif](../../../../output/art-generation/revisions/shion-electromagnetic-v2/package/walk.gif) |
| 기본 공격 | 6 | [attack.gif](../../../../output/art-generation/revisions/shion-electromagnetic-v2/package/attack.gif) |
| 피격 | 4 | [hit.gif](../../../../output/art-generation/revisions/shion-electromagnetic-v2/package/hit.gif) |
| 등장 / 퇴장 | 3 / 4 | [등장](../../../../output/art-generation/revisions/shion-electromagnetic-v2/package/spawn.gif) · [퇴장](../../../../output/art-generation/revisions/shion-electromagnetic-v2/package/death.gif) |
| Q / W / E 본체 | 각 4 | [Q](../../../../output/art-generation/revisions/shion-electromagnetic-v2/package/skill_fan.gif) · [W](../../../../output/art-generation/revisions/shion-electromagnetic-v2/package/skill_blessing.gif) · [E](../../../../output/art-generation/revisions/shion-electromagnetic-v2/package/skill_blade.gif) |
| 이동 시작 / 정지 / 방향 전환 | 각 3 | [시작](../../../../output/art-generation/revisions/shion-electromagnetic-v2/package/start.gif) · [정지](../../../../output/art-generation/revisions/shion-electromagnetic-v2/package/stop.gif) · [전환](../../../../output/art-generation/revisions/shion-electromagnetic-v2/package/turn.gif) |
| Q / W / E 효과 | 각 4 | 본체와 별도 PNG·클립 |
| 기본 베기 전류 잔상 | 2 | 기존 `fx_saber_edge` 키 유지 |
| 얼굴 아이콘 / 전신 미리보기 | 각 1 | 새 원화에서 파생 |
| Q / W / E 스킬 아이콘 / 타이틀 | 각 1 | 별도 UI 자산 |
| 합계 | **74** | 본체 54 + 효과 14 + 아이콘·미리보기 2 + UI 4 |

## 보관·연결

- 원본과 출처: `output/art-generation/revisions/shion-electromagnetic-v2/raw/` 및 `animation-jobs.json`. 작업마다 실행 프롬프트·참조·도구 원본 경로·실제 크기·알파를 기록했다.
- 정렬본: 같은 리비전의 `package/frames/`. 본체는 2048×2048 투명 캔버스, 피벗 `(0.5, 0.875)`, 대기 인체 높이 900px. 기존 768×1024 제작 제안보다 캔버스를 넓혀 올려 든 대검과 좌우 베기를 수용한다. 무기 여백은 충돌 크기로 사용하지 않는다.
- 정렬 방법: 원본을 보존하며 동일한 가로·세로 배율과 평행 이동만 적용했다. 머리와 부츠 재질을 사용한 기준점 추정·포즈별 높이를 `alignment.json`에 기록했다. 실제 전장 축척·발 미끄러짐·겹침은 게임 연결 시 추가 검수한다.
- 재생 데이터: `package/skin.json`에 16개 클립의 파일 순서·fps·반복 설정을 기록했다. `attack_01`이 실제 타격 컷이다. 대기·걷기·공격·피격 보간은 숫자순 재생이 아니다.
- 아틀라스: `package/runtime/hero-kkomaMudang-military-v2.png`·`.json`, 2048×2840, 74개 프레임. 본체는 256×256의 같은 좌표계를 사용한다. `manifest.json`은 기존 `CharacterArt` 구조의 영웅 한 종 패키지다.
- 기존 원본 폴더의 자주색 포니테일·세이버 47장은 이전 디자인의 이력으로 보존했다. 공통 자동 생성 기록의 기존 시온 수와 이번 74장을 혼합하지 않는다. 새 리비전의 진행·검수는 이 문서와 리비전 JSON을 따른다.

## 검수와 현재 한계

74개 원본을 열어 PNG·RGBA·투명 알파를 확인했고 누락·동일 파일 중복이 없음을 검사했다. 프레임별 모습과 정렬 비교 시트에서 분홍 머리·제복·전류 대검, 공격·걷기·스킬·낮아지는 퇴장 자세를 확인했다. W 준비 컷의 손 중복과 공격 마지막 컷의 높은 검 자세를 재생성해 보정했고 이전 결과는 `rejected/`에 보존했다.

브라우저 연결 도구의 환경 오류로 자동 클릭 검수는 실행하지 못했다. GIF 16개의 프레임 수·디코딩, 정렬 비교 시트, 아틀라스 범위·키와 ZIP 무결성을 별도로 검사했다. 미리보기 스크립트는 Node VM에서 16개 클립 전환·일시정지·프레임 이동·공격 타격 컷·걷기 보간 순서·좌우 반전 로직을 확인했다. 결과는 패키지의 `validation.json`에 기록했다. 이 기록은 실행 게임에서의 검수 완료를 뜻하지 않는다.

현재 기본 게임 manifest·전투 코드·테마 선택에는 연결하지 않았다. `start`·`stop`·`turn` 자동 전환, Q/W/E 효과의 실제 반경·피벗·재생 시점, 스킬 UI·타이틀 교체는 밀리터리 테마 적용 때 연결한다. 공격력·공격 간격·사거리·스킬 판정은 이번 제작으로 변경하지 않았다.

재검사: `python scripts/shion-art-revision.py audit`. 패키지 재생성: `python scripts/package-shion-art.py`. 두 스크립트는 이미지 API를 호출하지 않는다.
