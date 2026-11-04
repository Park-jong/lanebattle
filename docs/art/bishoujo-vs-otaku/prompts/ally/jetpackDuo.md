# 스트리트 제트팩 자매 — 이미지 생성 콘셉트·프롬프트

작성일: 2026-11-04 · 상태: 이미지 생성 전 · 실제 이미지 생성은 별도 작업

[캐릭터·모션 명세](../../units/ally/jetpackDuo.md) · [공통 이미지 콘셉트](../../image-generation-concept.md) · [전체 목록](../../README.md)

## 이 이미지의 목적

`idle_00.png` 기준 전신을 먼저 확정한 뒤 아래 공통 19컷과 고유 동작 컷 전체를 만든다. `reference.png`는 승인 대기 컷의 별칭이다. **이미지 한 장에 한 포즈**는 생성 단위이며, 스킨 한 벌을 한 장으로 끝낸다는 뜻이 아니다.

- 연령·대상: 24세·26세 성인 여성 두 명
- 구도: 오른쪽을 보는 두 성인 여성의 전신 편대. 앞사람 오른쪽 위·뒤사람 왼쪽 아래, 두 사람 모두 오른손 권총을 전방 아래에 들고 빈손으로 균형
- 출력 목표: 1536×1536px 투명 PNG. 생성 도구가 정확한 크기를 지원하지 않으면 가장 가까운 세로·가로 비율로 생성하고 승인 후 여백을 조정한다. 인물을 비균일하게 늘이지 않는다.
- 외형 고정점: 정확히 두 명의 성인 여성과 두 사람의 전신을 유지한다. / 앞사람 검정 단발·뒤사람 은회색 포니테일을 유지한다. / 제트팩 총 2개·오른손 권총 총 2정이며 한 전투 유닛이다.
- 제외: 합쳐진 몸, 세 번째 사람, 무인 드론, 아동 자매, 추가 총·손목 발사기
- 최초 생성은 아래 프롬프트를 사용한다. 후속 생성은 승인 원화를 실제 이미지 참조로 첨부한다.

## 첫 컷 idle_00.png 생성 프롬프트

아래 외형·구도·색상 블록으로 첫 대기 컷을 생성하고 승인된 동일 캐릭터로 나머지 컷을 이어 만든다.

```text
Create a polished 2D anime game character illustration for a modern convention-city lane-defense game. Crisp expressive line art, clean cel shading with soft material highlights, coherent commercial anime illustration style, full-size natural anatomy, not chibi or super-deformed. Eye-level camera, restrained three-quarter side view facing RIGHT, one isolated full-body asset on a genuinely transparent background. Keep the entire silhouette, shoes and equipment inside the canvas with generous margins. No scenery, floor, ground shadow, text, lettering, logos, watermark, border or UI. Separate broad VFX and projectiles from the body.

Exactly TWO clearly adult female street courier sisters, ages 24 and 26, presented together as one coordinated airborne formation asset. Each has natural seven to seven-and-a-half-head-tall anatomy and a small-to-medium bust. The leading woman has a black bob and blue eyes; the trailing woman has a short silver-gray ponytail and dark-gray eyes. Both wear black-and-white street rider jackets, full-length functional trousers, gloves, boots and a blue visor resting above the forehead. Each wears exactly one compact blue backpack jetpack, TWO jetpacks total, and exactly one black-and-white pistol in each woman's right hand, TWO pistols total. Both complete women are visible and anatomically separate.

Pose: Right-facing diagonal formation, leader upper-right and second woman lower-left; each holds one complete pistol in the right hand and keeps the left hand free for balance. All bodies, jetpacks and pistols visible.
Color palette: 검정 #242A34, 백색 #E8EDF1, 청색 #5DACE1, 은회색 #B4C0C9.
Preserve these identity landmarks: exactly two adult women; black bob and silver ponytail; exactly two jetpacks and two right-hand pistols; one formation
Deliver one pose of exactly two adult women forming one readable unit in one image. Do not make a turnaround sheet, sprite sheet, collage or multiple alternate designs.
```

## 동작별 컷 생성 프롬프트

이 스킨의 본체는 **공통 19컷 + 고유 본체 4컷 = 23컷**이다. 효과 PNG 2컷과 감상·표정 이미지 7장은 별도다.

| 동작 | 파일 범위 | 컷 수 |
| --- | --- | --- |
| 대기 | `idle_00.png` ~ `idle_01.png` | 2 |
| 이동·롤러·비행 | `walk_00.png` ~ `walk_03.png` | 4 |
| 기본 공격 | `attack_00.png` ~ `attack_03.png` | 4 |
| 피격 | `hit_00.png` ~ `hit_01.png` | 2 |
| 등장·부활 | `spawn_00.png` ~ `spawn_02.png` | 3 |
| 퇴장 | `death_00.png` ~ `death_03.png` | 4 |
| 공통 본체 합계 | 모든 스킨에 동일하게 적용 | **19** |

승인된 `idle_00.png`를 참조 이미지로 첨부하고 아래 표의 **한 행씩** 생성한다. `[FRAME_FILE]`에는 해당 파일명, `[FRAME_POSE]`에는 컷 설명을 넣는다. 직전 컷도 함께 참조할 수 있지만 얼굴·체형·무기의 기준은 항상 승인 대기 컷이다. 같은 이미지를 이름만 바꿔 이동·공격 컷을 채우지 않는다.

```text
Use the attached approved idle_00 character asset as the strict identity reference. Create exactly ONE animation frame for [FRAME_FILE]. Pose change: [FRAME_POSE]. Preserve the approved face or mechanical design, adult body proportions where applicable, costume, palette, complete weapon identity, equipment count, handedness and attachment structure. Keep the SAME canvas, camera angle, RIGHT-facing orientation, scale and pivot. Preserve exactly TWO complete adult women, TWO jetpacks and TWO right-hand pistols in the same formation. No lettering, baked-in filename, scenery, UI, cast ground shadow, projectiles or broad effects. Genuine transparent background. Keep the entire body and all weapon parts inside the canvas. This is one frame in a required multi-frame skin set, not a new design, sprite sheet or collage.
```

### 본체 프레임

| 파일명 | 해당 컷에 그릴 자세·내용 |
| --- | --- |
| `idle_00.png` | 기준 대기 자세: 두 사람이 작은 폭으로 부유하며 고도 간격을 유지 얼굴·몸체·무기 전체를 확정한다. |
| `idle_01.png` | 기준 자세에서 작은 호흡의 반대 위상. 가슴은 지지된 기능성 의상에 맞춰 작게 움직인다. 짧은 머리·재킷 끝의 후행과 두 명 사이의 부유 위상 차이를 둔다. 발·기체 피벗과 몸체 비율은 유지한다. |
| `walk_00.png` | 두 여성의 편대 간격·권총·제트팩 위치 고정. 이동 성격: 한 편대가 같은 속도로 수평 이동하고 각 인물의 무릎과 추진 장비가 작게 기울어짐 |
| `walk_01.png` | 두 제트팩을 작게 전방 기울이고 무릎 보정. 이동 성격: 한 편대가 같은 속도로 수평 이동하고 각 인물의 무릎과 추진 장비가 작게 기울어짐 |
| `walk_02.png` | 수평 전진 자세·두 사람의 머리 후행. 이동 성격: 한 편대가 같은 속도로 수평 이동하고 각 인물의 무릎과 추진 장비가 작게 기울어짐 |
| `walk_03.png` | 기울기를 복구하며 첫 편대 자세로 연결. 이동 성격: 한 편대가 같은 속도로 수평 이동하고 각 인물의 무릎과 추진 장비가 작게 기울어짐 |
| `attack_00.png` | 두 여성이 각 오른손 권총을 전방으로 조준 |
| `attack_01.png` | 한 유닛 공격 이벤트에 권총 발사 자세 |
| `attack_02.png` | 두 인물의 작은 팔 반동, 편대 간격 유지 |
| `attack_03.png` | 권총을 낮추고 같은 편대 위치로 복귀 |
| `hit_00.png` | 두 사람이 잠깐 서로 다른 각도로 기울었다 편대 위치 복귀. 실제로 두 개체로 분리하지 않음. 전투 위치·키·피벗은 고정한다. |
| `hit_01.png` | 기본 대기 자세로 회복. 무기·손·발·기체의 부착 관계 유지 |
| `spawn_00.png` | 등장 시작 대표 자세: 두 사람이 라운지 쪽에서 같은 편대로 떠올라 진입. 실제 진입 이동은 View에서 처리 |
| `spawn_01.png` | 기준 자세를 향한 중간 준비 포즈. 얼굴·무기·장비는 기준 원화와 동일 |
| `spawn_02.png` | idle_00의 기준 대기 자세와 연결. 개체 생성·무적 판정은 추가하지 않음 |
| `death_00.png` | 퇴장 시작: 추진 방향을 아군 쪽으로 돌려 같은 편대로 퇴장. 무기·장비는 손과 몸에 유지 |
| `death_01.png` | 퇴장 직전 몸을 낮추거나 중심을 뒤로 물린 자세. 카메라·피벗·캔버스 유지 |
| `death_02.png` | 직전 자세의 전체 알파를 줄여 사라지는 중간 컷. 인물·장비를 따로 떨어뜨리지 않음 |
| `death_03.png` | 퇴장 완료의 완전 투명 PNG. 앞 컷과 같은 캔버스로 내보내며 새 캐릭터를 생성하지 않음 |
| `bust_idle_00.png` | 전신 기준 호흡 자세. 발과 무기는 고정, 상체·가슴·의상의 기준 형태 |
| `bust_idle_01.png` | 작은 들숨으로 몸통이 먼저 움직이는 위상. 가슴 부피·옷의 재단 유지 |
| `bust_idle_02.png` | 몸통 움직임이 멈추고 가슴·머리·옷이 약간 늦게 따라오는 위상 |
| `bust_idle_03.png` | 작은 날숨과 후행 감쇠. 첫 컷으로 자연스럽게 연결 |

- 이 목록은 `default`와 같은 캐릭터의 모든 추가 의상 스킨에 적용한다. 스킨마다 자체 프레임 묶음을 제작한다.
- 이동 클립의 파일명은 비행·롤러도 `walk_00.png ~ walk_03.png`를 사용한다. 실제 자세는 아래 전용 포즈를 따른다.
- `exit` 연기의 납품 파일명은 기존 기본 스킨과 같은 `death_00.png ~ death_03.png`다. 다른 동작을 임의로 `fly_`·`exit_`로 중복 납품하지 않는다.
- `reference.png`는 승인된 `idle_00.png`의 복사·별칭이다. 공통 본체 19컷에 한 컷을 더하지 않는다.
- 공통 19컷과 고유 전신 컷은 같은 캔버스·배율·피벗·방향을 유지한다. 효과·상반신 컷인은 별도 규격이다.
- `death_03.png`는 같은 크기의 완전 투명 파일로 내보낸다. 다른 퇴장 컷은 본체와 장비가 함께 사라지게 한다.
- 여성의 `bust_idle_00.png ~ bust_idle_03.png`도 동일한 전신 캔버스를 사용한다. 전투 대기 보조 클립과 선택 화면의 상반신 크롭에 재사용한다.
- 리깅을 사용해도 최종 납품은 아래 동작별 PNG와 프레임 목록이다. 리깅 데이터·파츠는 제작 보조 자료로 둔다.

## 별도 효과·상태 파일 생성

효과는 본체와 분리해 아래 파일별로 만든다. 갑옷 오버레이는 원화와 동일한 캔버스·피벗에 맞추고, 상태 JSON은 이미지 생성 대상에서 제외한다.

| 파일명 | 해당 컷에 그릴 자세·내용 |
| --- | --- |
| `fx_intercept_00.png` | 실제 공격 때의 작은 청백색 요격 광선. 발사 수로 추가 피해를 암시하지 않음의 첫 위상 |
| `fx_intercept_01.png` | 실제 공격 때의 작은 청백색 요격 광선. 발사 수로 추가 피해를 암시하지 않음의 둘째 위상. 반복 효과는 첫 컷으로 연결, 일회성은 약화 |

```text
Create exactly ONE isolated static anime game VFX frame for [FRAME_FILE], based on [FRAME_POSE]. Preserve the specified shape, direction and palette across the effect sequence. Genuine transparent background, complete effect inside the canvas with padding. No person, device body, scenery, lettering, UI or sprite sheet. For an armor overlay, include only the additional plates aligned to the approved body canvas and pivot, not the human or base armor.
```

## 감상·표정·컷인 생성 목록

| 파일명 | 해당 컷에 그릴 자세·내용 |
| --- | --- |
| `portrait.png` | 1024×1024px 두 성인 여성의 얼굴·상반신이 함께 보이는 감상용 이미지 |
| `expressions/expression_00.png` | 1024×1024px 둘의 자신만만한 미소. 동일 얼굴·머리·의상과 카메라 각도 유지 |
| `expressions/expression_01.png` | 1024×1024px 앞사람 집중·뒤사람 경계. 동일 얼굴·머리·의상과 카메라 각도 유지 |
| `expressions/expression_02.png` | 1024×1024px 둘의 놀람. 동일 얼굴·머리·의상과 카메라 각도 유지 |
| `expressions/expression_03.png` | 1024×1024px 둘의 승리 미소. 동일 얼굴·머리·의상과 카메라 각도 유지 |
| `preview.png` | 1024×1024px 대표 전신. reference와 동일 비율로 여백 배치 |
| `icon.png` | 256×256px 두 얼굴을 함께 배치 |

상반신·아이콘·표정은 승인 전신과 동일한 얼굴·체형·머리·의상·무기를 유지한다. 스킬 컷인은 본체 PNG와 분리한다. 큰 발사광과 탄환을 본체나 컷인에 영구 합성하지 않는다.

## 캐릭터별 일관성 확인

- 정확히 두 명의 성인 여성과 두 사람의 전신을 유지한다.
- 앞사람 검정 단발·뒤사람 은회색 포니테일을 유지한다.
- 제트팩 총 2개·오른손 권총 총 2정이며 한 전투 유닛이다.

보조 모션 목표: 가슴은 지지된 기능성 의상에 맞춰 작게 움직인다. 짧은 머리·재킷 끝의 후행과 두 명 사이의 부유 위상 차이를 둔다.

바스트·머리카락·의상은 지정된 컷별 후행 위상을 프레임으로 제작한다. 리깅은 이 프레임을 만드는 선택 보조 수단이다. 정지 이미지 한 장에 애니메이션이나 숨은 PSD 레이어가 생성되었다고 취급하지 않는다. 파츠가 필요하면 승인 원화 편집과 가림 영역 복원을 별도로 진행한다.

## 결과 승인과 기록

- [ ] 한 이미지에 의도한 캐릭터·장비만 있으며 전신과 소품이 잘리지 않았다.
- [ ] 성인 비율·고유 얼굴·체형·머리·팔레트가 명세와 맞는다.
- [ ] 손가락·팔다리·소품 수가 맞고, 떠 있는 장비의 연결 구조가 자연스럽다.
- [ ] 실제 알파 배경이며 체크무늬나 흰 배경이 그림으로 들어가지 않았다.
- [ ] 개별 명세의 제외 사항과 공통 화풍 규칙을 만족한다.
- [ ] 원화 승인 후 같은 참조로 변형했으며, 파일별 출처와 수정 내역을 남겼다.

제작 기록: 생성 도구·모델 / 생성일 / 사용 프롬프트 / 참조 이미지 / 승인 원화 파일명 / 수정 이력 / 이용 조건을 실제 제작 시 기입한다.
