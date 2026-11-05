# 기본 캐릭터 아트 생성 기록

작성일: 2026-11-04

제작 범위는 **기본 캐릭터 26종**이다. 사람형·도깨비는 2~3등신의 SD 비율, 동물·신수는 큰 머리와 짧은 몸을 기준으로 제작했다.

## 산출물

- 영웅 1종, 아군 10종, 일반 적 10종, 보스 5종.
- 문서의 파일명에 대응하는 개별 PNG **674개**.
- 종류마다 원본 시트, 정리된 아틀라스 PNG·JSON, 클립과 기준점 메타데이터, 생성 프롬프트 기록.
- 전체 정지 미리보기, 4프레임 걷기 GIF, 종류별 프레임을 펼쳐 보는 로컬 HTML.
- 내장 이미지 생성 도구 사용. API/CLI 생성은 사용하지 않았다.
- 사용자에게 명시적으로 지정받은 Python 이미지 후처리 사용.

## 경로

- [전체 미리보기](../../../output/art-generation/contact-sheet.png)
- [걷기 미리보기](../../../output/art-generation/walk-preview.gif)
- [프레임 확인용 HTML](../../../output/art-generation/preview.html)
- [이미지 묶음 ZIP](../../../output/art-generation/character-art-default.zip)
- [에셋 목록](../../../public/assets/characters/manifest.json)
- [에셋 사용 설명](../../../public/assets/characters/README.md)
- [기술 검증 결과](../../../output/art-generation/validation.json)
- [후처리 도구](../../../scripts/prepare-character-art.py)

원본·개별 PNG 경로는 `output/art-generation/source-assets/<hero|ally|enemy|boss>/<종류ID>/default/`다. 자동 생성 원본의 해상도는 도구 반환값을 사용했고, 개별 PNG는 MD의 지정 크기로 정리했다. 원본은 로컬 보관 대상으로 Git과 배포에서 제외한다.

## 게임 UI 연결 (v0.8.0)

`public/assets/characters/runtime/`의 압축된 PNG·JSON 아틀라스 26쌍과 `manifest.json`을 배포한다. 런타임 PNG 합계는 약 9.3MB이며, 최대 텍스처 크기는 1024×2048 이하로 제한한다. `python scripts/pack-runtime-art.py`로 로컬 원본에서 재생성할 수 있다.

전투의 영웅·아군·적·보스는 기본 이미지의 대기·이동·공격·피격·소환·퇴장을 사용한다. 좌우 반전, 성장·비행 높이, 일시정지, 영웅 부활을 화면 표시 계층에서 처리한다. 소환 버튼·빌드의 소환 순서·타이틀·보스 HUD에도 이미지가 연결되어 있다. 영웅 스킬 포즈·효과와 종류별 투사체도 적용한다.

에셋 로딩이 실패하면 캐릭터는 도형으로, UI는 글자로 대체한다. 공격 시점·피해·사거리·이동 속도 등 전투 규칙은 바꾸지 않는다.

## 검증과 남은 검수

0.8.0 UI 연결은 독립 검증 1차를 통과했다. 타입 검사, 테스트 474개(27파일), 프로덕션 빌드를 통과했고, 로컬 Chrome에서 캐릭터·소환 UI 표시, 일시정지, 에셋 로딩 실패 시 도형·텍스트 대체를 확인했다. 기존 번들 크기 경고와 아래 세부 아트 보정 사항은 남아 있다.

674개 파일의 존재, RGBA 형식과 완전 투명 픽셀, 기본 본체 캔버스의 일관성, 512×512 미리보기, 128×128 아이콘, 아틀라스 키·사각형·경계, 4장 걷기 프레임의 중복 여부를 검사해 오류가 없음을 확인했다. 전체 원화 미리보기에서 캐릭터 구분과 배경 정리 결과도 확인했다.

이 검증은 픽셀 내용 전체의 최종 아트 승인을 의미하지 않는다. 생성 모델이 표현한 꼬리·팔다리 개수, 공격 소품의 일관성, 일부 프레임의 잔여 조각과 동작 연결은 추가 육안 검수가 필요하다. 구미호는 꼬리 수 보정도 시도했으나 모든 자세에서 아홉 꼬리가 명확하게 구분된 상태는 확인하지 못해 추가 보정 대상으로 기록했다.

기본 이미지의 UI 연결은 위 v0.8.0 항목을 따르며, 생성 원화 전체에 대한 세부 아트 승인을 의미하지 않는다.

## 동자 해태 탑승형 (2026-11-05)

전투 중 영웅을 구별하기 위해 `hero:kkomaMudang`을 청백색 몸·청록 갈기 해태에 탄 모습으로 교체했다. 붉은 안장 덮개와 금테 깃발을 추가했으며 기존 `ally:haetae` 이미지와 전투 수치는 변경하지 않았다.

- [제작 명세](hero/kkomaMudang-haetae.md), [편집용 프롬프트](hero/kkomaMudang-haetae-prompts.md), [실행한 생성 프롬프트](../../../scripts/mounted-hero-generation.json).
- 내장 `image_gen`으로 기준 원화·걷기·대기/전투·스킬 3종·퇴장 시트·아이콘, 총 8개 원본 이미지를 생성했다. 각 이미지와 프롬프트는 프로젝트의 `output/art-generation/revisions/mounted-haetae/`에 보존했다.
- 최종 신규 PNG 32장: 공통 본체 19 + 스킬 본체 11 + 미리보기·아이콘 2. 기존 효과 10장을 재사용해 총 42개 프레임을 패킹했다. 등장 프레임은 탑승 대기의 알파 변화이며, 마지막 퇴장 프레임은 완전 투명이다.
- 최종 낱장은 `output/art-generation/revisions/mounted-haetae/hero/kkomaMudang/default/`와 정식 원본 폴더에 있다. 이전 도보형 원본은 `original-foot-hero/`에 보존했다.
- [걷기 GIF](../../../output/art-generation/revisions/mounted-haetae/walk-preview.gif), [걷기 4장 비교](../../../output/art-generation/revisions/mounted-haetae/walk-contact-sheet.png), [프레임 정렬 기록](../../../output/art-generation/revisions/mounted-haetae/alignment.json).
- 배포 파일: [PNG 아틀라스](../../../public/assets/characters/runtime/hero-kkomaMudang-mounted-haetae.png), [JSON 아틀라스](../../../public/assets/characters/runtime/hero-kkomaMudang-mounted-haetae.json). 원래 도보형 런타임 파일은 보관하고 manifest에서 새 파일을 선택한다.
- [재구성 도구](../../../scripts/build-mounted-hero.mjs)는 Node sharp로 시트 분리·알파 노이즈 정리·클립 공통 배율·발 기준점 정렬·패킹을 수행한다. 그림의 재생성은 하지 않는다. `pack-runtime-art.py`도 의미상 몸체 경계와 표시 크기를 보존한다.
- 표시 몸체 높이 64px, 머리 위 표시 기준 78px를 메타데이터로 분리했다. 체력바·피해 숫자는 깃발 위에 놓고 투사체는 깃발이 아닌 몸체 중심을 향한다. 영웅의 충돌·사거리·이동 속도는 유지한다. 빙의 이미지는 기존 규칙대로 선택한다.

원본의 얼굴·색·장식, 걷기 4장의 서로 다른 발 자세, 공격·스킬·피격·퇴장 상태의 탑승 유지와 알파 여백을 육안 확인했다. 실제 테스트·빌드·브라우저 검사 결과는 로컬 `output/art-generation/revisions/mounted-haetae/validation.json`에 기록한다. 자동 생성 애니메이션에는 작은 갈기·깃천 모양 변화가 남을 수 있다.
