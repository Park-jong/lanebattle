# 미소녀 VS 오타쿠 — 캐릭터 제작 문서

작성일: 2026-11-04 · 상태: 이미지 제작 전 콘셉트·명세

[전체 테마 목록](../README.md) · [상위 테마 기획](../../skin-concept-bishoujo-vs-otaku.md) · [공통 이미지 생성 콘셉트](image-generation-concept.md)

**주인공 3종·아군 10종·일반 적 10종·보스 5종, 총 28종**의 개별 명세와 이미지 생성 프롬프트를 정리했다. 각 대상마다 캐릭터·모션 MD 1개와 이미지 생성용 MD 1개가 있다. 이 목록과 공통 콘셉트까지 이 폴더의 MD는 총 58개다.

아군은 전원 성인 여성이다. 갸루만으로 통일하지 않고 인스타 셀럽·명품녀·운동계 언니·고딕·톰보이·아이돌·스트리트 스타일을 섞는다. 비행 아군도 여성 인물이 직접 장비를 쓰며, 제트팩 자매는 성인 여성 두 명을 한 전투 유닛으로 표현한다.

## 문서 사용 순서

1. 공통 이미지 생성 콘셉트에서 화풍·구도·출력 규격을 확인한다.
2. 아래 캐릭터 명세에서 얼굴·체형·의상·소품·모션·전투 대응을 확인한다.
3. 대응하는 생성 프롬프트 MD의 첫 대기 컷 블록으로 `idle_00.png`를 확정한다.
4. 승인 원화를 참조로 공통 본체 19컷과 해당 캐릭터의 고유 본체·바스트·효과·감상 컷을 파일별로 만든다.
5. 동작별 PNG·클립 목록을 검수하고 실제 게임 크기로 확인한다. 리깅은 선택 제작 보조다.

이미지 파일과 게임 기능은 아직 제작하지 않았다. 모든 이미지 경로·테마 ID·모션 클립은 향후 제작 제안이다. 기존 무당·요괴의 아트 문서는 기존 테마용으로 유지한다.

## 주인공 3종

| 이름 | 외형 ID 제안 | 기존 대응 | 개별 명세 | 이미지 생성 콘셉트 |
| --- | --- | --- | --- | --- |
| 빈유 츤데레 | `tsundere` | 꼬마 무당의 공통 영웅 규칙 | [명세](units/hero/tsundere.md) | [생성 프롬프트](prompts/hero/tsundere.md) |
| 중간급 상냥한 형 | `gentle` | 꼬마 무당의 공통 영웅 규칙 | [명세](units/hero/gentle.md) | [생성 프롬프트](prompts/hero/gentle.md) |
| 폭유급 누님계 | `oneesan` | 꼬마 무당의 공통 영웅 규칙 | [명세](units/hero/oneesan.md) | [생성 프롬프트](prompts/hero/oneesan.md) |

## 아군 10종 — 전원 성인 여성

| 이름 | 외형 ID 제안 | 기존 대응 | 개별 명세 | 이미지 생성 콘셉트 |
| --- | --- | --- | --- | --- |
| 갸루 경호원 | `gyaruGuard` | 도깨비 방망이병 | [명세](units/ally/gyaruGuard.md) | [생성 프롬프트](prompts/ally/gyaruGuard.md) |
| 스포티 롤러걸 | `sportyRoller` | 외다리 도깨비 | [명세](units/ally/sportyRoller.md) | [생성 프롬프트](prompts/ally/sportyRoller.md) |
| 운동계 언니 트레이너 | `fitnessTrainer` | 씨름 도깨비 | [명세](units/ally/fitnessTrainer.md) | [생성 프롬프트](prompts/ally/fitnessTrainer.md) |
| 인스타 셀럽 | `instaCeleb` | 여우불 사수 | [명세](units/ally/instaCeleb.md) | [생성 프롬프트](prompts/ally/instaCeleb.md) |
| 고딕 무대 마술사 | `gothicMagician` | 구미호 | [명세](units/ally/gothicMagician.md) | [생성 프롬프트](prompts/ally/gothicMagician.md) |
| 톰보이 정비공 | `tomboyMechanic` | 불가사리 | [명세](units/ally/tomboyMechanic.md) | [생성 프롬프트](prompts/ally/tomboyMechanic.md) |
| 명품녀 경호대장 | `luxuryLady` | 해태 | [명세](units/ally/luxuryLady.md) | [생성 프롬프트](prompts/ally/luxuryLady.md) |
| 공중 공연 아이돌 | `aerialIdol` | 삼족오 | [명세](units/ally/aerialIdol.md) | [생성 프롬프트](prompts/ally/aerialIdol.md) |
| 스트리트 제트팩 자매 | `jetpackDuo` | 까치 떼 | [명세](units/ally/jetpackDuo.md) | [생성 프롬프트](prompts/ally/jetpackDuo.md) |
| 스트리트 DJ | `streetDJ` | 영등 바람 | [명세](units/ally/streetDJ.md) | [생성 프롬프트](prompts/ally/streetDJ.md) |

## 일반 적 10종

| 이름 | 외형 ID 제안 | 기존 대응 | 개별 명세 | 이미지 생성 콘셉트 |
| --- | --- | --- | --- | --- |
| 돌격 오타쿠 | `otakuRusher` | 달걀귀신 | [명세](units/enemy/otakuRusher.md) | [생성 프롬프트](prompts/enemy/otakuRusher.md) |
| DM 폭주남 | `dmSpammer` | 물귀신 투척병 | [명세](units/enemy/dmSpammer.md) | [생성 프롬프트](prompts/enemy/dmSpammer.md) |
| 음침한 접근 아저씨 | `creepyApproacher` | 처녀귀신 | [명세](units/enemy/creepyApproacher.md) | [생성 프롬프트](prompts/enemy/creepyApproacher.md) |
| 굿즈 중무장 오타쿠 | `merchTank` | 장승 망령 | [명세](units/enemy/merchTank.md) | [생성 프롬프트](prompts/enemy/merchTank.md) |
| 무단 촬영 드론 | `cameraDrone` | 어둑시니 | [명세](units/enemy/cameraDrone.md) | [생성 프롬프트](prompts/enemy/cameraDrone.md) |
| 장문 훈수남 | `lectureGuy` | 그슨대 | [명세](units/enemy/lectureGuy.md) | [생성 프롬프트](prompts/enemy/lectureGuy.md) |
| 집착 멘헤라 남친 | `clingyBoyfriend` | 손각시 | [명세](units/enemy/clingyBoyfriend.md) | [생성 프롬프트](prompts/enemy/clingyBoyfriend.md) |
| 통제형 남친 | `controllingBoyfriend` | 저승사자 | [명세](units/enemy/controllingBoyfriend.md) | [생성 프롬프트](prompts/enemy/controllingBoyfriend.md) |
| 철벽 우기기 아저씨 | `stubbornUncle` | 강철이 | [명세](units/enemy/stubbornUncle.md) | [생성 프롬프트](prompts/enemy/stubbornUncle.md) |
| 막무가내 침입남 | `gateCrasher` | 두억시니 | [명세](units/enemy/gateCrasher.md) | [생성 프롬프트](prompts/enemy/gateCrasher.md) |

## 보스 5종

| 이름 | 외형 ID 제안 | 기존 대응 | 개별 명세 | 이미지 생성 콘셉트 |
| --- | --- | --- | --- | --- |
| 오타쿠 군단장 | `otakuCommander` | 거대 원귀 | [명세](units/boss/otakuCommander.md) | [생성 프롬프트](prompts/boss/otakuCommander.md) |
| 굿즈 성채왕 | `merchFortress` | 철갑 장승왕 | [명세](units/boss/merchFortress.md) | [생성 프롬프트](prompts/boss/merchFortress.md) |
| 관심 독점 방송남 | `attentionStreamer` | 이무기 강철이 | [명세](units/boss/attentionStreamer.md) | [생성 프롬프트](prompts/boss/attentionStreamer.md) |
| 무단 촬영 드론 총감독 | `droneDirector` | 어둑시니 대왕 | [명세](units/boss/droneDirector.md) | [생성 프롬프트](prompts/boss/droneDirector.md) |
| 최종 집착 전남친 | `obsessiveEx` | 차사왕 | [명세](units/boss/obsessiveEx.md) | [생성 프롬프트](prompts/boss/obsessiveEx.md) |

## 파일 구성

```text
README.md                       전체 목록·문서 사용법
image-generation-concept.md    화풍·비율·출력·공통 프롬프트·배경·기지·UI·효과
units/hero|ally|enemy|boss/      대상별 캐릭터·모션 MD 28개
prompts/hero|ally|enemy|boss/    대상별 이미지 생성 콘셉트·프롬프트 MD 28개
```

## 우선 제작 묶음

첫 묶음은 주인공 3종 + 갸루 경호원·인스타 셀럽·명품녀 경호대장 + 돌격 오타쿠·음침한 접근 아저씨·집착 멘헤라 남친 + 오타쿠 군단장, 총 10종을 제안한다. 주인공 체형 차이, 다양한 아군 취향, 적의 성격, 보스 배율을 함께 비교한다.

대표 모션은 중간급 상냥한 형으로 먼저 검증한다. 이후 공중 공연 아이돌로 탑승 비행을, 스트리트 제트팩 자매로 2인 1유닛을, 굿즈 성채왕으로 갑옷 오버레이를, 무단 촬영 드론 총감독으로 비행·착지 전환을 확인한다.

## 최종 검수

- [ ] 주인공 3종이 얼굴·체형·말투·포즈에서 구분된다.
- [ ] 아군 10종이 모두 성인 여성으로 보이고 서로 다른 패션 스타일을 가진다.
- [ ] 전장에서도 정상 비율의 전신 일러스트를 사용한다.
- [ ] 기존 전투 ID와 역할은 보존하고 외형·표시 이름만 테마에 맞춘다.
- [ ] 적의 일반형과 보스형이 소품 규모·자세·외형에서 구분된다.
- [ ] 이미지·표정·포즈 변형은 승인 원화의 얼굴과 소품 수를 유지한다.
- [ ] 보조 모션과 공격 판정·효과·UI가 분리되어 있다.



## 모든 스킨의 동작 컷과 무기

| 동작 | 파일 범위 | 컷 수 |
| --- | --- | --- |
| 대기 | `idle_00.png` ~ `idle_01.png` | 2 |
| 이동·롤러·비행 | `walk_00.png` ~ `walk_03.png` | 4 |
| 기본 공격 | `attack_00.png` ~ `attack_03.png` | 4 |
| 피격 | `hit_00.png` ~ `hit_01.png` | 2 |
| 등장·부활 | `spawn_00.png` ~ `spawn_02.png` | 3 |
| 퇴장 | `death_00.png` ~ `death_03.png` | 4 |
| 공통 본체 합계 | 모든 스킨에 동일하게 적용 | **19** |

28종의 공통 본체는 532컷이며 고유 본체·바스트 124컷을 더해 본체 총 656컷을 계획한다. 효과 PNG 115컷과 감상·표정·컷인은 별도다. 이 수량은 제작 목록이며 실제 이미지 생성 완료 수량이 아니다.

주인공 지정 무기는 츤데레 AK·상냥한 형 M4·누님계 바렛이다. 아군·적도 원거리 총기와 근접 무기를 역할에 맞게 사용한다. 캐릭터별 명세와 프롬프트에는 무기와 동작 단계가 결합된 전체 파일 목록이 있다.

이 규칙은 같은 캐릭터의 모든 추가 스킨에도 적용한다. 에셋은 `<외형ID>/<skinId>/`로 구분하며 `default`를 시작값으로 쓴다. 각 스킨의 의상·무기가 전체 프레임에서 유지되어야 한다. `reference.png`는 `idle_00.png`의 별칭이고 단일 전신 1장만으로 스킨 제작을 완료하지 않는다.
