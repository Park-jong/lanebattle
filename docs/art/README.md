# 캐릭터 아트

최종 수정: 2026-11-05

`default` 스킨의 꼬마 무당·한국 민담 요괴 26종과 `military` 스킨의 시온·밀리터리 아군·감염체 26종 제작 문서를 관리한다.

[게임 설계](../design.md) · [기본 스킨·애니메이션 구조](../skins-and-animation.md)

## 제작 문서

- [밀리터리 스킨 26종 개별 컨셉·제작 목록](military/README.md): 영웅 1종·아군 10종·일반 적 10종·보스 5종, 일반 등신·모핑·머리카락·의상 동작 기준.
- [밀리터리 스킨 통합 설정·게임 적용 명세](military-allies-skin-concept.md)
- [밀리터리 스킨 전체 이미지 프롬프트](military/prompts/README.md): 26종 파일별 프롬프트, 보간·전환, 배경·기지·UI 및 JSON 작업 목록.
- [26종 명세·아트 가이드](default/README.md)
- [이미지 생성·적용 기록](default/GENERATED.md)
- [굿당·장별 적 기지와 파손 표현](default/bases.md)
- [동자 해태 탑승형 제작 명세](default/hero/kkomaMudang-haetae.md): 기존 해태와 구별되는 외형·마구·깃발·걷기 4프레임·전체 이미지 목록.
- [동자 해태 탑승형 이미지 프롬프트](default/hero/kkomaMudang-haetae-prompts.md): 기준 원화, 걷기와 나머지 동작, 아이콘·수정 지시.

## 폴더 구성

```text
docs/art/
  README.md           테마별 캐릭터 문서 목차
  military-allies-skin-concept.md  밀리터리 통합 설정·게임 적용 명세
  military/
    README.md         일반 등신 공통 규격·26종 개별 문서 목록
    hero/
    ally/
    enemy/
    boss/
  default/
    README.md         아트 가이드·26종 목록
    GENERATED.md      기본 이미지 생성·적용 기록
    hero/
    ally/
    enemy/
    boss/
```

## 기본 동작 컷

| 동작 | 파일 범위 | 컷 수 |
| --- | --- | --- |
| 대기 | `idle_00.png` ~ `idle_01.png` | 2 |
| 이동·비행 | `walk_00.png` ~ `walk_03.png` | 4 |
| 기본 공격 | `attack_00.png` ~ `attack_03.png` | 4 |
| 피격 | `hit_00.png` ~ `hit_01.png` | 2 |
| 등장·부활 | `spawn_00.png` ~ `spawn_02.png` | 3 |
| 퇴장 | `death_00.png` ~ `death_03.png` | 4 |
| 공통 본체 합계 | 캐릭터별 기본 동작 | **19** |

고유 스킬·비행·착지·성장 등은 개별 명세에 지정된 파일을 준비한다. 한 PNG에는 한 포즈를 담고, 프레임마다 방향·캔버스·배율·피벗을 유지한다.

화풍·인체 비율·원화 해상도·무기·컷별 자세는 각 테마의 아트 가이드와 개별 문서를 따른다. 밀리터리 테마는 일반 등신을 유지하고 자연스러운 보조 움직임을 위한 중간·전환 프레임을 추가한다. 리깅은 프레임 제작 보조로 사용할 수 있으며, 최종 납품은 개별 동작 이미지와 클립 목록을 포함한다.
