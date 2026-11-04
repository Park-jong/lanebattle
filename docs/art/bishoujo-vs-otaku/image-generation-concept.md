# 미소녀 VS 오타쿠 — 이미지 생성 공통 콘셉트

작성일: 2026-11-04 · 상태: 제작 전 아트 디렉션·생성 지침

[28종 목록·개별 프롬프트](README.md) · [상위 테마 기획](../../skin-concept-bishoujo-vs-otaku.md)

## 1. 만들려는 화면

현대 도심의 대형 서브컬처 행사장에서 성인 미소녀 주인공과 다양한 스타일의 여성 아군이 오타쿠 군단을 밀어내는 횡스크롤 라인 디펜스다. **전투 본체부터 정상 비율의 전신 일러스트**를 사용한다. 선택 화면만 고해상도 미소녀이고 전투에서는 SD로 바뀌는 구성은 사용하지 않는다.

화풍은 상업 애니메이션 게임의 선명한 캐릭터 일러스트다. 깔끔한 선화, 읽기 쉬운 셀 채색, 머리·가죽·금속·천을 구분하는 절제된 하이라이트를 사용한다. 기존 무당 테마의 한지·오방색·요괴 카툰 대신 현대 의상·촬영 장비·무대 조명·총기와 근접 무기·도시 행사장으로 통일한다.

- 주인공: AK의 빈유 츤데레·M4의 중간급 상냥한 형·바렛의 폭유급 누님계 중 한 명. 모두 성인 여성이고 얼굴·체형·총기·반동을 구분한다.
- 아군: 전원 성인 여성. 갸루, 스포티, 운동계 언니, 인스타 셀럽, 고딕, 톰보이, 명품녀, 아이돌, 스트리트 라이더, DJ 스타일을 섞는다.
- 적: 무단 접근·연락 강요·훈수·통제 등 행동이 성격을 드러내는 코미디 악역. 보라·회색 계열과 무거운 소품으로 아군과 구분한다.
- 기계: 적 일반 비행 유닛은 무인 촬영 드론이다. 아군 비행 유닛은 여성 인물의 전신이 보이는 탑승·착용 장비다.
- 조명: 캐릭터 기본 광원은 약한 좌상단의 부드러운 중성광. 배경이 바뀌어도 피부색이 크게 바뀌지 않게 한다.
- 해부학: 인간은 대략 7~8등신, 자연스러운 성인 얼굴과 관절. 풍만함은 캐릭터별 고정 디자인이며 프레임마다 바뀌지 않는다.

## 2. 구성 요소별 규격

| 대상 | 제작 캔버스 제안 | 구도·기준 |
| --- | --- | --- |
| 주인공 | 1536×2048px | 오른쪽 약한 3/4 측면의 전신, 발 기준 (0.5, 0.90) |
| 일반 인간형 | 1024×1536px | 전신과 소품 포함, 발 기준 (0.5, 0.90) |
| 세로형 보스 | 1536×2048px | 정상 인체 비율 유지, 전신·장비 포함 |
| 방송 카트 보스 | 2048×1536px | 사람과 지상 카트 전체, 동일 지면 |
| 제트팩 자매·촬영 감독 플랫폼 | 1536×1536px | 복합 유닛 전체, 부유 중심 (0.5, 0.5) |
| 일반 적 촬영 드론 | 1536×1024px | 단일 드론 전체, 부유 중심 (0.5, 0.5) |
| 얼굴·상반신 | 1024×1024px | 성인 얼굴·의상·장식을 기준 전신과 동일하게 |
| 미리보기 / 아이콘 | 1024×1024 / 256×256px | 동일 원화의 대표 전신 / 얼굴·장비 중심 |
| 배경 | 2560×1440px 기준 | 가로 전장. 원경·중경·근경은 별도 출력 |
| 기지 | 1536×1536px 기준 | 화면 가장자리 건물·부스 단일 오브젝트 |
| UI 아이콘·효과 | 512×512 또는 1024×1024px | 문자 없는 단일 아이콘·단일 효과 |

원화 규격은 최종 납품 목표다. 생성 도구가 정확한 해상도를 지원하지 않으면 가장 가까운 비율로 생성하고 편집 과정에서 여백·출력 크기를 맞춘다. 몸체를 가로세로로 다르게 늘여 맞추지 않는다. 게임용 아틀라스는 실제 표시 크기와 메모리 측정 후 축소 출력한다.

캐릭터·기지·효과·아이콘은 투명 RGBA PNG와 sRGB로 납품한다. 배경 원경은 불투명, 중경·근경은 합성 목적에 맞게 투명 배경을 사용한다. 체크무늬가 그려진 이미지는 투명 이미지로 취급하지 않는다.

전장 표시 크기는 960×540 시안 기준 주인공 170~210px, 인간형 일반 유닛 110~150px, 보스 230~300px에서 검증한다. 제트팩 자매는 두 명이 각각 보이는지 별도 검수하고, 복잡한 액세서리보다 얼굴·머리·재킷·장비 실루엣을 우선한다. 이 크기는 화면 설계 검증값이며 기존 충돌 크기를 대체하지 않는다.

## 2.1. 모든 스킨의 필수 동작 컷

| 동작 | 파일 범위 | 컷 수 |
| --- | --- | --- |
| 대기 | `idle_00.png` ~ `idle_01.png` | 2 |
| 이동·롤러·비행 | `walk_00.png` ~ `walk_03.png` | 4 |
| 기본 공격 | `attack_00.png` ~ `attack_03.png` | 4 |
| 피격 | `hit_00.png` ~ `hit_01.png` | 2 |
| 등장·부활 | `spawn_00.png` ~ `spawn_02.png` | 3 |
| 퇴장 | `death_00.png` ~ `death_03.png` | 4 |
| 공통 본체 합계 | 모든 스킨에 동일하게 적용 | **19** |

기본 무당·요괴 스킨과 새 테마 모두 **스킨 한 벌은 여러 동작 PNG의 묶음**이다. 승인된 `idle_00.png`를 기준으로 나머지 컷을 각각 만든다. `reference.png`는 이 컷의 별칭이다. 같은 외형의 추가 의상 스킨도 자체 19컷과 고유 동작·효과를 준비한다.

비행·롤러도 파일명은 `walk_00.png ~ walk_03.png`, 퇴장은 `death_00.png ~ death_03.png`를 사용한다. 실제 자세는 개별 MD의 파일별 표를 따른다. `death_03.png`는 동일 캔버스의 완전 투명 파일이다. 본체와 고유 전신 컷은 같은 방향·배율·피벗을 유지하며 그림에 월드 이동·고도를 미리 넣지 않는다.

총기 공격 4컷은 조준 → 발사 → 반동 → 회복이다. 근접 무기는 준비 → 타격 → 반동 → 회수다. 실제 타격·발사 시점은 전투 이벤트와 연결하며 새 준비 시간을 임의로 추가하지 않는다.

여성 주인공·아군에는 `bust_idle_00.png ~ bust_idle_03.png` 전신 대기 컷을 추가한다. 같은 전신 원화를 선택 화면에서 상반신으로 크롭할 수 있다. 총과 손·가슴·팔·의상 사이의 간섭을 컷마다 확인한다.

리깅·파츠가 있어도 최종 납품은 동작별 PNG·클립 목록이다. 개별 MD에는 공통 19컷, 고유 본체 컷, 효과·상태 파일, 감상·표정·컷인이 각각 파일명과 자세로 지정되어 있다.

## 3. 캐릭터 공통 프롬프트

개별 프롬프트 MD에는 아래 방향과 해당 캐릭터의 고유 정보를 합친 완성 블록이 있다. 첫 대기 컷은 개별 MD의 외형 블록, 후속 컷은 해당 MD의 파일별 자세와 컷 생성 블록을 함께 사용한다.

```text
Create a polished 2D anime game character illustration for a modern convention-city lane-defense game. Crisp expressive line art, clean cel shading with soft material highlights, coherent commercial anime illustration style. Adult human characters with natural full-size anatomy and character-specific proportions; not chibi or super-deformed. Mechanical equipment uses coherent rigid construction.

Eye-level camera, restrained three-quarter side view facing RIGHT. One isolated complete game asset on a genuinely transparent background. Keep the entire silhouette, shoes and all intended equipment inside the canvas with generous margins. Soft neutral upper-left illumination. No scenery, floor, ground shadow, text, lettering, logos, watermark, border or UI. Separate broad VFX, projectiles, auras and speech bubbles from the body.

Preserve the exact age, face, hairstyle, body type, costume, palette, equipment count and equipment connections described in the individual character brief. Render one requested pose only, not a turnaround sheet, sprite sheet or collage. For a two-woman formation or a person-plus-platform unit, include exactly the complete subjects specified by that brief as one coherent asset.
```

인물이 없는 기계에 인간의 얼굴을 추가하지 않는다. 무인 드론은 개별 명세의 기체 구조·렌즈·로터 수를 우선한다.

## 4. 공통 제외 사항

- SD·2~4등신·아동 얼굴, 주인공 체형이 서로 같아지는 결과.
- 아군을 남성으로 바꾸거나 여성 인물을 무인 장비로 대체하는 결과.
- 실존 브랜드 로고·앱 화면·상표·실제 캐릭터 굿즈·읽을 수 있는 메시지.
- 실사 사진, 3D 플라스틱 렌더, 지나치게 촘촘한 무늬, 강한 광원이 얼굴을 덮는 결과.
- 잘린 발·머리·무기·프로펠러, 손가락·팔다리·휴대폰·장비 수가 늘어나는 결과.
- 본체에 그림자·체력바·숫자·넓은 오라·상대 캐릭터가 함께 그려진 결과.

제외 사항은 도구의 별도 네거티브 입력이 있으면 그곳에 넣을 수 있다. 해당 입력이 없으면 본문 지시로 전달한다. 단순 키워드만으로 얼굴·장비 일관성이 보장되지는 않으므로 승인 원화 참조와 결과 검수가 필요하다.

## 5. 바스트 모션을 위한 원화·리깅

바스트 모션은 상반신의 호흡·눈깜빡임·표정 변화와, 가슴의 후행 움직임을 함께 다룬다. 주인공뿐 아니라 인간형 여성 아군도 의상·체형·역할에 맞는 보조 모션을 둔다.

| 구분 | 표현 목표 |
| --- | --- |
| 빈유 츤데레 | 작은 가슴 반응, 빠른 몸통 회전, 트윈테일과 짧은 재킷 끝 중심 |
| 중간급 상냥한 형 | 부드러운 호흡과 완만한 후행, 가디건·소매와 M4 발사 뒤의 작은 움직임 |
| 폭유급 누님계 | 세 타입 중 뚜렷한 무게감과 지연·감쇠, 재킷의 지지력·팔 간격 유지 |
| 운동·경호·라이더형 아군 | 기능성 의상이 지지하는 작은 반동, 중심 이동과 장비 안정성 우선 |
| 셀럽·고딕·명품녀·DJ | 의상 재단에 맞춘 완만한 움직임, 머리·가방·옷자락과의 구분 |

1. `idle_00.png`를 승인하고 얼굴·체형·의상·지정 총기와 손의 연결을 고정한다.
2. 공통 19컷·고유 동작·바스트 4컷을 같은 기준 원화의 프레임으로 제작한다.
3. 리깅을 보조로 쓸 때만 파츠를 분리하고 가려진 영역을 복원한다. 결과를 지정된 프레임 PNG로 내보낸다.
4. 몸통이 먼저 움직이고 가슴·머리카락·의상이 늦게 따라오도록 서로 다른 강도·지연·감쇠를 둔다.
5. 상반신 전체 확대·축소로 가슴 모션을 대신하지 않는다. 좌우 파츠와 옷깃·팔 간의 교차를 제한한다.
6. 일시정지·부활·장면 재진입·연속 피격 때 모션이 튀거나 누적되지 않는지 확인한다.

정지 PNG는 리깅 데이터나 PSD 레이어를 포함하지 않는다. 생성 시 포즈를 그리는 작업과 실행 가능한 모션을 만드는 작업을 구분한다. 프레임 납품은 모든 스킨의 기본 방식이며, 리깅은 선택 보조 과정이다.

## 6. 후속 생성과 일관성 관리

- 첫 생성: 캐릭터별 기준 전신 1장. 인물·장비를 확정하기 전 표정 10장이나 공격 프레임을 동시에 만들지 않는다.
- 다음 생성: 승인 원화를 이미지 참조로 제공하고 한 번에 한 표정 또는 한 동작 단계만 바꾼다.
- 최종 프레임 기준: 공통 19컷에 고유 스킬·바스트·비행·착지 등의 추가 컷을 더한다. 개별 명세의 파일 목록을 모두 채운다.
- 필수 이동 4컷: 왼발 접지 → 오른발 통과 → 오른발 접지 → 왼발 통과의 4개 대표 자세로 시작한다. 롤러·비행은 전용 자세를 사용한다.
- 실제 타격·발사 시점은 기존 전투 이벤트에 맞춘다. 그림에 새 준비 동작이 있다고 게임 공격 지연을 늘리지 않는다.
- 방향·구도·캔버스·발 기준·장비 부착점을 고정하고, 모든 포즈를 겹쳐 보며 키·얼굴·소품 크기를 비교한다.
- 편집 지시의 우선순위는 승인 원화의 정체성 → 개별 명세 → 공통 화풍이다. 개별 문서가 2인 편대를 요구하면 공통의 단일 자산 지시 안에 두 명을 함께 넣는다.

## 7. 배경 5장 생성 콘셉트

배경에는 실제 교전 인물·적·기지·조작 UI를 그리지 않는다. 플레이 지면은 수평이며 전투가 진행되는 중앙 높이에 큰 장애물을 두지 않는다. 아래 프롬프트는 **전체 분위기 시안**용이다. 승인 후 원경·중경·근경으로 분리 제작하며, 시안 한 장을 곧바로 3겹 패럴랙스 파일로 취급하지 않는다.

### 1장 — 행사장 입구

- 분홍빛 저녁 하늘, 유리 외벽의 행사장, 무문자 안내 색판과 얕은 화단.
- 플레이 지면은 평평한 넓은 포장도로. 아군 라운지는 왼쪽, 적 점거 부스는 오른쪽에 배치할 공간을 남긴다.

```text
Wide 16:9 anime game background concept of a modern convention-center entrance at soft pink dusk. Glass facades, simple blank colored wayfinding panels, shallow planters, a broad perfectly level paved combat walkway. Clear horizontal side-view lane across the middle-lower area, low visual contrast behind character silhouettes. Reserve empty space at both ends for separately placed bases. Refined cel-shaded anime environment, soft atmospheric depth, no people, no characters, no bases, no readable signs, no logos, no UI. Opaque full-scene background concept.
```

### 2장 — 굿즈 거리

- 연속된 행사 판매 부스·차양·포장 상자. 실제 굿즈 일러스트·가격·브랜드는 넣지 않는다.
- 청보라 저녁과 따뜻한 부스 조명을 대비시킨다. 패널은 전장 뒤쪽에만 둔다.

```text
Wide 16:9 cel-shaded anime convention merchandise street at early evening. Repeating vendor booths and awnings in the middle distance, warm booth lighting against muted blue-purple twilight, blank display panels and simple closed boxes. Broad empty level walkway for a side-view lane-defense battle. Keep booths behind the combat plane and reserve both ends for separate bases. No people, recognizable merchandise, readable prices, lettering, logos, characters or UI. Opaque environment concept.
```

### 3장 — 야외 무대

- 이동 방송 장비가 어울리는 야외 행사 광장. 무대는 뒤쪽에 낮게 두고 먼 조명탑·케이블 브리지로 깊이를 만든다.
- 큰 스포트라이트는 중앙 캐릭터를 덮지 않게 원경에서만 사용한다.

```text
Wide 16:9 anime outdoor performance plaza at night, low distant stage, clean lighting trusses and cable bridges in the background, restrained teal and violet accent lights. A broad empty flat foreground promenade forming a clear horizontal combat lane, no stairs or barriers crossing the lane. Background spotlights stay subtle and do not wash out the central character area. No people, broadcaster, vehicles, characters, text, logos or UI. Opaque environment concept.
```

### 4장 — 방송 타워

- 높은 타워 내부의 넓은 수평 데크, 유리 벽 너머 도시 불빛과 먼 촬영 장비.
- 전투 지면과 드론이 떠 있을 상단 공간을 비운다. 타워 높이는 배경에서만 표현한다.

```text
Wide 16:9 cel-shaded anime broadcast-tower observation production deck at night. Broad level interior floor in side-view, distant glass wall revealing a layered city skyline, subtle gray-violet production architecture and small camera mounts far behind the combat plane. Generous empty upper airspace for separately rendered flying combatants, no objects crossing the lane. No drones, people, characters, readable screens, lettering, logos or UI. Opaque environment concept.
```

### 5장 — 점거된 메인 홀

- 짙은 먹보라 실내, 꺼진 대형 화면, 넓은 무대 프레임과 흐트러진 행사 장식.
- 최종 보스의 검정 실루엣이 보이도록 중앙 전투 배경에는 탁한 회보라 명도를 확보한다.

```text
Wide 16:9 anime convention main hall after a hostile takeover. Dark plum architectural framing, broad dormant blank display screens, displaced but simple stage decorations only in the background. Clear empty level combat floor, muted medium-light gray-violet backdrop behind the central character area so a black-coated boss remains readable. Subtle tension without horror. No people, boss, bases, readable screens, lettering, logos, chains across the lane or UI. Opaque environment concept.
```

### 패럴랙스 납품

원경은 하늘·도시·건물 벽, 중경은 부스·무대·구조물, 근경은 지면과 작은 가장자리 장식으로 분리한다. 좌우 반복 구간은 맞닿는 색·형태를 편집해 이음새를 확인한다. 전경 장식은 유닛 발과 체력바를 가리지 않게 한다. 레이어 이름은 `far.png`, `mid.png`, `near.png`로 제안하며 5장 각각 별도 폴더에 둔다.

## 8. 양 진영 기지 생성 콘셉트

기지는 배경과 분리된 투명 단일 오브젝트다. 위생적인 현대 행사장 분위기를 공유하되 왼쪽 라운지는 따뜻하고, 오른쪽 점거 부스는 복잡하고 차가운 느낌으로 구분한다.

### 아군 라운지

```text
One isolated modern anime convention staff lounge entrance as a lane-defense allied base, transparent background. Soft cream canopy, mint framing, warm interior light, compact seating and clean storage shapes visible inside. Ground-level entrance opens toward the RIGHT for allied characters to emerge. Restrained three-quarter side view compatible with a horizontal side-view battle, complete structure inside the canvas. No people, letters, logos, health bars, surrounding street or cast floor shadow.
```

### 적 점거 부스

```text
One isolated occupied anime convention booth as a lane-defense enemy base, transparent background. Dark plum framework, gray stacked display cases, blank panels and cold violet accent lights, messy but structurally readable. Ground-level exit opens toward the LEFT for enemy characters to emerge. Restrained three-quarter side view compatible with the allied base. Complete structure, no people, recognizable merchandise, letters, logos, health bars, surrounding street or cast floor shadow.
```

## 9. UI·전투 효과 콘셉트

UI 문구·숫자·키 표시는 게임에서 합성한다. 생성 이미지에는 미소녀 원화·아이콘·프레임 장식만 만들고, 한 장에 완성 HUD를 그려 실제 버튼을 대체하지 않는다.

| 묶음 | 모양·색 | 생성·사용 원칙 |
| --- | --- | --- |
| 지원 포인트 | 작은 민트 티켓과 금색 모서리 | 단일 아이콘, 숫자·문자 없음 |
| 액션 게이지 | 보라·금색 별빛 조각 | 단일 아이콘, 게이지 바는 코드로 표시 |
| 경호 / 스포트라이트 | 청색 경호 방패 / 적색 조명 원뿔 | 태그별 단일 아이콘 |
| 장비 / 기동 | 금색 렌치 / 하늘색 속도선 | 형태로도 구분하며 텍스트는 UI 합성 |
| 주인공 선택 카드 | 화이트·민트·보라의 절제된 프레임 | 전신 감상 영역을 넓히고 카드 이름은 별도 표시 |
| 잔광 | 대상에 붙는 작고 얇은 빛 조각 | 기존 화상 상태에만 연결 |
| 감속 / 회복 차단 / 버프 해제 | 발밑 고리 / 끊어진 하트 / 원형 사선 파동 | 다른 상태로 읽히는 형태, 무문자 |
| 공격·궁극기 | AK 적백 충격탄·M4 민트 탄·바렛 금보라 탄 | 캐릭터와 분리, 실제 범위·시점에 맞게 표시 |

아이콘 공통 프롬프트:

```text
One isolated anime game UI icon on a genuinely transparent square canvas. [ICON SUBJECT]. Bold readable silhouette, crisp outline, restrained cel shading, limited palette consistent with a modern convention-city anime game. Centered with generous padding, no letters, numbers, labels, logos, border, mockup screen or extra icons. Readable at a small in-game size.
```

효과 공통 프롬프트:

```text
One isolated 2D anime game visual-effect element on a genuinely transparent canvas. [EFFECT SUBJECT AND COLOR]. Clear directional or radial silhouette, restrained glow, readable clean edges, no character, body part, scenery, text, icon frame or UI. Keep the effect entirely within the canvas. This is one static effect frame, not a complete animation or sprite sheet.
```

주인공 선택 화면 시안은 좌측에 선택 카드 3개, 우측에 큰 전신·상반신 미리보기와 모션 확인 영역을 둔다. 전투 화면 시안은 큰 정상 비율 인물·지면·소환 버튼·자원·스킬이 함께 읽히는지를 확인하는 별도 목업이다. 목업 그림은 플레이 가능한 화면 구현으로 취급하지 않는다.

## 10. 이름·경로·제작 기록

```text
public/assets/themes/bishoujo-vs-otaku/
  heroes/<외형ID>/<skinId>/idle_00.png
  allies/<외형ID>/<skinId>/idle_00.png
  enemies/<외형ID>/<skinId>/idle_00.png
  bosses/<외형ID>/<skinId>/idle_00.png
  backgrounds/chapter-01..05/far.png, mid.png, near.png
  bases/allied-lounge.png
  bases/enemy-booth.png
  ui/<아이콘ID>.png
  effects/<효과ID>/<프레임명>.png
```

`chapter-01..05`는 범위 설명이며 실제 폴더명은 `chapter-01`, `chapter-02`처럼 각각 만든다. 캐릭터별 추가 파일·파츠·모션은 개별 명세를 따른다. 문서 폴더의 `hero/ally/enemy/boss` 분류명과 실제 에셋의 `heroes/allies/enemies/bosses` 분류명을 구분한다.

캐릭터·스킨별로 생성 도구·모델, 실제 생성일, 원본 프롬프트, 참조 원화, 제작자·수정자, 이용 조건, 수정 내역, 캔버스, 피벗, 효과 부착점과 승인 여부를 기록한다. 승인된 이미지를 기준으로 파생 파일의 참조 관계를 남긴다.

이 문서와 개별 MD는 이미지 제작을 위한 명세다. 현재 산출물에는 PNG 생성·리깅 데이터·게임 코드 변경이 포함되지 않는다.


## 11. 시트·아틀라스와 완료 기준

한 파일에 한 포즈인 개별 PNG를 최종 원본으로 보관한다. 생성·검수용 시트가 필요하면 동작별로 묶고 이동·공격은 컷 00→03 순서의 4칸 스트립, 대기는 2칸, 등장은 3칸, 퇴장은 4칸으로 배치한다. 셀 크기·여백·피벗을 고정하고 파일명과 셀의 대응 목록을 기록한다. 시트에 순서 숫자·설명을 그려 넣지 않는다. 한 장에 전체 19컷을 무리하게 넣어 캐릭터가 작아지지 않게 한다.

시트를 사용했으면 각 컷을 지정 파일명으로 분리한 뒤 아틀라스 PNG·JSON을 만든다. 아틀라스 키는 확장자를 뺀 파일명이며, 잘린 여백의 원본 크기·오프셋·피벗을 보존한다. 미리보기·아이콘·상반신·효과는 본체와 크기가 다르므로 별도 묶음으로 정리한다.

- [ ] 모든 스킨에 공통 본체 19개 파일이 있다.
- [ ] 이동·공격은 4컷이 서로 다른 동작 단계이며 루프와 회수가 연결된다.
- [ ] 고유 본체·바스트·효과·감상 이미지는 개별 MD의 수량과 파일명에 맞는다.
- [ ] AK·M4·바렛 및 각 유닛의 지정 무기가 전체 컷에서 유지된다.
- [ ] 리깅 자료나 기준 전신 1장만으로 완료 처리하지 않는다.
