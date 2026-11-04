# 명품녀 경호대장 — 이미지 생성 콘셉트·프롬프트

작성일: 2026-11-04 · 상태: 이미지 생성 전 · 실제 이미지 생성은 별도 작업

[캐릭터·모션 명세](../../units/ally/luxuryLady.md) · [공통 이미지 콘셉트](../../image-generation-concept.md) · [전체 목록](../../README.md)

## 이 이미지의 목적

`idle_00.png` 기준 전신을 먼저 확정한 뒤 아래 공통 19컷과 고유 동작 컷 전체를 만든다. `reference.png`는 승인 대기 컷의 별칭이다. **이미지 한 장에 한 포즈**는 생성 단위이며, 스킨 한 벌을 한 장으로 끝낸다는 뜻이 아니다.

- 연령·대상: 31세 성인 여성
- 구도: 왼팔의 하드케이스를 몸 옆앞에 세우고 오른손은 전방을 향해 펼친다. 얼굴·재킷과 양발이 보이는 오른쪽 3/4 전신
- 출력 목표: 1024×1536px 투명 PNG. 생성 도구가 정확한 크기를 지원하지 않으면 가장 가까운 세로·가로 비율로 생성하고 승인 후 여백을 조정한다. 인물을 비균일하게 늘이지 않는다.
- 외형 고정점: 성인 여성·검정 롱보브·아이보리 재킷·레드 립을 유지한다. / 명품 분위기는 재단과 금속 장식으로 표현하며 실제 로고를 쓰지 않는다. / 금색 하드케이스는 1개이며 왼팔에 연결, 오른손은 비워 둔다.
- 제외: 현실 명품 로고·모노그램, 불안정한 스틸레토, 쇼핑백 다발로 전환, 남성 경호대장, 무적 방패처럼 보이는 상시 효과
- 최초 생성은 아래 프롬프트를 사용한다. 후속 생성은 승인 원화를 실제 이미지 참조로 첨부한다.

## 첫 컷 idle_00.png 생성 프롬프트

아래 외형·구도·색상 블록으로 첫 대기 컷을 생성하고 승인된 동일 캐릭터로 나머지 컷을 이어 만든다.

```text
Create a polished 2D anime game character illustration for a modern convention-city lane-defense game. Crisp expressive line art, clean cel shading with soft material highlights, coherent commercial anime illustration style, full-size natural anatomy, not chibi or super-deformed. Eye-level camera, restrained three-quarter side view facing RIGHT, one isolated full-body asset on a genuinely transparent background. Keep the entire silhouette, shoes and equipment inside the canvas with generous margins. No scenery, floor, ground shadow, text, lettering, logos, watermark, border or UI. Separate broad VFX and projectiles from the body.

An adult 31-year-old elegant luxury-fashion woman acting as a protective frontline captain. Mature seven-and-a-half to eight-head-tall figure, full bust, poised shoulders and grounded legs. Sleek black long bob, dark-brown eyes, restrained red lipstick, sunglasses resting on her head, small gold stud earrings. Tailored ivory jacket over an opaque black top, belt, wide-leg trousers, black gloves and stable low broad-heeled leather ankle boots. Exactly one large rectangular champagne-gold hard-shell luxury travel case used as a shield, secured to the left forearm with an internal handle and short strap. Her right hand stays free. Original unbranded luxury design with no logos.

Pose: Right-facing three-quarter guard stance, large case upright to the front-left side without hiding the face and outfit, right palm extended to stop an approaching target.
Color palette: 아이보리 #F0E8D9, 샴페인 골드 #CBB37A, 검정 #292730, 립 레드 #A84250.
Preserve these identity landmarks: adult luxury-fashion woman; black long bob; ivory tailored jacket; one champagne-gold rectangular case shield on left arm; free right hand; no real brands
Deliver one pose of one character in one image. Do not make a turnaround sheet, sprite sheet, collage or multiple alternate designs.
```

## 동작별 컷 생성 프롬프트

이 스킨의 본체는 **공통 19컷 + 고유 본체 7컷 = 26컷**이다. 효과 PNG 2컷과 감상·표정 이미지 7장은 별도다.

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
Use the attached approved idle_00 character asset as the strict identity reference. Create exactly ONE animation frame for [FRAME_FILE]. Pose change: [FRAME_POSE]. Preserve the approved face or mechanical design, adult body proportions where applicable, costume, palette, complete weapon identity, equipment count, handedness and attachment structure. Keep the SAME canvas, camera angle, RIGHT-facing orientation, scale and pivot. No lettering, baked-in filename, scenery, UI, cast ground shadow, projectiles or broad effects. Genuine transparent background. Keep the entire body and all weapon parts inside the canvas. This is one frame in a required multi-frame skin set, not a new design, sprite sheet or collage.
```

### 본체 프레임

| 파일명 | 해당 컷에 그릴 자세·내용 |
| --- | --- |
| `idle_00.png` | 기준 대기 자세: 케이스를 세워 지지하고 턱을 약간 든 채 느리게 호흡 얼굴·몸체·무기 전체를 확정한다. |
| `idle_01.png` | 기준 자세에서 작은 호흡의 반대 위상. 가슴은 재킷의 지지력 안에서 무게감 있게 짧게 감쇠한다. 케이스는 단단한 물체로 유지하고 머리 끝·재킷만 작은 후행을 둔다. 발·기체 피벗과 몸체 비율은 유지한다. |
| `walk_00.png` | 왼발 접지·오른발 뒤, 캐릭터별 무기를 기존 손에 지지. 이동 성격: 짧고 안정된 왼발 전진 → 통과 → 오른발 전진 → 통과. 케이스는 전방 방어 위치 유지 |
| `walk_01.png` | 오른발 통과·중심 이동, 무기와 손의 연결 유지. 이동 성격: 짧고 안정된 왼발 전진 → 통과 → 오른발 전진 → 통과. 케이스는 전방 방어 위치 유지 |
| `walk_02.png` | 오른발 접지·왼발 뒤, 머리·옷자락이 작게 후행. 이동 성격: 짧고 안정된 왼발 전진 → 통과 → 오른발 전진 → 통과. 케이스는 전방 방어 위치 유지 |
| `walk_03.png` | 왼발 통과·중심 회복, 첫 접지 컷으로 자연스럽게 연결. 이동 성격: 짧고 안정된 왼발 전진 → 통과 → 오른발 전진 → 통과. 케이스는 전방 방어 위치 유지 |
| `attack_00.png` | 케이스 방패를 몸 앞에 고정 |
| `attack_01.png` | 케이스 보강 모서리로 전방 밀어치기 |
| `attack_02.png` | 왼팔·어깨가 짧게 반동 |
| `attack_03.png` | 케이스와 빈손을 방어 위치로 복귀 |
| `hit_00.png` | 케이스 뒤로 중심을 낮추며 상체가 짧게 흔들림. 전투 위치·키·피벗은 고정한다. |
| `hit_01.png` | 기본 대기 자세로 회복. 무기·손·발·기체의 부착 관계 유지 |
| `spawn_00.png` | 등장 시작 대표 자세: 케이스를 세우며 라운지 앞에 자리를 잡음. 실제 진입 이동은 View에서 처리 |
| `spawn_01.png` | 기준 자세를 향한 중간 준비 포즈. 얼굴·무기·장비는 기준 원화와 동일 |
| `spawn_02.png` | idle_00의 기준 대기 자세와 연결. 개체 생성·무적 판정은 추가하지 않음 |
| `death_00.png` | 퇴장 시작: 케이스를 몸 가까이 당기고 아군을 돌아보며 후퇴. 무기·장비는 손과 몸에 유지 |
| `death_01.png` | 퇴장 직전 몸을 낮추거나 중심을 뒤로 물린 자세. 카메라·피벗·캔버스 유지 |
| `death_02.png` | 직전 자세의 전체 알파를 줄여 사라지는 중간 컷. 인물·장비를 따로 떨어뜨리지 않음 |
| `death_03.png` | 퇴장 완료의 완전 투명 PNG. 앞 컷과 같은 캔버스로 내보내며 새 캐릭터를 생성하지 않음 |
| `grab_00.png` | 케이스를 세우고 빈손을 전방에 뻗음 |
| `grab_01.png` | 빈손을 오므려 제지 자세 유지. 상대 인물은 합성하지 않음 |
| `grab_02.png` | 손을 풀어 방어 자세로 회복 |
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
| `fx_guard_00.png` | 케이스 앞에 짧은 금빛 충격 테두리. 상시 무적막처럼 보이지 않게 함의 첫 위상 |
| `fx_guard_01.png` | 케이스 앞에 짧은 금빛 충격 테두리. 상시 무적막처럼 보이지 않게 함의 둘째 위상. 반복 효과는 첫 컷으로 연결, 일회성은 약화 |

```text
Create exactly ONE isolated static anime game VFX frame for [FRAME_FILE], based on [FRAME_POSE]. Preserve the specified shape, direction and palette across the effect sequence. Genuine transparent background, complete effect inside the canvas with padding. No person, device body, scenery, lettering, UI or sprite sheet. For an armor overlay, include only the additional plates aligned to the approved body canvas and pivot, not the human or base armor.
```

## 감상·표정·컷인 생성 목록

| 파일명 | 해당 컷에 그릴 자세·내용 |
| --- | --- |
| `portrait.png` | 1024×1024px 얼굴·상반신 감상용 이미지 |
| `expressions/expression_00.png` | 1024×1024px 여유로운 미소. 동일 얼굴·머리·의상과 카메라 각도 유지 |
| `expressions/expression_01.png` | 1024×1024px 단호한 경고. 동일 얼굴·머리·의상과 카메라 각도 유지 |
| `expressions/expression_02.png` | 1024×1024px 차가운 집중. 동일 얼굴·머리·의상과 카메라 각도 유지 |
| `expressions/expression_03.png` | 1024×1024px 만족. 동일 얼굴·머리·의상과 카메라 각도 유지 |
| `preview.png` | 1024×1024px 대표 전신. reference와 동일 비율로 여백 배치 |
| `icon.png` | 256×256px 얼굴·대표 장비 중심, 문자·테두리 제외 |

상반신·아이콘·표정은 승인 전신과 동일한 얼굴·체형·머리·의상·무기를 유지한다. 스킬 컷인은 본체 PNG와 분리한다. 큰 발사광과 탄환을 본체나 컷인에 영구 합성하지 않는다.

## 캐릭터별 일관성 확인

- 성인 여성·검정 롱보브·아이보리 재킷·레드 립을 유지한다.
- 명품 분위기는 재단과 금속 장식으로 표현하며 실제 로고를 쓰지 않는다.
- 금색 하드케이스는 1개이며 왼팔에 연결, 오른손은 비워 둔다.

보조 모션 목표: 가슴은 재킷의 지지력 안에서 무게감 있게 짧게 감쇠한다. 케이스는 단단한 물체로 유지하고 머리 끝·재킷만 작은 후행을 둔다.

바스트·머리카락·의상은 지정된 컷별 후행 위상을 프레임으로 제작한다. 리깅은 이 프레임을 만드는 선택 보조 수단이다. 정지 이미지 한 장에 애니메이션이나 숨은 PSD 레이어가 생성되었다고 취급하지 않는다. 파츠가 필요하면 승인 원화 편집과 가림 영역 복원을 별도로 진행한다.

## 결과 승인과 기록

- [ ] 한 이미지에 의도한 캐릭터·장비만 있으며 전신과 소품이 잘리지 않았다.
- [ ] 성인 비율·고유 얼굴·체형·머리·팔레트가 명세와 맞는다.
- [ ] 손가락·팔다리·소품 수가 맞고, 떠 있는 장비의 연결 구조가 자연스럽다.
- [ ] 실제 알파 배경이며 체크무늬나 흰 배경이 그림으로 들어가지 않았다.
- [ ] 개별 명세의 제외 사항과 공통 화풍 규칙을 만족한다.
- [ ] 원화 승인 후 같은 참조로 변형했으며, 파일별 출처와 수정 내역을 남겼다.

제작 기록: 생성 도구·모델 / 생성일 / 사용 프롬프트 / 참조 이미지 / 승인 원화 파일명 / 수정 이력 / 이용 조건을 실제 제작 시 기입한다.
