# 기본 캐릭터 아트

최종 수정: 2026-11-05

`default` 스킨의 꼬마 무당·한국 민담 요괴 26종을 관리한다.

[게임 설계](../design.md) · [기본 스킨·애니메이션 구조](../skins-and-animation.md)

## 제작 문서

- [26종 명세·아트 가이드](default/README.md)
- [이미지 생성·적용 기록](default/GENERATED.md)

## 폴더 구성

```text
docs/art/
  README.md           기본 캐릭터 목차·공통 제작 규칙
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

화풍·인체 비율·원화 해상도·무기·컷별 자세는 기본 아트 가이드를 따른다. 리깅은 프레임 제작 보조로 사용할 수 있으며, 최종 납품은 개별 동작 이미지와 클립 목록을 포함한다.
